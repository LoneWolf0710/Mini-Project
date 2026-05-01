// Driver-focused mobile-friendly view: my vehicle today
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLatestPredictions, useLatestTelemetry, useVehicles } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { Truck, Activity, AlertTriangle, Wrench, Fuel, Gauge, HeartPulse, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

export default function MyVehicle() {
  const { user, isStaff } = useAuth();
  const { vehicles } = useVehicles();
  const telemetry = useLatestTelemetry();
  const predictions = useLatestPredictions();
  const [driverId, setDriverId] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ ts: string; score: number }[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [score, setScore] = useState<{ score: number; harsh_accel: number; over_speed: number; idle_minutes: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("drivers").select("id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setDriverId(data?.id ?? null);
    });
  }, [user]);

  const myVehicle = vehicles.find((v) => v.assigned_driver_id === driverId);

  useEffect(() => {
    if (!driverId) return;
    supabase.from("driver_scores").select("*").eq("driver_id", driverId).maybeSingle()
      .then(({ data }) => setScore(data as any));
  }, [driverId]);

  useEffect(() => {
    if (!myVehicle) return;
    supabase.from("alerts").select("*").eq("vehicle_id", myVehicle.id).order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setAlerts(data ?? []));
    // Predictions history for trend mini-chart
    supabase.from("maintenance_predictions").select("predicted_at, health_score").eq("vehicle_id", myVehicle.id)
      .order("predicted_at", { ascending: true }).limit(50)
      .then(({ data }) => setScoreHistory((data ?? []).map((p: any) => ({ ts: p.predicted_at, score: p.health_score }))));
  }, [myVehicle?.id]);

  const ack = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ is_resolved: true, resolved_by: user?.id, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Acknowledged");
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_resolved: true } : a));
  };

  if (isStaff && !driverId) {
    return (
      <div className="p-6 md:p-10">
        <div className="glass mx-auto max-w-md rounded-2xl p-8 text-center">
          <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No driver record linked</h2>
          <p className="mt-1 text-sm text-muted-foreground">This view is for drivers with an assigned vehicle.</p>
          <Link to="/app/dashboard"><Button className="mt-4">Go to dashboard</Button></Link>
        </div>
      </div>
    );
  }

  if (!myVehicle) {
    return (
      <div className="p-6">
        <div className="glass mx-auto max-w-md rounded-2xl p-8 text-center">
          <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">No vehicle assigned</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ask your fleet manager to assign you a vehicle.</p>
        </div>
      </div>
    );
  }

  const t = telemetry[myVehicle.id];
  const p = predictions[myVehicle.id];
  const openAlerts = alerts.filter((a) => !a.is_resolved);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><span className="pulse-dot bg-primary" />My vehicle</div>
        <h1 className="font-mono text-2xl font-bold">{myVehicle.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">{myVehicle.plate} · {myVehicle.vehicle_type} · {myVehicle.status}</p>
      </header>

      {/* Hero stats */}
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={HeartPulse} label="Health" value={p?.health_score != null ? `${p.health_score}/100` : "—"}
          tone={p?.health_score != null && p.health_score < 60 ? "destructive" : p?.health_score != null && p.health_score < 80 ? "warning" : "primary"} />
        <Stat icon={Activity} label="My score" value={score ? `${Math.round(score.score)}/100` : "—"} tone="primary" />
        <Stat icon={Fuel} label="Fuel" value={t?.fuel_level != null ? `${Math.round(t.fuel_level)}%` : "—"}
          tone={t?.fuel_level != null && t.fuel_level < 20 ? "warning" : "primary"} />
        <Stat icon={Gauge} label="Speed" value={t?.speed != null ? `${Math.round(t.speed)} km/h` : "—"} tone="primary" />
      </div>

      {/* Health trend */}
      {scoreHistory.length > 1 && (
        <div className="glass mt-4 rounded-2xl p-5">
          <h3 className="mb-2 text-sm font-semibold">Health trend</h3>
          <div className="h-24">
            <ResponsiveContainer><LineChart data={scoreHistory}>
              <YAxis hide domain={[0, 100]} />
              <Line type="monotone" dataKey="score" stroke="#10f5b1" strokeWidth={2} dot={false} />
            </LineChart></ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Driver behavior */}
      {score && (
        <div className="glass mt-4 rounded-2xl p-5">
          <h3 className="mb-3 text-sm font-semibold">My behavior</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="font-mono text-xl font-bold">{score.harsh_accel}</div><div className="text-[10px] uppercase text-muted-foreground">Harsh accel</div></div>
            <div><div className="font-mono text-xl font-bold">{score.over_speed}</div><div className="text-[10px] uppercase text-muted-foreground">Over speed</div></div>
            <div><div className="font-mono text-xl font-bold">{Math.round(score.idle_minutes)}</div><div className="text-[10px] uppercase text-muted-foreground">Idle min</div></div>
          </div>
        </div>
      )}

      {/* Open alerts */}
      <div className="glass mt-4 rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">My alerts</h3>
          <span className="font-mono text-xs text-muted-foreground">{openAlerts.length} open</span>
        </div>
        {openAlerts.length === 0 && <div className="text-sm text-muted-foreground">All clear ✓</div>}
        {openAlerts.map((a) => (
          <div key={a.id} className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-border p-3">
            <div className="flex-1 text-sm">
              <div className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] uppercase",
                a.severity === "critical" && "bg-destructive/20 text-destructive",
                a.severity === "warning" && "bg-warning/20 text-warning")}>{a.severity}</div>
              <div className="mt-1">{a.message}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => ack(a.id)}>OK</Button>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link to={`/app/vehicles/${myVehicle.id}`}><Button variant="outline" className="w-full"><Wrench className="mr-2 h-4 w-4" />Vehicle detail</Button></Link>
        <Link to={`/app/replay/${myVehicle.id}`}><Button variant="outline" className="w-full"><Route className="mr-2 h-4 w-4" />Today's trip</Button></Link>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary" | "warning" | "destructive" }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", tone === "destructive" && "text-destructive", tone === "warning" && "text-warning", tone === "primary" && "text-primary")} />
      </div>
      <div className="mt-1 font-mono text-2xl font-bold">{value}</div>
    </div>
  );
}
