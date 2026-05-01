// Vehicle detail — tabbed view with overview, telemetry, predictions, trips, maintenance
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowLeft, AlertTriangle, Wrench, Activity, Route, HeartPulse, Fuel, FileDown } from "lucide-react";
import type { Vehicle, TelemetryReading, Prediction, Alert } from "@/hooks/useFleet";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { toast } from "sonner";

interface Trip { start: string; end: string; distance_km: number; avg_speed: number; max_speed: number; }

function detectTrips(readings: TelemetryReading[]): Trip[] {
  if (readings.length < 2) return [];
  const sorted = [...readings].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
  const trips: { points: TelemetryReading[] }[] = [];
  let current: TelemetryReading[] = [];
  let lastTs = 0;
  for (const r of sorted) {
    const ts = +new Date(r.ts);
    if (lastTs && ts - lastTs > 5 * 60 * 1000) {
      if (current.length > 1) trips.push({ points: current });
      current = [];
    }
    current.push(r);
    lastTs = ts;
  }
  if (current.length > 1) trips.push({ points: current });
  return trips.map(({ points }) => {
    let dist = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) continue;
      const dLat = (Number(b.lat) - Number(a.lat)) * 111;
      const dLng = (Number(b.lng) - Number(a.lng)) * 111 * Math.cos((Number(a.lat) * Math.PI) / 180);
      dist += Math.sqrt(dLat * dLat + dLng * dLng);
    }
    const speeds = points.map((p) => p.speed ?? 0);
    return {
      start: points[0].ts, end: points.at(-1)!.ts,
      distance_km: Math.round(dist * 10) / 10,
      avg_speed: Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length),
      max_speed: Math.round(Math.max(...speeds)),
    };
  });
}

