// Maintenance scheduler with month calendar + auto-suggest from high-risk predictions
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles, useLatestPredictions } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ChevronLeft, ChevronRight, Plus, Sparkles, CheckCircle2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Schedule {
  id: string;
  vehicle_id: string;
  scheduled_for: string;
  maintenance_type: string;
  status: string;
  notes: string | null;
}

export default function Scheduler() {
  const { user } = useAuth();
  const { vehicles } = useVehicles();
  const predictions = useLatestPredictions();
  const [month, setMonth] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ vehicle_id: string; scheduled_for: Date; maintenance_type: string; notes: string }>({
    vehicle_id: "",
    scheduled_for: new Date(),
    maintenance_type: "Oil change",
    notes: "",
  });

  const load = () => {
    supabase.from("maintenance_schedules").select("*").order("scheduled_for", { ascending: true })
      .then(({ data }) => setSchedules((data ?? []) as any));
  };
  useEffect(() => { load(); }, []);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  const byDay = useMemo(() => {
    const map: Record<string, Schedule[]> = {};
    schedules.forEach((s) => {
      const k = format(new Date(s.scheduled_for), "yyyy-MM-dd");
      (map[k] ??= []).push(s);
    });
    return map;
  }, [schedules]);

  const highRiskVehicles = useMemo(
    () => vehicles.filter((v) => predictions[v.id]?.risk === "high" && !schedules.some((s) => s.vehicle_id === v.id && s.status === "pending")),
    [vehicles, predictions, schedules]
  );

  const create = async () => {
    if (!form.vehicle_id) return toast.error("Pick a vehicle");
    const { error } = await supabase.from("maintenance_schedules").insert({
      vehicle_id: form.vehicle_id,
      scheduled_for: form.scheduled_for.toISOString(),
      maintenance_type: form.maintenance_type,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Scheduled");
    setOpen(false);
    load();
  };

  const autoSchedule = async (vehicleId: string) => {
    const { error } = await supabase.from("maintenance_schedules").insert({
      vehicle_id: vehicleId,
      scheduled_for: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      maintenance_type: "AI-recommended inspection",
      notes: "Auto-suggested from high-risk prediction",
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Scheduled in 2 days");
    load();
  };

  const complete = async (s: Schedule) => {
    const { error: e1 } = await supabase.from("maintenance_records").insert({
      vehicle_id: s.vehicle_id,
      maintenance_type: s.maintenance_type,
      notes: s.notes,
      created_by: user?.id ?? null,
    });
    if (e1) return toast.error(e1.message);
    await supabase.from("maintenance_schedules").update({ status: "completed" }).eq("id", s.id);
    toast.success("Marked complete & logged");
    load();
  };

  const cancel = async (id: string) => {
    await supabase.from("maintenance_schedules").update({ status: "cancelled" }).eq("id", id);
    load();
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold">Maintenance scheduler</h1>
          <p className="font-mono text-sm text-muted-foreground">Plan upcoming services. AI suggests services for high-risk vehicles.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-[160px] text-center font-mono">{format(month, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Schedule</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule maintenance</DialogTitle></DialogHeader>
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
                <div>
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(form.scheduled_for, "PPP")}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={form.scheduled_for} onSelect={(d) => d && setForm({ ...form, scheduled_for: d })} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Type</Label>
                  <Input value={form.maintenance_type} onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button className="w-full" onClick={create}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {highRiskVehicles.length > 0 && (
        <div className="glass mb-6 rounded-2xl border border-warning/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-warning" />
            <span className="font-semibold">AI suggests scheduling these high-risk vehicles:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {highRiskVehicles.map((v) => (
              <Button key={v.id} size="sm" variant="outline" onClick={() => autoSchedule(v.id)}>
                <Plus className="mr-1 h-3 w-3" />{v.name} ({v.plate})
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-7 border-b border-border bg-secondary/30 text-xs uppercase">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
            <div key={d} className="px-3 py-2 font-semibold text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {(() => {
            const startWeekday = (days[0].getDay() + 6) % 7; // Mon = 0
            return Array.from({ length: startWeekday }).map((_, i) => <div key={`pad-${i}`} className="min-h-[110px] border-b border-r border-border" />);
          })()}
          {days.map((d) => {
            const k = format(d, "yyyy-MM-dd");
            const items = (byDay[k] ?? []).filter((s) => s.status !== "cancelled");
            const today = isSameDay(d, new Date());
            return (
              <div key={k} className={cn("min-h-[110px] border-b border-r border-border p-2", !isSameMonth(d, month) && "opacity-40", today && "bg-primary/5")}>
                <div className={cn("font-mono text-xs", today && "font-bold text-primary")}>{format(d, "d")}</div>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 3).map((s) => {
                    const v = vehicles.find((vv) => vv.id === s.vehicle_id);
                    return (
                      <div key={s.id} className={cn("group flex items-center justify-between gap-1 truncate rounded px-1.5 py-0.5 text-[10px]",
                        s.status === "completed" ? "bg-primary/15 text-primary line-through" : "bg-warning/15 text-warning")}>
                        <span className="truncate font-mono">{v?.plate ?? "?"} · {s.maintenance_type}</span>
                        {s.status === "pending" && (
                          <button onClick={() => complete(s)} className="opacity-0 group-hover:opacity-100">
                            <CheckCircle2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="glass mt-6 rounded-2xl p-5">
        <h3 className="mb-3 font-semibold">Upcoming (next 14 days)</h3>
        <div className="space-y-2">
          {schedules.filter((s) => s.status === "pending" && new Date(s.scheduled_for) > new Date() && new Date(s.scheduled_for) < new Date(Date.now() + 14 * 86400000)).map((s) => {
            const v = vehicles.find((vv) => vv.id === s.vehicle_id);
            return (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-mono text-sm">{v?.name} · {v?.plate}</div>
                  <div className="font-mono text-xs text-muted-foreground">{format(new Date(s.scheduled_for), "PPP")} · {s.maintenance_type}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => complete(s)}>Complete</Button>
                  <Button size="sm" variant="ghost" onClick={() => cancel(s.id)}>Cancel</Button>
                </div>
              </div>
            );
          })}
          {schedules.filter((s) => s.status === "pending").length === 0 && (
            <div className="text-sm text-muted-foreground">No upcoming maintenance.</div>
          )}
        </div>
      </div>
    </div>
  );
}
