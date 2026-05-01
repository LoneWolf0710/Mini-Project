// FleetIQ — public telemetry ingest. Accepts vehicle_id OR vehicle_plate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let inserted = 0;
    for (const r of items) {
      let vehicleId: string | null = r.vehicle_id ?? null;
      if (!vehicleId && r.vehicle_plate) {
        const { data: v } = await sb.from("vehicles").select("id").eq("plate", r.vehicle_plate).maybeSingle();
        vehicleId = v?.id ?? null;
      }
      if (!vehicleId) continue;

      const num = (x: any) => (x == null || x === "" ? null : Number(x));
      const { error } = await sb.from("telemetry_readings").insert({
        vehicle_id: vehicleId,
        engine_temp: num(r.engine_temp), rpm: num(r.rpm), fuel_level: num(r.fuel_level),
        vibration: num(r.vibration), battery_voltage: num(r.battery_voltage), speed: num(r.speed),
        lat: num(r.lat), lng: num(r.lng),
      });
      if (!error) {
        inserted++;
        const upd: any = { updated_at: new Date().toISOString() };
        if (r.lat != null) upd.last_lat = Number(r.lat);
        if (r.lng != null) upd.last_lng = Number(r.lng);
        await sb.from("vehicles").update(upd).eq("id", vehicleId);
      }
    }

    return new Response(JSON.stringify({ inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
