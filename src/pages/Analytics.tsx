import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLatestPredictions, useLatestTelemetry, useVehicles } from "@/hooks/useFleet";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Analytics() {
  const { vehicles } = useVehicles();
  const telemetry = useLatestTelemetry();
  const predictions = useLatestPredictions();
  const [alertCount24h, setAlertCount24h] = useState(0);

  useEffect(() => {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    supabase.from("alerts").select("*", { count: "exact", head: true }).gte("created_at", since)
      .then(({ count }) => setAlertCount24h(count ?? 0));
  }, []);

  const riskDist = ["low", "medium", "high"].map((r) => ({
    name: r, value: Object.values(predictions).filter((p) => p.risk === r).length || 0,
  }));
  const colors = { low: "#10f5b1", medium: "#fbbf24", high: "#ef4444" } as any;

  const fuelByVehicle = vehicles.map((v) => ({
    name: v.name,
    fuel: telemetry[v.id]?.fuel_level ?? 0,
  }));

  const topRisk = vehicles
    .map((v) => ({ v, p: predictions[v.id] }))
    .filter((x) => x.p)
    .sort((a, b) => (b.p!.confidence) - (a.p!.confidence))
    .slice(0, 5);

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Fleet-wide health and operational performance.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Kpi label="Vehicles" value={vehicles.length} />
        <Kpi label="Active" value={vehicles.filter((v) => v.status === "active").length} />
        <Kpi label="In maintenance" value={vehicles.filter((v) => v.status === "maintenance").length} />
        <Kpi label="Alerts (24h)" value={alertCount24h} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Risk distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDist} dataKey="value" nameKey="name" outerRadius={80} label>
                  {riskDist.map((e) => <Cell key={e.name} fill={colors[e.name]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">Fuel level by vehicle</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fuelByVehicle}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="fuel" fill="#3bc5ff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 glass rounded-2xl p-5">
        <h3 className="mb-3 font-semibold">Top risk vehicles</h3>
        <div className="space-y-2">
          {topRisk.length === 0 && <div className="text-sm text-muted-foreground">No predictions yet.</div>}
          {topRisk.map((x) => (
            <div key={x.v.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="font-mono font-semibold">{x.v.name}</div>
                <div className="font-mono text-xs text-muted-foreground">{x.v.plate}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm uppercase">{x.p!.risk}</div>
                <div className="font-mono text-xs text-muted-foreground">{Math.round(x.p!.confidence * 100)}% conf</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-mono text-3xl font-semibold">{value}</div>
    </div>
  );
}
