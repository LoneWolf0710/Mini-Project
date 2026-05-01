import { useState } from "react";
import { Link } from "react-router-dom";
import { useVehicles, useLatestPredictions, useLatestTelemetry } from "@/hooks/useFleet";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Vehicles() {
  const { vehicles } = useVehicles();
  const predictions = useLatestPredictions();
  const telemetry = useLatestTelemetry();
  const { isStaff } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", plate: "", vehicle_type: "truck", status: "active" });

  const filtered = vehicles.filter((v) =>
    v.name.toLowerCase().includes(q.toLowerCase()) || v.plate.toLowerCase().includes(q.toLowerCase()));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("vehicles").insert({
      name: form.name, plate: form.plate, vehicle_type: form.vehicle_type, status: form.status as any,
    });
    if (error) toast.error(error.message);
    else { toast.success("Vehicle added"); setOpen(false); setForm({ name: "", plate: "", vehicle_type: "truck", status: "active" }); }
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vehicles</h1>
          <p className="mt-1 text-muted-foreground">Manage your fleet inventory.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9 w-60" placeholder="Search name or plate" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Add vehicle</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New vehicle</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-4">
                  <div><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="TRK-05" /></div>
                  <div><Label>Plate</Label><Input required value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="ABC-1234" /></div>
                  <div><Label>Type</Label>
                    <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="truck">Truck</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="bus">Bus</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="idle">Idle</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full">Create</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Vehicle</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Engine °C</th>
              <th className="px-4 py-3 text-left">Fuel</th>
              <th className="px-4 py-3 text-left">Risk</th>
              <th className="px-4 py-3 text-left">Odometer</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const t = telemetry[v.id];
              const p = predictions[v.id];
              const r = p?.risk ?? "low";
              return (
                <tr key={v.id} className="border-t border-border hover:bg-secondary/30 transition">
                  <td className="px-4 py-3">
                    <Link to={`/app/vehicles/${v.id}`} className="block">
                      <div className="font-mono font-semibold">{v.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{v.plate} · {v.vehicle_type}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs",
                      v.status === "active" && "bg-primary/20 text-primary",
                      v.status === "idle" && "bg-muted text-muted-foreground",
                      v.status === "maintenance" && "bg-warning/20 text-warning")}>{v.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono">{t?.engine_temp != null ? Math.round(t.engine_temp) : "—"}</td>
                  <td className="px-4 py-3 font-mono">{t?.fuel_level != null ? `${Math.round(t.fuel_level)}%` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs uppercase",
                      r === "high" && "bg-destructive/20 text-destructive",
                      r === "medium" && "bg-warning/20 text-warning",
                      r === "low" && "bg-primary/20 text-primary")}>{r}</span>
                  </td>
                  <td className="px-4 py-3 font-mono">{Math.round(v.odometer).toLocaleString()} km</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No vehicles match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