export default function VehicleDetail() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [v, t, p, a] = await Promise.all([
        supabase.from("vehicles").select("*").eq("id", id).maybeSingle(),
        supabase.from("telemetry_readings").select("*").eq("vehicle_id", id).order("ts", { ascending: false }).limit(300),
        supabase.from("maintenance_predictions").select("*").eq("vehicle_id", id).order("predicted_at", { ascending: false }).limit(20),
        supabase.from("alerts").select("*").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(20),
      ]);
      setVehicle(v.data as any);
      setReadings(((t.data ?? []) as TelemetryReading[]).reverse());
      setPredictions((p.data ?? []) as any);
      setAlerts((a.data ?? []) as any);
    };
    load();
    const ch = supabase.channel(`v-${id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry_readings", filter: `vehicle_id=eq.${id}` },
        (payload) => setReadings((prev) => [...prev.slice(-299), payload.new as TelemetryReading]))
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_predictions", filter: `vehicle_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `vehicle_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const chartData = useMemo(() => readings.map((r) => ({
    t: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    engine_temp: r.engine_temp, rpm: r.rpm, fuel: r.fuel_level,
    vibration: r.vibration, battery: r.battery_voltage,
  })), [readings]);

  const trips = useMemo(() => detectTrips(readings), [readings]);

  // Fuel efficiency: km / (% fuel drop * tank_assumed)
  const fuelEff = useMemo(() => {
    let kmTotal = 0, fuelDropped = 0;
    for (let i = 1; i < readings.length; i++) {
      const a = readings[i - 1], b = readings[i];
      if (a.lat != null && b.lat != null && a.lng != null && b.lng != null) {
        const dLat = (Number(b.lat) - Number(a.lat)) * 111;
        const dLng = (Number(b.lng) - Number(a.lng)) * 111 * Math.cos(Number(a.lat) * Math.PI / 180);
        kmTotal += Math.sqrt(dLat * dLat + dLng * dLng);
      }
      const drop = (a.fuel_level ?? 0) - (b.fuel_level ?? 0);
      if (drop > 0 && drop < 5) fuelDropped += drop;
    }
    // assume 80L tank → fuel% to liters
    const liters = (fuelDropped / 100) * 80;
    return liters > 0 ? Math.round((kmTotal / liters) * 10) / 10 : null;
  }, [readings]);

  const exportPdf = async () => {
    if (!vehicle) return;
    toast.info("Building report…");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    pdf.setFontSize(18); pdf.text(`FleetIQ Vehicle Report — ${vehicle.name}`, 40, 50);
    pdf.setFontSize(10); pdf.setTextColor(120);
    pdf.text(`${vehicle.plate} · ${vehicle.vehicle_type} · ${vehicle.status}`, 40, 68);
    pdf.text(`Generated ${new Date().toLocaleString()}`, 40, 82);
    let y = 110;
    if (latest) {
      autoTable(pdf, { startY: y, head: [["Metric", "Latest"]], body: [
        ["Engine °C", String(latest.engine_temp ?? "—")],
        ["RPM", String(latest.rpm ?? "—")],
        ["Fuel %", String(latest.fuel_level ?? "—")],
        ["Vibration", String(latest.vibration ?? "—")],
        ["Battery V", String(latest.battery_voltage ?? "—")],
        ["Health score", String(latestPred?.health_score ?? "—")],
        ["AI Risk", latestPred ? `${latestPred.risk.toUpperCase()} · ${Math.round(latestPred.confidence * 100)}%` : "—"],
      ]});
      y = (pdf as any).lastAutoTable.finalY + 20;
    }
    autoTable(pdf, { startY: y, head: [["Recent predictions", "Risk", "Health", "When"]],
      body: predictions.slice(0, 10).map((p) => [p.recommended_action ?? "—", p.risk, String(p.health_score ?? 100), new Date(p.predicted_at).toLocaleString()]) });
    y = (pdf as any).lastAutoTable.finalY + 20;
    autoTable(pdf, { startY: y, head: [["Recent alerts", "Severity", "When"]],
      body: alerts.slice(0, 10).map((a) => [a.message, a.severity, new Date(a.created_at).toLocaleString()]) });
    pdf.save(`vehicle-${vehicle.plate}-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Report downloaded");
  };

  if (!vehicle) return <div className="p-10 text-muted-foreground">Loading vehicle…</div>;

  const latest = readings[readings.length - 1];
  const latestPred = predictions[0];

  return (
    <div className="p-6 md:p-10">
      <Link to="/app/vehicles" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Back to vehicles
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold">{vehicle.name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{vehicle.plate} · {vehicle.vehicle_type} · {vehicle.status}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button>
          <Link to={`/app/replay/${vehicle.id}`}><Button variant="outline" size="sm"><Route className="mr-2 h-4 w-4" />Trip replay</Button></Link>
          {latestPred?.health_score != null && (
            <div className="glass rounded-xl px-4 py-3 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Health</div>
              <div className="font-mono text-xl font-semibold">{latestPred.health_score}/100</div>
            </div>
          )}
          {latestPred && (
            <div className={cn("glass rounded-xl px-4 py-3 text-center",
              latestPred.risk === "high" && "border-destructive/40",
              latestPred.risk === "medium" && "border-warning/40")}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">AI Risk</div>
              <div className={cn("font-mono text-xl font-semibold",
                latestPred.risk === "high" && "text-destructive",
                latestPred.risk === "medium" && "text-warning",
                latestPred.risk === "low" && "text-primary")}>{latestPred.risk.toUpperCase()} · {Math.round(latestPred.confidence * 100)}%</div>
            </div>
          )}
        </div>
      </header>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview"><Activity className="mr-2 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="telemetry"><HeartPulse className="mr-2 h-4 w-4" />Telemetry</TabsTrigger>
          <TabsTrigger value="predictions"><Wrench className="mr-2 h-4 w-4" />Predictions</TabsTrigger>
          <TabsTrigger value="trips"><Route className="mr-2 h-4 w-4" />Trips</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="mr-2 h-4 w-4" />Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 md:grid-cols-5">
            <Stat label="Engine °C" v={latest?.engine_temp} />
            <Stat label="RPM" v={latest?.rpm} />
            <Stat label="Fuel %" v={latest?.fuel_level} />
            <Stat label="Vibration" v={latest?.vibration} dec={2} />
            <Stat label="Battery V" v={latest?.battery_voltage} dec={1} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Fuel className="h-3 w-3" />Fuel efficiency</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{fuelEff != null ? `${fuelEff} km/L` : "—"}</div>
              <div className="font-mono text-[10px] text-muted-foreground">est. from telemetry · 80L tank</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><Route className="h-3 w-3" />Trips today</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{trips.length}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{trips.reduce((a, b) => a + b.distance_km, 0).toFixed(1)} km total</div>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground"><AlertTriangle className="h-3 w-3" />Open alerts</div>
              <div className="mt-2 font-mono text-2xl font-semibold">{alerts.filter((a) => !a.is_resolved).length}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="telemetry" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Chart title="Engine temperature (°C)" data={chartData} dataKey="engine_temp" color="#10f5b1" />
            <Chart title="RPM" data={chartData} dataKey="rpm" color="#3bc5ff" />
            <Chart title="Fuel level (%)" data={chartData} dataKey="fuel" color="#fbbf24" />
            <Chart title="Vibration" data={chartData} dataKey="vibration" color="#f472b6" />
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="mt-4">
          <div className="space-y-2">
            {predictions.length === 0 && <div className="glass rounded-xl p-6 text-sm text-muted-foreground">No predictions yet — runs every 2 minutes.</div>}
            {predictions.map((p) => (
              <div key={p.id} className="glass rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs uppercase font-mono",
                    p.risk === "high" && "bg-destructive/20 text-destructive",
                    p.risk === "medium" && "bg-warning/20 text-warning",
                    p.risk === "low" && "bg-primary/20 text-primary")}>{p.risk}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    health {p.health_score ?? 100} · {new Date(p.predicted_at).toLocaleString()}
                  </span>
                </div>
                {p.recommended_action && <div className="mt-2 text-sm">{p.recommended_action}</div>}
                {p.reasons?.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                    {p.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-4">
          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-left">End</th>
                <th className="px-4 py-3 text-left">Distance</th>
                <th className="px-4 py-3 text-left">Avg speed</th>
                <th className="px-4 py-3 text-left">Max</th>
              </tr></thead>
              <tbody>
                {trips.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No trips detected.</td></tr>}
                {trips.slice().reverse().map((t, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3 font-mono text-xs">{new Date(t.start).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{new Date(t.end).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono">{t.distance_km} km</td>
                    <td className="px-4 py-3 font-mono">{t.avg_speed} km/h</td>
                    <td className="px-4 py-3 font-mono">{t.max_speed} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <div className="space-y-2">
            {alerts.length === 0 && <div className="glass rounded-xl p-6 text-sm text-muted-foreground">No alerts.</div>}
            {alerts.map((a) => (
              <div key={a.id} className="glass rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs uppercase font-mono",
                    a.severity === "critical" && "bg-destructive/20 text-destructive",
                    a.severity === "warning" && "bg-warning/20 text-warning",
                    a.severity === "info" && "bg-primary/20 text-primary")}>{a.severity}</span>
                  <span className="font-mono text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <div className="mt-2 text-sm">{a.message}</div>
                {a.is_resolved && <div className="mt-1 font-mono text-[10px] text-primary">RESOLVED</div>}
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, v, dec = 0 }: { label: string; v: number | null | undefined; dec?: number }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{v != null ? Number(v).toFixed(dec) : "—"}</div>
    </div>
  );
}

function Chart({ title, data, dataKey, color }: { title: string; data: any[]; dataKey: string; color: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
