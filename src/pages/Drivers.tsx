// Drivers page — driver behavior leaderboard derived from telemetry
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { RefreshCw, Award, Gauge, Timer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DriverRow {
  driver_id: string;
  display_name: string;
  vehicle: string | null;
  harsh_accel: number;
  over_speed: number;
  idle_minutes: number;
  score: number;
}

export default function Drivers() {
  const { vehicles } = useVehicles();
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [busy, setBusy] = useState(false);

  const recompute = async () => {
    setBusy(true);
    try {
      // 1) drivers + profiles
      const { data: drivers } = await supabase.from("drivers").select("id, user_id");
      const userIds = (drivers ?? []).map((d) => d.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name]));

      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const out: DriverRow[] = [];
      for (const d of drivers ?? []) {
        const vehicle = vehicles.find((v) => v.assigned_driver_id === d.id);
        if (!vehicle) {
          out.push({ driver_id: d.id, display_name: pMap[d.user_id] ?? "Unknown", vehicle: null, harsh_accel: 0, over_speed: 0, idle_minutes: 0, score: 100 });
          continue;
        }
        const { data: readings } = await supabase
          .from("telemetry_readings").select("ts, speed, rpm")
          .eq("vehicle_id", vehicle.id).gte("ts", since)
          .order("ts", { ascending: true }).limit(2000);
        let harsh = 0, over = 0, idle = 0;
        const r = (readings ?? []) as any[];
        for (let i = 1; i < r.length; i++) {
          const dt = (new Date(r[i].ts).getTime() - new Date(r[i - 1].ts).getTime()) / 1000;
          if (!dt || dt > 300) continue;
          const dv = (r[i].speed ?? 0) - (r[i - 1].speed ?? 0);
          if (dv / dt > 4) harsh++;       // > 4 km/h per sec ≈ harsh accel
          if ((r[i].speed ?? 0) > 100) over++;
          if ((r[i].rpm ?? 0) < 800 && (r[i].speed ?? 0) < 3) idle += dt / 60;
        }
        const score = Math.max(0, 100 - harsh * 2 - over * 1 - Math.round(idle / 5));
        out.push({
          driver_id: d.id, display_name: pMap[d.user_id] ?? "Unknown",
          vehicle: vehicle.name, harsh_accel: harsh, over_speed: over,
          idle_minutes: Math.round(idle), score,
        });
        // upsert cache
        await supabase.from("driver_scores").upsert({
          driver_id: d.id, harsh_accel: harsh, over_speed: over, idle_minutes: idle, score, updated_at: new Date().toISOString(),
        });
      }
      setRows(out.sort((a, b) => b.score - a.score));
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    // initial: load cached scores joined with profiles
    (async () => {
      const { data: drivers } = await supabase.from("drivers").select("id, user_id");
      const { data: scores } = await supabase.from("driver_scores").select("*");
      const sMap = Object.fromEntries((scores ?? []).map((s: any) => [s.driver_id, s]));
      const userIds = (drivers ?? []).map((d) => d.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
        : { data: [] as any[] };
      const pMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.display_name]));
      const out: DriverRow[] = (drivers ?? []).map((d: any) => {
        const v = vehicles.find((vv) => vv.assigned_driver_id === d.id);
        const s = sMap[d.id];
        return {
          driver_id: d.id, display_name: pMap[d.user_id] ?? "Unknown",
          vehicle: v?.name ?? null,
          harsh_accel: s?.harsh_accel ?? 0, over_speed: s?.over_speed ?? 0,
          idle_minutes: Math.round(s?.idle_minutes ?? 0), score: s?.score ?? 100,
        };
      });
      setRows(out.sort((a, b) => b.score - a.score));
    })();
  }, [vehicles]);

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drivers</h1>
          <p className="text-muted-foreground">Behavior scoring from the last 24h of telemetry.</p>
        </div>
        <Button onClick={recompute} disabled={busy}>
          <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />Recompute scores
        </Button>
      </header>

      <div className="grid gap-3 md:grid-cols-3 mb-6">
        <Mini icon={Award} label="Best driver" value={rows[0]?.display_name ?? "—"} sub={rows[0] ? `${rows[0].score}/100` : ""} />
        <Mini icon={Gauge} label="Total over-speed" value={String(rows.reduce((a, b) => a + b.over_speed, 0))} sub="events / 24h" />
        <Mini icon={Timer} label="Total idle" value={`${Math.round(rows.reduce((a, b) => a + b.idle_minutes, 0))} min`} sub="across fleet" />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-3 text-left">Driver</th>
            <th className="px-4 py-3 text-left">Vehicle</th>
            <th className="px-4 py-3 text-left">Harsh accel</th>
            <th className="px-4 py-3 text-left">Over-speed</th>
            <th className="px-4 py-3 text-left">Idle (min)</th>
            <th className="px-4 py-3 text-left">Score</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No driver records yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.driver_id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{r.display_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.vehicle ?? "—"}</td>
                <td className="px-4 py-3 font-mono">{r.harsh_accel}</td>
                <td className="px-4 py-3 font-mono">{r.over_speed}</td>
                <td className="px-4 py-3 font-mono">{r.idle_minutes}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 font-mono text-xs",
                    r.score >= 85 && "bg-primary/20 text-primary",
                    r.score >= 60 && r.score < 85 && "bg-warning/20 text-warning",
                    r.score < 60 && "bg-destructive/20 text-destructive")}>{r.score}/100</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 font-mono text-xl font-semibold">{value}</div>
      {sub && <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
