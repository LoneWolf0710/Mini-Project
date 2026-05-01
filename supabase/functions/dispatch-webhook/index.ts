// FleetIQ — webhook dispatcher. Called from other functions to fan out events to registered URLs.
// HMAC-SHA256 signature in X-FleetIQ-Signature header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { event, payload } = await req.json().catch(() => ({}));
  if (!event || typeof event !== "string") {
    return new Response(JSON.stringify({ error: "event required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: hooks } = await sb.from("webhooks").select("*").eq("enabled", true);
  const matching = (hooks ?? []).filter((h: any) => h.events.includes(event) || h.events.includes("*"));

  const results: any[] = [];
  for (const h of matching) {
    const body = JSON.stringify({ event, delivered_at: new Date().toISOString(), payload });
    const sig = await hmacSign(h.secret, body);
    let status = 0, respText = "", error: string | null = null;
    try {
      const resp = await fetch(h.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FleetIQ-Signature": `sha256=${sig}`,
          "X-FleetIQ-Event": event,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      status = resp.status;
      respText = (await resp.text()).slice(0, 1000);
    } catch (e: any) {
      error = e.message ?? String(e);
    }
    await sb.from("webhook_deliveries").insert({
      webhook_id: h.id, event, payload, response_status: status, response_body: respText, error,
    });
    results.push({ webhook_id: h.id, status, error });
  }

  return new Response(JSON.stringify({ dispatched: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
