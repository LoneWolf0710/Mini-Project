import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useLatestPredictions, useLatestTelemetry, useVehicles } from "@/hooks/useFleet";
import FleetMap from "@/components/FleetMap";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, Truck, Wrench, Fuel, Sparkles, Zap, Cpu, Brain, Rocket, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Dashboard() {
  const { vehicles, loading } = useVehicles();
  const telemetry = useLatestTelemetry();
  const predictions = useLatestPredictions();
  const [openAlerts, setOpenAlerts] = useState(0);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    const load = () => supabase.from("alerts").select("*", { count: "exact", head: true })
      .eq("is_resolved", false).then(({ count }) => setOpenAlerts(count ?? 0));
    load();
    const ch = supabase.channel(`alerts-dash-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const launchDemo = async () => {
    setLaunching(true);
    try {
      await supabase.rpc("claim_first_admin");
      const { error: e1 } = await supabase.functions.invoke("seed-fleet", { body: { count: 6 } });
      if (e1) throw e1;
      await supabase.functions.invoke("simulate-telemetry", { body: { ticks: 12 } });
      await supabase.functions.invoke("simulate-telemetry", { body: { ticks: 12 } });
      await supabase.functions.invoke("predict-maintenance", {});
      toast.success("Demo fleet is live! Streaming telemetry every minute.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not launch demo");
    } finally {
      setLaunching(false);
    }
  };

  const highRisk = Object.values(predictions).filter((p) => p.risk === "high").length;
  const active = vehicles.filter((v) => v.status === "active").length;
  const avgFuel = (() => {
    const vals = Object.values(telemetry).map((r) => r.fuel_level).filter((v) => v != null) as number[];
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  })();
  const avgHealth = (() => {
    const vals = Object.values(predictions).map((p) => p.health_score ?? 100);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 100;
  })();

  const stats = [
    { label: "Active vehicles", value: `${active}/${vehicles.length}`, icon: Truck, tone: "primary" as const },
    { label: "Open alerts", value: openAlerts, icon: AlertTriangle, tone: openAlerts ? "destructive" as const : "primary" as const },
    { label: "High-risk", value: highRisk, icon: Wrench, tone: highRisk ? "destructive" as const : "primary" as const },
    { label: "Fleet health", value: `${avgHealth}/100`, icon: HeartPulse, tone: avgHealth < 60 ? "destructive" as const : avgHealth < 80 ? "warning" as const : "primary" as const },
    { label: "Avg fuel", value: `${avgFuel}%`, icon: Fuel, tone: avgFuel < 30 && vehicles.length ? "warning" as const : "primary" as const },
  ];

  const empty = !loading && vehicles.length === 0;

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="pulse-dot bg-primary" />
          <span className="font-mono text-xs uppercase tracking-wider text-primary">Live console</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Fleet command</h1>
        <p className="mt-1 text-muted-foreground">Real-time telemetry, AI risk scoring, and operational health for every vehicle.</p>
      </header>

      {empty && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="glass relative mb-6 overflow-hidden rounded-3xl p-8 md:p-12">
          <div className="absolute inset-0 grid-bg opacity-40" />
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-xs text-primary">
              <Sparkles className="h-3 w-3" /> Demo mode
            </div>
            <h2 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">
              Bring your fleet to life in <span className="gradient-text">one click.</span>
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              We'll spin up 6 demo vehicles, push synthetic telemetry, and run the AI risk model — so you can
              explore every screen with real, moving data.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
              <Step icon={Cpu} label="Seed 6 vehicles" />
              <Step icon={Zap} label="Stream telemetry" />
              <Step icon={Brain} label="Score AI risk" />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={launchDemo} disabled={launching}
                className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 glow-primary">
                <Rocket className="mr-2 h-4 w-4" />
                {launching ? "Launching…" : "Launch demo fleet"}
              </Button>
              <Link to="/app/vehicles">
                <Button size="lg" variant="outline">Add a real vehicle</Button>
              </Link>
            </div>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              Telemetry continues to stream automatically every minute.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <s.icon className={cn("h-4 w-4",
                s.tone === "destructive" && "text-destructive",
                s.tone === "warning" && "text-warning",
                s.tone === "primary" && "text-primary")} />
            </div>
            <div className="mt-3 font-mono text-2xl font-semibold">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* LIVE MAP — replaces the old 3D scene */}
        <div className="glass relative overflow-hidden rounded-2xl lg:col-span-2 h-[520px]">
          <div className="absolute left-4 top-4 z-[500] rounded-lg bg-background/70 px-3 py-2 backdrop-blur">
            <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Live map</div>
            <div className="font-mono text-xs text-primary flex items-center gap-1.5">
              <span className="pulse-dot bg-primary" />
              {vehicles.length} vehicles · trails · projected paths
            </div>
          </div>
          {loading ? (
            <div className="grid h-full place-items-center text-muted-foreground">Loading fleet…</div>
          ) : (
            <FleetMap height="100%" />
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Risk leaderboard</h3>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4 space-y-2 max-h-[440px] overflow-auto">
            {vehicles.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Launch the demo fleet to see live risk scoring here.
              </div>
            )}
            {vehicles.map((v) => {
              const p = predictions[v.id];
              const t = telemetry[v.id];
              const r = p?.risk ?? "low";
              const hs = p?.health_score ?? 100;
              return (
                <Link key={v.id} to={`/app/vehicles/${v.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 hover:bg-secondary/60 transition">
                  <div>
                    <div className="font-mono text-sm font-semibold">{v.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{v.plate}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase",
                      r === "high" && "bg-destructive/20 text-destructive",
                      r === "medium" && "bg-warning/20 text-warning",
                      r === "low" && "bg-primary/20 text-primary")}>
                      <span className={cn("pulse-dot", r === "high" && "bg-destructive", r === "medium" && "bg-warning", r === "low" && "bg-primary")} />
                      {r}
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                      health {hs}{t?.engine_temp != null ? ` · ${Math.round(t.engine_temp)}°C` : ""}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
