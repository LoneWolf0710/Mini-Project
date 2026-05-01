// FleetIQ — synthetic telemetry generator + demo seeder helper.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Per-vehicle persistent state in memory (best-effort across warm invocations)
const state: Record<string, { temp: number; rpm: number; fuel: number; vib: number; batt: number; speed: number; lat: number; lng: number; faulty: boolean }> = {};

function step(vId: string, base: { lat: number; lng: number }) {
  const s = state[vId] ??= {
    temp: 80 + Math.random() * 10, rpm: 1800 + Math.random() * 400,
    fuel: 60 + Math.random() * 30, vib: 0.3 + Math.random() * 0.1,
    batt: 12.4 + Math.random() * 0.4, speed: 50 + Math.random() * 20,
    lat: base.lat, lng: base.lng,
    faulty: Math.random() < 0.25,
  };
  // random walks
  s.temp = clamp(s.temp + (Math.random() - 0.5) * 2 + (s.faulty ? 0.6 : 0), 60, 140);
  s.rpm  = clamp(s.rpm + (Math.random() - 0.5) * 80, 800, 4500);
  // Fuel: usually small drain; rare sudden drop (anomaly) for faulty units
  let fuelDrop = Math.random() * 0.4;
  if (s.faulty && Math.random() < 0.04) fuelDrop = 5 + Math.random() * 6; // sudden 5-11% drop
  s.fuel = clamp(s.fuel - fuelDrop, 0, 100);
  s.vib  = clamp(s.vib + (Math.random() - 0.5) * 0.05 + (s.faulty ? 0.02 : 0), 0.05, 1.5);
  s.batt = clamp(s.batt + (Math.random() - 0.5) * 0.08 - (s.faulty ? 0.02 : 0), 10, 14.5);
  s.speed = clamp(s.speed + (Math.random() - 0.5) * 8, 0, 120);
  s.lat += (Math.random() - 0.5) * 0.002;
  s.lng += (Math.random() - 0.5) * 0.002;
  return s;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const ticks: number = Math.min(Number(body.ticks ?? 1), 50);

  const { data: vehicles } = await sb.from("vehicles").select("id, last_lat, last_lng, status");
  const list = (vehicles ?? []).filter((v: any) => v.status !== "maintenance");
  if (list.length === 0) return json({ inserted: 0, note: "no active vehicles" });

  const now = Date.now();
  const rows: any[] = [];
  for (const v of list) {
    const base = { lat: v.last_lat ?? 12.97, lng: v.last_lng ?? 77.59 };
    for (let i = 0; i < ticks; i++) {
      const s = step(v.id, base);
      rows.push({
        vehicle_id: v.id,
        ts: new Date(now - (ticks - i) * 5000).toISOString(),
        engine_temp: round(s.temp, 1), rpm: Math.round(s.rpm),
        fuel_level: round(s.fuel, 1), vibration: round(s.vib, 3),
        battery_voltage: round(s.batt, 2), speed: Math.round(s.speed),
        lat: round(s.lat, 5), lng: round(s.lng, 5),
      });
    }
    const last = state[v.id];
    await sb.from("vehicles").update({ last_lat: last.lat, last_lng: last.lng, updated_at: new Date().toISOString() }).eq("id", v.id);
  }
  const { error } = await sb.from("telemetry_readings").insert(rows);
  if (error) return json({ error: error.message }, 500);
  return json({ inserted: rows.length });
});

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const json = (b: any, status = 200) => new Response(JSON.stringify(b), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
