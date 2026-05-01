import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Cpu, Play } from "lucide-react";

export default function AdminSimulator() {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(6);
  const [tick, setTick] = useState(0);

  const seed = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("seed-fleet", { body: { count } });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success(`Seeded ${data?.created ?? 0} vehicles`);
  };

  const simulate = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("simulate-telemetry", { body: { ticks: 10 } });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success(`Inserted ${data?.inserted ?? 0} readings`); setTick(t => t + 1); }
  };

  const predict = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("predict-maintenance", {});
    setBusy(false);
    if (error) toast.error(error.message); else toast.success(`Scored ${data?.scored ?? 0} vehicles`);
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Simulator & API</h1>
        <p className="text-muted-foreground">Spin up demo vehicles, push synthetic telemetry, and score risk on demand.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-6">
          <Cpu className="h-6 w-6 text-primary" />
          <h3 className="mt-3 font-semibold">1 — Seed demo fleet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Creates demo vehicles around a city center.</p>
          <div className="mt-4"><Label>Vehicle count</Label><Input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
          <Button className="mt-4 w-full" onClick={seed} disabled={busy}>Seed fleet</Button>
        </div>
        <div className="glass rounded-2xl p-6">
          <Play className="h-6 w-6 text-accent" />
          <h3 className="mt-3 font-semibold">2 — Push telemetry</h3>
          <p className="mt-1 text-sm text-muted-foreground">Pushes 10 simulated readings per active vehicle.</p>
          <Button className="mt-4 w-full" onClick={simulate} disabled={busy}>Simulate</Button>
          <div className="mt-2 font-mono text-xs text-muted-foreground">Runs: {tick}</div>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="mt-3 font-semibold">3 — Run AI predictions</h3>
          <p className="mt-1 text-sm text-muted-foreground">Scores all vehicles using rolling z-score & trend rules.</p>
          <Button className="mt-4 w-full" onClick={predict} disabled={busy}>Score now</Button>
        </div>
      </div>

      <div className="mt-8 glass rounded-2xl p-6">
        <h3 className="font-semibold">Public ingest endpoint</h3>
        <p className="mt-1 text-sm text-muted-foreground">Send live telemetry from Arduino, ESP32, or any HTTP client.</p>
        <pre className="mt-3 overflow-auto rounded-lg bg-secondary/40 p-3 font-mono text-xs">
{`POST ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-telemetry
Content-Type: application/json

{
  "vehicle_plate": "TRK-01",
  "engine_temp": 92, "rpm": 2100, "fuel_level": 64,
  "vibration": 0.42, "battery_voltage": 12.6, "speed": 58,
  "lat": 12.97, "lng": 77.59
}`}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">No API key required for the demo. Add `vehicle_id` instead of `vehicle_plate` if you have it.</p>
      </div>
    </div>
  );
}
