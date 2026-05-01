// Route optimization with OSRM + Nominatim geocoding
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useVehicles } from "@/hooks/useFleet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Sparkles, Save, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Stop { id: string; label: string; lat: number; lng: number; }
interface Route {
  id: string;
  name: string;
  vehicle_id: string | null;
  stops: Stop[];
  geometry: { coordinates: [number, number][] } | null;
  total_distance_m: number | null;
  total_duration_s: number | null;
  status: string;
}

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => { if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 }); }, [pts.length]);
  return null;
}

function numIcon(n: number, color: string) {
  return L.divIcon({
    className: "custom-num-marker",
    html: `<div style="background:${color};color:#0a0f1a;font-family:monospace;font-weight:700;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.5)">${n}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

export default function RoutesPage() {
  const { user } = useAuth();
  const { vehicles } = useVehicles();
  const [stops, setStops] = useState<Stop[]>([]);
  const [routeName, setRouteName] = useState("New route");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [optimized, setOptimized] = useState<{ stops: Stop[]; geometry: [number, number][]; distance: number; duration: number } | null>(null);
  const [saved, setSaved] = useState<Route[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => supabase.from("planned_routes").select("*").order("created_at", { ascending: false })
    .then(({ data }) => setSaved(((data ?? []) as any[]).map((r) => ({ ...r, stops: r.stops ?? [] }))));

  useEffect(() => { load(); }, []);

  const addByAddress = async () => {
    if (!search.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(search)}`, {
        headers: { "Accept-Language": "en" },
      });
      const data = await r.json();
      if (data.length === 0) return toast.error("Address not found");
      setStops((prev) => [...prev, { id: crypto.randomUUID(), label: data[0].display_name.split(",").slice(0, 2).join(","), lat: Number(data[0].lat), lng: Number(data[0].lon) }]);
      setSearch("");
    } catch { toast.error("Geocoding failed"); }
    finally { setBusy(false); }
  };

  const optimize = async () => {
    if (stops.length < 2) return toast.error("Add at least 2 stops");
    setBusy(true);
    try {
      const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
      // OSRM trip service finds optimal order
      const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false&overview=full&geometries=geojson`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.code !== "Ok") return toast.error(data.message || "Routing failed");
      const ordered = (data.waypoints as any[]).map((w) => stops[w.waypoint_index]).filter(Boolean);
      // re-sort by waypoint_index
      const reordered = [...stops];
      data.waypoints.forEach((w: any, i: number) => { reordered[w.waypoint_index] = stops[i]; });
      const orderedStops = data.waypoints.slice().sort((a: any, b: any) => a.waypoint_index - b.waypoint_index).map((w: any) => stops[w.waypoint_index]);
      const trip = data.trips[0];
      setOptimized({
        stops: orderedStops as any,
        geometry: trip.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]),
        distance: trip.distance,
        duration: trip.duration,
      });
      toast.success("Route optimized!");
    } catch (e: any) { toast.error(e.message ?? "Optimization failed"); }
    finally { setBusy(false); }
  };

  const saveRoute = async () => {
    if (!optimized) return;
    const { error } = await supabase.from("planned_routes").insert({
      name: routeName,
      vehicle_id: vehicleId || null,
      stops: optimized.stops as any,
      geometry: { coordinates: optimized.geometry } as any,
      total_distance_m: Math.round(optimized.distance),
      total_duration_s: Math.round(optimized.duration),
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Route saved");
    load();
  };

  const deleteRoute = async (id: string) => {
    await supabase.from("planned_routes").delete().eq("id", id);
    load();
  };

  const allPoints = useMemo<[number, number][]>(() => {
    if (optimized) return optimized.geometry;
    return stops.map((s) => [s.lat, s.lng]);
  }, [stops, optimized]);

  return (
    <div className="p-6 md:p-10">
      <header className="mb-6">
        <h1 className="font-mono text-3xl font-bold">Route optimization</h1>
        <p className="font-mono text-sm text-muted-foreground">Add stops, get the optimal order via OSRM, assign to a vehicle.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="glass rounded-2xl p-5">
            <Label>Add stop by address</Label>
            <div className="mt-2 flex gap-2">
              <Input placeholder="e.g. MG Road, Bangalore" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addByAddress()} />
              <Button onClick={addByAddress} disabled={busy} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>

            <div className="mt-4 space-y-1.5">
              {stops.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 font-mono text-xs text-primary">{i + 1}</span>
                  <span className="flex-1 truncate text-xs">{s.label}</span>
                  <button onClick={() => setStops((p) => p.filter((x) => x.id !== s.id))}><X className="h-3 w-3 text-muted-foreground" /></button>
                </div>
              ))}
              {stops.length === 0 && <div className="text-xs text-muted-foreground">No stops yet.</div>}
            </div>

            <Button className="mt-4 w-full" onClick={optimize} disabled={busy || stops.length < 2}>
              <Sparkles className="mr-2 h-4 w-4" />Optimize order
            </Button>
          </div>

          {optimized && (
            <div className="glass rounded-2xl p-5">
              <h3 className="mb-3 font-semibold">Optimized result</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-xs text-muted-foreground">Distance</div><div className="font-mono">{(optimized.distance / 1000).toFixed(1)} km</div></div>
                <div><div className="text-xs text-muted-foreground">Duration</div><div className="font-mono">{Math.round(optimized.duration / 60)} min</div></div>
              </div>

              <div className="mt-4 space-y-2">
                <div><Label>Route name</Label><Input value={routeName} onChange={(e) => setRouteName(e.target.value)} /></div>
                <div>
                  <Label>Assign to vehicle</Label>
                  <Select value={vehicleId} onValueChange={setVehicleId}>
                    <SelectTrigger><SelectValue placeholder="(unassigned)" /></SelectTrigger>
                    <SelectContent>
                      {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} · {v.plate}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={saveRoute}><Save className="mr-2 h-4 w-4" />Save route</Button>
              </div>
            </div>
          )}
        </div>

        <div className="glass relative h-[600px] overflow-hidden rounded-2xl lg:col-span-2">
          {allPoints.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Add stops to see them on the map.</div>
          ) : (
            <MapContainer center={allPoints[0]} zoom={12} className="h-full w-full" style={{ background: "#0a0f1a" }} scrollWheelZoom>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap, &copy; CARTO' />
              <FitBounds pts={allPoints} />
              {optimized && <Polyline positions={optimized.geometry} pathOptions={{ color: "#10f5b1", weight: 4, opacity: 0.85 }} />}
              {(optimized?.stops ?? stops).map((s, i) => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={numIcon(i + 1, "#10f5b1")} />
              ))}
            </MapContainer>
          )}
        </div>
      </div>

      <div className="glass mt-6 rounded-2xl p-5">
        <h3 className="mb-3 font-semibold">Saved routes</h3>
        <div className="space-y-2">
          {saved.length === 0 && <div className="text-sm text-muted-foreground">No saved routes.</div>}
          {saved.map((r) => {
            const v = vehicles.find((vv) => vv.id === r.vehicle_id);
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="font-mono font-semibold">{r.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.stops.length} stops · {((r.total_distance_m ?? 0) / 1000).toFixed(1)} km · {Math.round((r.total_duration_s ?? 0) / 60)} min
                    {v && <> · <Truck className="inline h-3 w-3" /> {v.name}</>}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteRoute(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
