// Admin: Alert Rules — configurable thresholds that drive the alert engine
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const METRICS = ["engine_temp", "vibration", "battery_voltage", "fuel_level", "speed", "rpm"];

export default function AdminAlertRules() {
  const [rules, setRules] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", metric: "engine_temp", comparator: ">", threshold: 100,
    consecutive_required: 1, severity: "warning",
  });

  const load = () => supabase.from("alert_rules").select("*").order("created_at", { ascending: false })
    .then(({ data }) => setRules(data ?? []));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("alert_rules").insert({
      ...form, threshold: Number(form.threshold), consecutive_required: Number(form.consecutive_required),
      created_by: user?.id,
    });
    if (error) toast.error(error.message); else { toast.success("Rule added"); setOpen(false); load(); }
  };

  const toggle = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("alert_rules").update({ enabled }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("alert_rules").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); load(); }
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alert rules</h1>
          <p className="text-muted-foreground">Configurable thresholds that fire alerts on incoming telemetry.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Add rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New alert rule</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Engine overheating" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Metric</Label>
                  <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METRICS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Comparator</Label>
                  <Select value={form.comparator} onValueChange={(v) => setForm({ ...form, comparator: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[">", "<", ">=", "<="].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Threshold</Label><Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Consecutive readings</Label><Input type="number" min={1} value={form.consecutive_required} onChange={(e) => setForm({ ...form, consecutive_required: Number(e.target.value) })} /></div>
                <div><Label>Severity</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-3 text-left">Name</th>
            <th className="px-4 py-3 text-left">Condition</th>
            <th className="px-4 py-3 text-left">Consecutive</th>
            <th className="px-4 py-3 text-left">Severity</th>
            <th className="px-4 py-3 text-left">Enabled</th>
            <th className="px-4 py-3 text-left"></th>
          </tr></thead>
          <tbody>
            {rules.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No rules.</td></tr>}
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.metric} {r.comparator} {r.threshold}</td>
                <td className="px-4 py-3 font-mono">{r.consecutive_required}</td>
                <td className="px-4 py-3 font-mono uppercase text-xs">{r.severity}</td>
                <td className="px-4 py-3"><Switch checked={r.enabled} onCheckedChange={(v) => toggle(r.id, v)} /></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        These rules are stored in the database. Edge functions read them on each telemetry tick to decide whether to raise alerts.
      </p>
    </div>
  );
}
