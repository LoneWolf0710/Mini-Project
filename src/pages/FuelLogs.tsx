// Fuel logs with cost tracking, monthly spend chart, top burners
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Fuel, TrendingUp, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { toast } from "sonner";

interface FuelLog {
  id: string;
  vehicle_id: string;
  liters: number;
  price_per_liter: number;
  odometer: number | null;
  logged_at: string;
}

export default function FuelLogs() {
  const { user } = useAuth();
  const { vehicles } = useVehicles();
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_id: "", liters: "", price_per_liter: "", odometer: "" });

  const load = () => supabase.from("fuel_logs").select("*").order("logged_at", { ascending: false }).limit(500)
    .then(({ data }) => setLogs((data ?? []) as any));

  useEffect(() => { load(); }, []);

  const monthly = useMemo(() => {
    const map: Record<string, { month: string; cost: number; liters: number }> = {};
    logs.forEach((l) => {
      const k = format(new Date(l.logged_at), "MMM yyyy");
      const m = map[k] ??= { month: k, cost: 0, liters: 0 };
      m.cost += Number(l.liters) * Number(l.price_per_liter);
      m.liters += Number(l.liters);
    });
    return Object.values(map).reverse();
  }, [logs]);

  const totalCost = useMemo(() => logs.reduce((s, l) => s + Number(l.liters) * Number(l.price_per_liter), 0), [logs]);
  const totalLiters = useMemo(() => logs.reduce((s, l) => s + Number(l.liters), 0), [logs]);

  // Cost / km per vehicle (uses odometer span)
  const burners = useMemo(() => {
    const byV: Record<string, { liters: number; cost: number; minOdo: number; maxOdo: number }> = {};
    logs.forEach((l) => {
      const v = byV[l.vehicle_id] ??= { liters: 0, cost: 0, minOdo: Infinity, maxOdo: 0 };
      v.liters += Number(l.liters);
      v.cost += Number(l.liters) * Number(l.price_per_liter);
      if (l.odometer != null) {
        v.minOdo = Math.min(v.minOdo, Number(l.odometer));
        v.maxOdo = Math.max(v.maxOdo, Number(l.odometer));
      }
    });
    return Object.entries(byV).map(([vid, d]) => {
      const km = d.maxOdo - d.minOdo;
      const lp100 = km > 0 ? (d.liters / km) * 100 : null;
      const v = vehicles.find((vv) => vv.id === vid);
      return { vehicle: v, ...d, lp100, costPerKm: km > 0 ? d.cost / km : null };
    }).sort((a, b) => (b.lp100 ?? 0) - (a.lp100 ?? 0)).slice(0, 5);
  }, [logs, vehicles]);

  const create = async () => {
    if (!form.vehicle_id || !form.liters) return toast.error("Vehicle & liters required");
    const { error } = await supabase.from("fuel_logs").insert({
      vehicle_id: form.vehicle_id,
      liters: Number(form.liters),
      price_per_liter: Number(form.price_per_liter || 0),
      odometer: form.odometer ? Number(form.odometer) : null,
      logged_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Fuel logged");
    setOpen(false);
    setForm({ vehicle_id: "", liters: "", price_per_liter: "", odometer: "" });
    load();
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold">Fuel logs</h1>
          <p className="font-mono text-sm text-muted-foreground">Track fill-ups, costs, and per-vehicle efficiency.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Log fill-up</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Log fuel fill-up</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Vehicle</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick vehicle" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} · {v.plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Liters</Label><Input type="number" step="0.1" value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value })} /></div>
                <div><Label>Price / L</Label><Input type="number" step="0.01" value={form.price_per_liter} onChange={(e) => setForm({ ...form, price_per_liter: e.target.value })} /></div>
              </div>
              <div><Label>Odometer (km)</Label><Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></div>
              <Button className="w-full" onClick={create}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={DollarSign} label="Total spend" v={`$${totalCost.toFixed(2)}`} />
        <Stat icon={Fuel} label="Total liters" v={`${totalLiters.toFixed(1)} L`} />
        <Stat icon={TrendingUp} label="Entries" v={logs.length.toString()} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <h3 className="mb-3 font-semibold">Monthly spend</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="cost" fill="#10f5b1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Top fuel burners (L/100km)</h3>
          <div className="space-y-2">
            {burners.length === 0 && <div className="text-sm text-muted-foreground">Log fill-ups with odometer for efficiency stats.</div>}
            {burners.map((b) => b.vehicle && (
              <div key={b.vehicle.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-mono text-sm">{b.vehicle.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{b.vehicle.plate}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-semibold">{b.lp100 != null ? `${b.lp100.toFixed(1)} L/100km` : "—"}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">${b.costPerKm != null ? `${b.costPerKm.toFixed(2)}/km` : "—"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass mt-6 overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Vehicle</th>
            <th className="px-4 py-3 text-right">Liters</th>
            <th className="px-4 py-3 text-right">Price/L</th>
            <th className="px-4 py-3 text-right">Cost</th>
            <th className="px-4 py-3 text-right">Odometer</th>
          </tr></thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No fuel logs yet.</td></tr>}
            {logs.map((l) => {
              const v = vehicles.find((vv) => vv.id === l.vehicle_id);
              const cost = Number(l.liters) * Number(l.price_per_liter);
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{format(new Date(l.logged_at), "MMM d, HH:mm")}</td>
                  <td className="px-4 py-2 font-mono text-xs">{v?.name ?? "—"} <span className="text-muted-foreground">{v?.plate}</span></td>
                  <td className="px-4 py-2 text-right font-mono">{Number(l.liters).toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-mono">${Number(l.price_per_liter).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold">${cost.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-mono text-muted-foreground">{l.odometer != null ? `${Number(l.odometer).toLocaleString()} km` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, v }: any) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold">{v}</div>
    </div>
  );
}
