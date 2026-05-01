import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useVehicles } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export default function Maintenance() {
  const { vehicles } = useVehicles();
  const [records, setRecords] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vehicle_id: "", maintenance_type: "Oil change", cost: 0, notes: "" });

  const load = async () => {
    const { data } = await supabase.from("maintenance_records").select("*").order("performed_at", { ascending: false });
    setRecords(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicle_id) { toast.error("Pick a vehicle"); return; }
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("maintenance_records").insert({
      vehicle_id: form.vehicle_id, maintenance_type: form.maintenance_type,
      cost: Number(form.cost) || 0, notes: form.notes, created_by: user?.id ?? null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Maintenance logged"); setOpen(false); load(); }
  };

  const vMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
          <p className="text-muted-foreground">Service log for the fleet.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Log service</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New maintenance record</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-4">
              <div><Label>Vehicle</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>{vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label><Input value={form.maintenance_type} onChange={(e) => setForm({ ...form, maintenance_type: e.target.value })} /></div>
              <div><Label>Cost</Label><Input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="glass overflow-hidden rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Vehicle</th>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Cost</th>
            <th className="px-4 py-3 text-left">Notes</th>
          </tr></thead>
          <tbody>
            {records.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No records yet.</td></tr>}
            {records.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono">{r.performed_at}</td>
                <td className="px-4 py-3 font-mono">{vMap[r.vehicle_id]?.name ?? "—"}</td>
                <td className="px-4 py-3">{r.maintenance_type}</td>
                <td className="px-4 py-3 font-mono">${Number(r.cost).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
