import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles, type Prediction } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, RefreshCw, Search, TrendingUp, Wrench, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip } from "recharts";

export default function Predictions() {
  const { vehicles } = useVehicles();
  const { isStaff } = useAuth();
  const [latest, setLatest] = useState<Record<string, Prediction>>({});
  const [history, setHistory] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [sort, setSort] = useState<"risk" | "health" | "vehicle">("risk");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("maintenance_predictions")
      .select("*").order("predicted_at", { ascending: false }).limit(800);
    const byV: Record<string, Prediction> = {};
    (data ?? []).forEach((p: any) => { if (!byV[p.vehicle_id]) byV[p.vehicle_id] = p as Prediction; });
    setLatest(byV);
    setHistory((data ?? []) as Prediction[]);
    if (!selected && Object.keys(byV).length) setSelected(Object.keys(byV)[0]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel(`predictions-page-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_predictions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  const rows = useMemo(() => {
    let r = vehicles.map((v) => ({ v, p: latest[v.id] })).filter((x) => x.p);
    if (riskFilter !== "all") r = r.filter((x) => x.p!.risk === riskFilter);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((x) => x.v.name.toLowerCase().includes(s) || x.v.plate.toLowerCase().includes(s));
    }
    const order = { high: 0, medium: 1, low: 2 } as any;
    r.sort((a, b) => {
      if (sort === "vehicle") return a.v.name.localeCompare(b.v.name);
      if (sort === "health") return (a.p!.health_score ?? 100) - (b.p!.health_score ?? 100);
      return order[a.p!.risk] - order[b.p!.risk];
    });
    return r;
  }, [vehicles, latest, riskFilter, q, sort]);

  const selVehicle = selected ? vMap[selected] : null;
  const selLatest = selected ? latest[selected] : null;
  const selHistory = useMemo(() => {
    if (!selected) return [];
    return history.filter((p) => p.vehicle_id === selected).slice(0, 30).reverse().map((p) => ({
      t: new Date(p.predicted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      health: p.health_score ?? 100,
      conf: Math.round(p.confidence * 100),
      risk: p.risk,
    }));
  }, [history, selected]);

  const rerun = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("predict-maintenance", {});
      if (error) throw error;
      toast.success("Model re-run");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed to run model"); }
    finally { setBusy(false); }
  };

  const scheduleService = async (vehicleId: string, reason: string) => {
    const { error } = await supabase.from("maintenance_records").insert({
      vehicle_id: vehicleId,
      maintenance_type: "Predictive service",
      cost: 0,
      notes: `Auto-scheduled from prediction: ${reason}`,
    });
    if (error) toast.error(error.message); else toast.success("Service logged");
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="pulse-dot bg-primary" />
            <span className="font-mono text-xs uppercase tracking-wider text-primary">AI engine</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Predictions</h1>
          <p className="text-muted-foreground">Live risk scoring, sensor-level explainability, and recommended actions.</p>
        </div>
        {isStaff && (
          <Button onClick={rerun} disabled={busy}>
            <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
            Re-run model
          </Button>
        )}
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 w-60" placeholder="Search vehicle" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risks</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v: any) => setSort(v)}>
          <SelectTrigger className="w-44"><ArrowUpDown className="mr-2 h-3 w-3" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="risk">Sort by risk</SelectItem>
            <SelectItem value="health">Sort by health</SelectItem>
            <SelectItem value="vehicle">Sort by vehicle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
              <th className="px-4 py-3 text-left">Vehicle</th>
              <th className="px-4 py-3 text-left">Risk</th>
              <th className="px-4 py-3 text-left">Health</th>
              <th className="px-4 py-3 text-left">Confidence</th>
              <th className="px-4 py-3 text-left">Top reason</th>
              <th className="px-4 py-3 text-left">Predicted</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                No predictions yet — launch the demo or wait for the next tick (every 2 min).
              </td></tr>}
              {rows.map(({ v, p }) => (
                <tr key={v.id}
                  onClick={() => setSelected(v.id)}
                  className={cn("border-t border-border cursor-pointer hover:bg-secondary/40 transition",
                    selected === v.id && "bg-secondary/30")}>
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold">{v.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{v.plate}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase font-mono",
                      p!.risk === "high" && "bg-destructive/20 text-destructive",
                      p!.risk === "medium" && "bg-warning/20 text-warning",
                      p!.risk === "low" && "bg-primary/20 text-primary")}>{p!.risk}</span>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <HealthBar value={p!.health_score ?? 100} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{Math.round(p!.confidence * 100)}%</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{p!.reasons?.[0] ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{timeAgo(p!.predicted_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/app/vehicles/${v.id}`} onClick={(e) => e.stopPropagation()}
                      className="text-xs text-primary hover:underline">Open →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        <aside className="glass rounded-2xl p-5 self-start sticky top-4">
          {!selVehicle || !selLatest ? (
            <div className="text-sm text-muted-foreground">Select a vehicle to inspect its prediction.</div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-lg font-bold">{selVehicle.name}</h3>
                  <div className="font-mono text-xs text-muted-foreground">{selVehicle.plate}</div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase font-mono",
                  selLatest.risk === "high" && "bg-destructive/20 text-destructive",
                  selLatest.risk === "medium" && "bg-warning/20 text-warning",
                  selLatest.risk === "low" && "bg-primary/20 text-primary")}>{selLatest.risk}</span>
              </div>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Health score</div>
                <div className="mt-1 font-mono text-3xl font-semibold">{selLatest.health_score ?? 100}<span className="text-sm text-muted-foreground">/100</span></div>
              </div>

              <div className="mt-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Brain className="h-3 w-3" /> Sensor contributions
                </div>
                <div className="mt-2 space-y-2">
                  {Object.entries(selLatest.sensor_contributions ?? {}).filter(([, v]) => v > 0).length === 0 && (
                    <div className="text-xs text-muted-foreground">All sensors nominal.</div>
                  )}
                  {Object.entries(selLatest.sensor_contributions ?? {})
                    .filter(([, v]) => v > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between font-mono text-[11px]">
                          <span>{k}</span><span className="text-muted-foreground">+{v}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                            style={{ width: `${Math.min(100, (Number(v) / 6) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {selLatest.reasons?.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Reasons</div>
                  <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground space-y-1">
                    {selLatest.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              {selLatest.recommended_action && (
                <div className="mt-5 rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold"><Wrench className="h-3 w-3" />Recommendation</div>
                  <div className="mt-1 text-xs text-muted-foreground">{selLatest.recommended_action}</div>
                </div>
              )}

              {selHistory.length > 1 && (
                <div className="mt-5">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> Health over time
                  </div>
                  <div className="mt-2 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selHistory}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                        <Line type="monotone" dataKey="health" stroke="#10f5b1" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {isStaff && selLatest.risk !== "low" && (
                <Button className="mt-4 w-full" size="sm" variant="outline"
                  onClick={() => scheduleService(selVehicle.id, selLatest.reasons?.[0] ?? "predictive")}>
                  <Wrench className="mr-2 h-4 w-4" />Schedule service
                </Button>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function HealthBar({ value }: { value: number }) {
  const color = value < 50 ? "bg-destructive" : value < 75 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-secondary overflow-hidden">
        <div className={cn("h-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs">{value}</span>
    </div>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}
