// FleetIQ — predictive maintenance scoring (rules + statistics) with sensor-level explainability + health score.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Reading {
  ts: string; engine_temp: number | null; rpm: number | null; fuel_level: number | null;
  vibration: number | null; battery_voltage: number | null; speed: number | null;
}

function statsOf(arr: number[]) {
  if (arr.length === 0) return { mean: 0, std: 0, slope: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, arr.length - 1);
  const std = Math.sqrt(variance);
  const n = arr.length, xMean = (n - 1) / 2;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xMean) * (arr[i] - mean); den += (i - xMean) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return { mean, std, slope };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: vehicles } = await sb.from("vehicles").select("id, name");
  let scored = 0;

  for (const v of vehicles ?? []) {
    const { data: readings } = await sb.from("telemetry_readings")
      .select("ts, engine_temp, rpm, fuel_level, vibration, battery_voltage, speed")
      .eq("vehicle_id", v.id).order("ts", { ascending: false }).limit(60);
    if (!readings || readings.length < 5) continue;
    const r = readings.reverse() as Reading[];

    const temps = r.map(x => x.engine_temp).filter((x): x is number => x != null);
    const vibs  = r.map(x => x.vibration).filter((x): x is number => x != null);
    const batts = r.map(x => x.battery_voltage).filter((x): x is number => x != null);
    const fuels = r.map(x => x.fuel_level).filter((x): x is number => x != null);
    const rpms  = r.map(x => x.rpm).filter((x): x is number => x != null);

    const tStats = statsOf(temps), vStats = statsOf(vibs), bStats = statsOf(batts);
    const lastTemp = temps.at(-1) ?? 0, lastVib = vibs.at(-1) ?? 0, lastBatt = batts.at(-1) ?? 14;
    const lastFuel = fuels.at(-1);
    const lastRpm = rpms.at(-1) ?? 0;

    const reasons: string[] = [];
    const contrib: Record<string, number> = { engine_temp: 0, vibration: 0, battery_voltage: 0, fuel_level: 0, rpm: 0 };
    let score = 0;

    // Engine temp
    if (lastTemp > 115) { score += 3; contrib.engine_temp += 3; reasons.push(`Engine temp critical at ${lastTemp.toFixed(0)}°C`); }
    else if (lastTemp > 105) { score += 2; contrib.engine_temp += 2; reasons.push(`Engine temp elevated at ${lastTemp.toFixed(0)}°C`); }
    if (tStats.std > 0 && (lastTemp - tStats.mean) / tStats.std > 2) {
      score += 2; contrib.engine_temp += 2;
      reasons.push(`Engine temp z-score ${((lastTemp - tStats.mean) / tStats.std).toFixed(1)}`);
    }
    if (tStats.slope > 0.4) { score += 1; contrib.engine_temp += 1; reasons.push(`Engine temp trending up`); }

    // Vibration
    if (lastVib > 0.9) { score += 3; contrib.vibration += 3; reasons.push(`Vibration critical (${lastVib.toFixed(2)})`); }
    else if (lastVib > 0.6) { score += 2; contrib.vibration += 2; reasons.push(`Vibration elevated (${lastVib.toFixed(2)})`); }
    if (vStats.slope > 0.01) { score += 1; contrib.vibration += 1; reasons.push(`Vibration trending up`); }

    // Battery
    if (lastBatt < 11.5) { score += 2; contrib.battery_voltage += 2; reasons.push(`Battery voltage low (${lastBatt.toFixed(1)}V)`); }
    if (bStats.slope < -0.01) { score += 1; contrib.battery_voltage += 1; reasons.push(`Battery voltage declining`); }

    // Fuel low
    if (lastFuel != null && lastFuel < 15) { score += 1; contrib.fuel_level += 1; reasons.push(`Fuel low (${lastFuel.toFixed(0)}%)`); }

    // Fuel anomaly: rolling z-score on consecutive deltas (negative big drop = leak/theft)
    let fuelAnomaly: { drop: number; z: number } | null = null;
    if (fuels.length >= 5) {
      const deltas: number[] = [];
      for (let i = 1; i < fuels.length; i++) deltas.push(fuels[i] - fuels[i - 1]);
      const dStats = statsOf(deltas);
      const lastDelta = deltas.at(-1) ?? 0;
      const z = dStats.std > 0 ? (lastDelta - dStats.mean) / dStats.std : 0;
      // big sudden DROP: lastDelta strongly negative, z far below mean
      if (lastDelta < -3 && z < -2) {
        fuelAnomaly = { drop: -lastDelta, z };
        score += 2;
        contrib.fuel_level += 2;
        reasons.push(`Fuel anomaly: sudden drop of ${(-lastDelta).toFixed(1)}% (z=${z.toFixed(1)}) — possible leak or theft`);
      }
    }

    // RPM (overrev sustained)
    if (lastRpm > 4000) { score += 1; contrib.rpm += 1; reasons.push(`RPM very high (${Math.round(lastRpm)})`); }

    let risk: "low" | "medium" | "high" = "low";
    if (score >= 5) risk = "high";
    else if (score >= 2) risk = "medium";
    const confidence = Math.min(0.99, 0.5 + score * 0.08);
    // Health score 0-100: 100 healthy, decays with score
    const health_score = Math.max(0, Math.round(100 - score * 9));

    const action = risk === "high"
      ? "Schedule immediate inspection — multiple critical indicators."
      : risk === "medium"
      ? "Plan service within 7 days; monitor flagged sensors."
      : "No action — continue monitoring.";

    await sb.from("maintenance_predictions").insert({
      vehicle_id: v.id, risk, confidence, reasons, recommended_action: action,
      sensor_contributions: contrib, health_score,
    });

    if (risk !== "low") {
      const { data: lastAlert } = await sb.from("alerts").select("created_at, severity, is_resolved")
        .eq("vehicle_id", v.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const sev = risk === "high" ? "critical" : "warning";
      const recent = lastAlert && (Date.now() - new Date(lastAlert.created_at).getTime()) < 10 * 60 * 1000 && lastAlert.severity === sev && !lastAlert.is_resolved;
      if (!recent) {
        await sb.from("alerts").insert({
          vehicle_id: v.id, alert_type: "predictive",
          severity: sev,
          message: `Predictive: ${risk.toUpperCase()} risk — ${reasons.slice(0, 2).join("; ")}`,
        });
      }
    }

    // Dedicated fuel anomaly alert
    if (fuelAnomaly) {
      const { data: lastFA } = await sb.from("alerts").select("created_at")
        .eq("vehicle_id", v.id).eq("alert_type", "fuel_anomaly")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const recent = lastFA && (Date.now() - new Date(lastFA.created_at).getTime()) < 15 * 60 * 1000;
      if (!recent) {
        await sb.from("alerts").insert({
          vehicle_id: v.id, alert_type: "fuel_anomaly",
          severity: fuelAnomaly.drop > 8 ? "critical" : "warning",
          message: `Fuel anomaly detected: ${fuelAnomaly.drop.toFixed(1)}% sudden drop (possible leak or theft)`,
        });
      }
    }
    scored++;
  }

  return new Response(JSON.stringify({ scored }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
