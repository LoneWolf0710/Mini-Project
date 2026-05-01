// Time-travel map: scrub through a vehicle's day with animated marker + telemetry gauges
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pause, Play, CalendarIcon, Truck } from "lucide-react";
import L from "leaflet";
import { format } from "date-fns";
import { useVehicles, type TelemetryReading } from "@/hooks/useFleet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [points.length]);
  return null;
}

export default function TripReplay() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { vehicles } = useVehicles();
  const [day, setDay] = useState<Date>(new Date());
  const [readings, setReadings] = useState<TelemetryReading[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const timer = useRef<number | null>(null);

  // Default to first vehicle if no id
  useEffect(() => {
    if (!vehicleId && vehicles.length > 0) navigate(`/app/replay/${vehicles[0].id}`, { replace: true });
  }, [vehicleId, vehicles, navigate]);

  useEffect(() => {
    if (!vehicleId) return;
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day); end.setHours(23, 59, 59, 999);
    supabase
      .from("telemetry_readings")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .gte("ts", start.toISOString())
      .lte("ts", end.toISOString())
      .order("ts", { ascending: true })
      .limit(2000)
      .then(({ data }) => {
        const rows = ((data ?? []) as TelemetryReading[]).filter((r) => r.lat != null && r.lng != null);
        setReadings(rows);
        setIdx(0);
        setPlaying(false);
      });
  }, [vehicleId, day]);

  useEffect(() => {
    if (!playing) {
      if (timer.current) window.clearInterval(timer.current);
      return;
    }
    timer.current = window.setInterval(() => {
      setIdx((i) => {
        if (i >= readings.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, Math.max(40, 400 / speed));
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, speed, readings.length]);

  const path = useMemo(
    () => readings.map((r) => [Number(r.lat), Number(r.lng)] as [number, number]),
    [readings]
  );
  const traveled = path.slice(0, idx + 1);
  const current = readings[idx];
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const stats = useMemo(() => {
    if (readings.length < 2) return { km: 0, maxSpeed: 0, avgSpeed: 0, fuelDelta: 0 };
    let km = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    for (let i = 1; i < readings.length; i++) {
      const a = readings[i - 1], b = readings[i];
      const dLat = (Number(b.lat) - Number(a.lat)) * 111;
      const dLng = (Number(b.lng) - Number(a.lng)) * 111 * Math.cos((Number(a.lat) * Math.PI) / 180);
      km += Math.sqrt(dLat * dLat + dLng * dLng);
      maxSpeed = Math.max(maxSpeed, b.speed ?? 0);
      speedSum += b.speed ?? 0;
    }
    return {
      km: Math.round(km * 10) / 10,
      maxSpeed: Math.round(maxSpeed),
      avgSpeed: Math.round(speedSum / (readings.length - 1)),
      fuelDelta: Math.round(((readings[0].fuel_level ?? 0) - (readings.at(-1)?.fuel_level ?? 0)) * 10) / 10,
    };
  }, [readings]);

  return (
    <div className="p-6 md:p-10">
      <Link to="/app/vehicles" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-bold">Trip replay</h1>
          <p className="font-mono text-sm text-muted-foreground">Time-travel through a vehicle's day.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={vehicleId} onValueChange={(v) => navigate(`/app/replay/${v}`)}>
            <SelectTrigger className="w-[220px]"><Truck className="mr-2 h-4 w-4" /><SelectValue placeholder="Vehicle" /></SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} · {v.plate}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="font-mono"><CalendarIcon className="mr-2 h-4 w-4" />{format(day, "PPP")}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar mode="single" selected={day} onSelect={(d) => d && setDay(d)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Distance" v={`${stats.km} km`} />
        <Stat label="Avg speed" v={`${stats.avgSpeed} km/h`} />
        <Stat label="Max speed" v={`${stats.maxSpeed} km/h`} />
        <Stat label="Fuel used" v={`${stats.fuelDelta}%`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass relative h-[500px] overflow-hidden rounded-2xl lg:col-span-2">
          {path.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              No telemetry recorded for {vehicle?.name ?? "this vehicle"} on {format(day, "PPP")}.
            </div>
          ) : (
            <MapContainer center={path[0]} zoom={13} className="h-full w-full" style={{ background: "#0a0f1a" }} scrollWheelZoom>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; OpenStreetMap, &copy; CARTO' />
              <FitBounds points={path} />
              <Polyline positions={path} pathOptions={{ color: "#3bc5ff", opacity: 0.35, weight: 3 }} />
              <Polyline positions={traveled} pathOptions={{ color: "#10f5b1", opacity: 0.95, weight: 4 }} />
              {current && current.lat != null && current.lng != null && (
                <CircleMarker
                  center={[Number(current.lat), Number(current.lng)]}
                  radius={10}
                  pathOptions={{ color: "#10f5b1", fillColor: "#10f5b1", fillOpacity: 0.95, weight: 3 }}
                />
              )}
            </MapContainer>
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold">Live telemetry</h3>
          <Gauge label="Speed" value={current?.speed} unit="km/h" />
          <Gauge label="Engine temp" value={current?.engine_temp} unit="°C" />
          <Gauge label="RPM" value={current?.rpm} unit="" />
          <Gauge label="Fuel" value={current?.fuel_level} unit="%" />
          <Gauge label="Vibration" value={current?.vibration} unit="" decimals={2} />
          <div className="font-mono text-[10px] text-muted-foreground">
            {current ? new Date(current.ts).toLocaleTimeString() : "—"} · frame {idx + 1}/{readings.length || 0}
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <div className="glass mt-6 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="outline" onClick={() => setPlaying((p) => !p)} disabled={readings.length === 0}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Slider min={0} max={Math.max(0, readings.length - 1)} step={1} value={[idx]} onValueChange={([v]) => setIdx(v)} className="flex-1" />
          <div className="flex gap-1">
            {[1, 4, 16].map((s) => (
              <Button key={s} size="sm" variant={speed === s ? "default" : "outline"} onClick={() => setSpeed(s)} className="font-mono">
                {s}x
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold">{v}</div>
    </div>
  );
}

function Gauge({ label, value, unit, decimals = 0 }: { label: string; value: number | null | undefined; unit: string; decimals?: number }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-base font-semibold">
        {value != null ? Number(value).toFixed(decimals) : "—"} <span className="text-[10px] text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}
