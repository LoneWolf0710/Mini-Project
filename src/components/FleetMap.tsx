import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import { useLatestPredictions, useLatestTelemetry, useVehicles, useVehicleTrails, riskHex, type Vehicle } from "@/hooks/useFleet";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

// Fix default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function FitBounds({ points, deps }: { points: [number, number][]; deps: any[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const b = L.latLngBounds(points);
    map.fitBounds(b, { padding: [40, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}

interface FleetMapProps {
  height?: string;
  showTrails?: boolean;
  showGeofences?: boolean;
  showNextTripPreview?: boolean;
  className?: string;
}

export default function FleetMap({
  height = "100%",
  showTrails = true,
  showGeofences = true,
  showNextTripPreview = true,
  className,
}: FleetMapProps) {
  const { vehicles } = useVehicles();
  const telemetry = useLatestTelemetry();
  const predictions = useLatestPredictions();
  const ids = useMemo(() => vehicles.map((v) => v.id), [vehicles]);
  const trails = useVehicleTrails(showTrails ? ids : []);
  const [geofences, setGeofences] = useState<any[]>([]);

  useEffect(() => {
    if (!showGeofences) return;
    supabase.from("geofences").select("*").then(({ data }) => setGeofences(data ?? []));
    const ch = supabase.channel(`geofences-map-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "geofences" },
        () => supabase.from("geofences").select("*").then(({ data }) => setGeofences(data ?? [])))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [showGeofences]);

  const points = vehicles
    .map((v) => {
      const t = telemetry[v.id];
      const lat = t?.lat ?? v.last_lat;
      const lng = t?.lng ?? v.last_lng;
      if (lat == null || lng == null) return null;
      return { v, lat: Number(lat), lng: Number(lng), risk: predictions[v.id]?.risk ?? "low", t };
    })
    .filter(Boolean) as { v: Vehicle; lat: number; lng: number; risk: string; t: any }[];

  if (points.length === 0) {
    return (
      <div className={className} style={{ height }}>
        <div className="grid h-full place-items-center text-muted-foreground text-sm">
          Waiting for GPS data… launch the demo to see vehicles on the map.
        </div>
      </div>
    );
  }

  const center: [number, number] = [points[0].lat, points[0].lng];

  return (
    <div className={className} style={{ height }}>
      <MapContainer
        center={center}
        zoom={12}
        className="h-full w-full"
        style={{ background: "#0a0f1a" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap, &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds points={points.map((p) => [p.lat, p.lng] as [number, number])} deps={[points.length]} />

        {/* Geofences */}
        {showGeofences && geofences.map((g) => (
          <Circle
            key={g.id}
            center={[Number(g.center_lat), Number(g.center_lng)]}
            radius={Number(g.radius_m)}
            pathOptions={{ color: "#3bc5ff", fillColor: "#3bc5ff", fillOpacity: 0.08, weight: 1, dashArray: "4 4" }}
          >
            <Popup><div className="font-mono text-xs">Zone: <b>{g.name}</b><br />Radius: {g.radius_m}m</div></Popup>
          </Circle>
        ))}

        {/* Trails */}
        {showTrails && Object.entries(trails).map(([vid, line]) => {
          if (line.length < 2) return null;
          const risk = predictions[vid]?.risk ?? "low";
          return (
            <Polyline
              key={`trail-${vid}`}
              positions={line}
              pathOptions={{ color: riskHex(risk), opacity: 0.55, weight: 2.5 }}
            />
          );
        })}

        {/* Next trip preview = projected line from heading */}
        {showNextTripPreview && points.map((p) => {
          const trail = trails[p.v.id];
          if (!trail || trail.length < 2) return null;
          const a = trail[trail.length - 2];
          const b = trail[trail.length - 1];
          const dLat = b[0] - a[0], dLng = b[1] - a[1];
          const next: [number, number] = [b[0] + dLat * 5, b[1] + dLng * 5];
          return (
            <Polyline
              key={`next-${p.v.id}`}
              positions={[b, next]}
              pathOptions={{ color: riskHex(p.risk), opacity: 0.35, weight: 2, dashArray: "6 6" }}
            />
          );
        })}

        {/* Vehicle markers with predictive ETA */}
        {points.map((p) => {
          // Compute ETA to nearest geofence in current heading direction
          const trail = trails[p.v.id];
          let eta: { name: string; minutes: number } | null = null;
          if (showGeofences && trail && trail.length >= 2 && p.t?.speed && p.t.speed > 5) {
            const a = trail[trail.length - 2];
            const b = trail[trail.length - 1];
            const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
            let best: { name: string; km: number } | null = null;
            for (const g of geofences) {
              const dLat = (Number(g.center_lat) - p.lat) * 111;
              const dLng = (Number(g.center_lng) - p.lng) * 111 * Math.cos((p.lat * Math.PI) / 180);
              const km = Math.sqrt(dLat * dLat + dLng * dLng);
              const bearing = Math.atan2(Number(g.center_lng) - p.lng, Number(g.center_lat) - p.lat);
              const angleDiff = Math.abs(((bearing - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
              // within ~60° of heading
              if (angleDiff < Math.PI / 3 && (!best || km < best.km)) best = { name: g.name, km };
            }
            if (best) eta = { name: best.name, minutes: Math.round((best.km / p.t.speed) * 60) };
          }
          return (
            <CircleMarker
              key={p.v.id}
              center={[p.lat, p.lng]}
              radius={9}
              pathOptions={{
                color: riskHex(p.risk),
                fillColor: riskHex(p.risk),
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <div className="font-mono text-xs space-y-0.5">
                  <div className="font-semibold text-sm">{p.v.name} · {p.v.plate}</div>
                  <div>Engine: {p.t?.engine_temp != null ? `${Math.round(p.t.engine_temp)}°C` : "—"}</div>
                  <div>Speed: {p.t?.speed != null ? `${Math.round(p.t.speed)} km/h` : "—"}</div>
                  <div>Fuel: {p.t?.fuel_level != null ? `${Math.round(p.t.fuel_level)}%` : "—"}</div>
                  <div>Risk: <b style={{ color: riskHex(p.risk) }}>{p.risk.toUpperCase()}</b></div>
                  {eta && <div>ETA <b>{eta.name}</b>: <b>{eta.minutes} min</b></div>}
                  <Link to={`/app/vehicles/${p.v.id}`} className="text-primary hover:underline">Open vehicle →</Link>
                  <Link to={`/app/replay/${p.v.id}`} className="block text-primary hover:underline">Replay today →</Link>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
