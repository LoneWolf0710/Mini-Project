// FleetIQ — seed a demo fleet for the simulator.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NAMES = ["TRK-01", "TRK-02", "TRK-03", "TRK-04", "TRK-05", "VAN-06", "VAN-07", "BUS-08", "BUS-09", "TRK-10"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const count = Math.min(Math.max(Number(body.count ?? 6), 1), NAMES.length);

  const { data: existing } = await sb.from("vehicles").select("name");
  const have = new Set((existing ?? []).map((v: any) => v.name));
  const center = { lat: 12.9716, lng: 77.5946 }; // Bengaluru-ish
  let created = 0;
  for (let i = 0; i < count; i++) {
    const name = NAMES[i];
    if (have.has(name)) continue;
    const type = name.startsWith("BUS") ? "bus" : name.startsWith("VAN") ? "van" : "truck";
    const { error } = await sb.from("vehicles").insert({
      name, plate: `KA-${1000 + i}`, vehicle_type: type, status: "active",
      odometer: 20000 + Math.floor(Math.random() * 80000),
      last_lat: center.lat + (Math.random() - 0.5) * 0.05,
      last_lng: center.lng + (Math.random() - 0.5) * 0.05,
    });
    if (!error) created++;
  }
  return new Response(JSON.stringify({ created }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
