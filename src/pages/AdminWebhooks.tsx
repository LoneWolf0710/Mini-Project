// Admin webhooks management page
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Webhook, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EVENTS = [
  "alert.created",
  "alert.resolved",
  "prediction.high_risk",
  "fuel.anomaly",
  "telemetry.received",
  "vehicle.created",
];

interface Webhook { id: string; name: string; url: string; events: string[]; secret: string; enabled: boolean; created_at: string; }
interface Delivery { id: string; webhook_id: string; event: string; response_status: number | null; error: string | null; delivered_at: string; }

export default function AdminWebhooks() {
  const { user } = useAuth();
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; url: string; events: string[] }>({ name: "", url: "", events: [] });

  const load = () => {
    supabase.from("webhooks").select("*").order("created_at", { ascending: false })
      .then(({ data }) => setHooks((data ?? []) as any));
    supabase.from("webhook_deliveries").select("*").order("delivered_at", { ascending: false }).limit(100)
      .then(({ data }) => setDeliveries((data ?? []) as any));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.url) return toast.error("Name & URL required");
    const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
    const { error } = await supabase.from("webhooks").insert({
      name: form.name, url: form.url, events: form.events, secret, created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Webhook created");
    setOpen(false);
    setForm({ name: "", url: "", events: [] });
    load();
  };

  const test = async (h: Webhook) => {
    const { error } = await supabase.functions.invoke("dispatch-webhook", { body: { event: "test", payload: { hello: "fleetiq", webhook_id: h.id } } });
    if (error) toast.error(error.message); else { toast.success("Test sent"); setTimeout(load, 1000); }
  };
  const toggle = async (h: Webhook) => { await supabase.from("webhooks").update({ enabled: !h.enabled }).eq("id", h.id); load(); };
  const remove = async (id: string) => { await supabase.from("webhooks").delete().eq("id", id); load(); };
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold">Webhooks & API</h1>
          <p className="font-mono text-sm text-muted-foreground">Receive HTTPS callbacks for alerts, predictions, and telemetry events.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New webhook</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register webhook</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Slack notifier" /></div>
              <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
              <div>
                <Label>Events</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {EVENTS.map((e) => (
                    <label key={e} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={form.events.includes(e)}
                        onChange={(ev) => setForm({ ...form, events: ev.target.checked ? [...form.events, e] : form.events.filter((x) => x !== e) })} />
                      <span className="font-mono">{e}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={create}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <Tabs defaultValue="hooks">
        <TabsList>
          <TabsTrigger value="hooks"><Webhook className="mr-2 h-4 w-4" />Webhooks ({hooks.length})</TabsTrigger>
          <TabsTrigger value="deliveries"><RefreshCw className="mr-2 h-4 w-4" />Deliveries ({deliveries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="hooks" className="mt-4 space-y-3">
          {hooks.length === 0 && <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No webhooks yet.</div>}
          {hooks.map((h) => (
            <div key={h.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-mono font-semibold">{h.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${h.enabled ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {h.enabled ? "live" : "paused"}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{h.url}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {h.events.map((e) => <span key={e} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">{e}</span>)}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <code className="truncate rounded bg-secondary/40 px-2 py-1 font-mono text-[10px]">{h.secret}</code>
                    <button onClick={() => copy(h.secret)}><Copy className="h-3 w-3 text-muted-foreground" /></button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch checked={h.enabled} onCheckedChange={() => toggle(h)} />
                  <Button size="sm" variant="outline" onClick={() => test(h)}>Test</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(h.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}

          <div className="glass rounded-2xl p-5">
            <h3 className="mb-2 font-semibold">Signature verification</h3>
            <p className="text-xs text-muted-foreground">Each request includes <code className="font-mono">X-FleetIQ-Signature: sha256=&lt;hex&gt;</code> = HMAC-SHA256 of the raw JSON body using your secret.</p>
            <pre className="mt-3 overflow-auto rounded-lg bg-secondary/40 p-3 font-mono text-[11px]">{`// Node example
import crypto from "node:crypto";
const verify = (body, sig, secret) =>
  crypto.timingSafeEqual(
    Buffer.from(\`sha256=\${crypto.createHmac("sha256", secret).update(body).digest("hex")}\`),
    Buffer.from(sig)
  );`}</pre>
          </div>
        </TabsContent>

        <TabsContent value="deliveries" className="mt-4">
          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Event</th>
                <th className="px-4 py-3 text-left">Hook</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr></thead>
              <tbody>
                {deliveries.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No deliveries yet.</td></tr>}
                {deliveries.map((d) => {
                  const h = hooks.find((x) => x.id === d.webhook_id);
                  const ok = d.response_status != null && d.response_status >= 200 && d.response_status < 300;
                  return (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-4 py-2 font-mono text-xs">{format(new Date(d.delivered_at), "MMM d HH:mm:ss")}</td>
                      <td className="px-4 py-2 font-mono text-xs">{d.event}</td>
                      <td className="px-4 py-2 font-mono text-xs">{h?.name ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        <span className={`rounded px-1.5 py-0.5 ${ok ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                          {d.response_status ?? d.error ?? "?"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
