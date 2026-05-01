import { useEffect, useState } from "react";
import FleetMap from "@/components/FleetMap";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function MapPage() {
  const { isStaff } = useAuth();
  const [showTrails, setShowTrails] = useState(true);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showProjected, setShowProjected] = useState(true);
  const [zones, setZones] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "Depot", center_lat: "", center_lng: "", radius_m: 500 });

  const load = () => supabase.from("geofences").select("*").order("created_at", { ascending: false })
    .then(({ data }) => setZones(data ?? []));
  useEffect(() => {
    load();
    const ch = supabase.channel(`zones-page-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "geofences" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(form.center_lat), lng = Number(form.center_lng), r = Number(form.radius_m);
    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(r)) { toast.error("Invalid coordinates"); return; }
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("geofences").insert({
      name: form.name, center_lat: lat, center_lng: lng, radius_m: r, created_by: user?.id,
    });
    if (error) toast.error(error.message); else { toast.success("Zone created"); setOpen(false); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("geofences").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("Zone removed");
  };

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live map</h1>
          <p className="text-muted-foreground">2D map of every vehicle — past hour trail, projected next path, and zones.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Toggle label="Trails" checked={showTrails} onChange={setShowTrails} />
          <Toggle label="Projected" checked={showProjected} onChange={setShowProjected} />
          <Toggle label="Zones" checked={showGeofences} onChange={setShowGeofences} />
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                  <Plus className="mr-1 h-4 w-4" />Add zone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New geofence zone</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Lat</Label><Input value={form.center_lat} onChange={(e) => setForm({ ...form, center_lat: e.target.value })} placeholder="12.97" /></div>
                    <div><Label>Lng</Label><Input value={form.center_lng} onChange={(e) => setForm({ ...form, center_lng: e.target.value })} placeholder="77.59" /></div>
                  </div>
                  <div><Label>Radius (m)</Label><Input type="number" value={form.radius_m} onChange={(e) => setForm({ ...form, radius_m: Number(e.target.value) })} /></div>
                  <Button type="submit" className="w-full">Create zone</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="glass overflow-hidden rounded-2xl h-[72vh]">
          <FleetMap height="100%" showTrails={showTrails} showGeofences={showGeofences} showNextTripPreview={showProjected} />
        </div>

        <aside className="glass rounded-2xl p-4">
          <h3 className="font-semibold">Zones</h3>
          <div className="mt-3 space-y-2 max-h-[68vh] overflow-auto">
            {zones.length === 0 && <div className="text-xs text-muted-foreground">No zones yet.</div>}
            {zones.map((z) => (
              <div key={z.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm font-semibold">{z.name}</div>
                  {isStaff && (
                    <button onClick={() => remove(z.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {Number(z.center_lat).toFixed(4)}, {Number(z.center_lng).toFixed(4)} · {z.radius_m}m
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
