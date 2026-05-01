// Shared utility hooks for FleetIQ
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  vehicle_type: string;
  status: "active" | "idle" | "maintenance";
  odometer: number;
  assigned_driver_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface TelemetryReading {
  id: number;
  vehicle_id: string;
  ts: string;
  engine_temp: number | null;
  rpm: number | null;
  fuel_level: number | null;
  vibration: number | null;
  battery_voltage: number | null;
  speed: number | null;
  lat: number | null;
  lng: number | null;
}

export interface Prediction {
  id: string;
  vehicle_id: string;
  predicted_at: string;
  risk: "low" | "medium" | "high";
  confidence: number;
  reasons: string[];
  recommended_action: string | null;
  sensor_contributions?: Record<string, number>;
  health_score?: number;
}

export interface Alert {
  id: string;
  vehicle_id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  message: string;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export function useVehicles() {
  const [data, setData] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.from("vehicles").select("*").order("name");
      if (active) { setData((data ?? []) as Vehicle[]); setLoading(false); }
    };
    load();
    const channel = supabase.channel(`vehicles-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vehicles" }, load)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  return { vehicles: data, loading };
}

export function useLatestTelemetry() {
  const [readings, setReadings] = useState<Record<string, TelemetryReading>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("telemetry_readings")
        .select("*").order("ts", { ascending: false }).limit(500);
      const byVehicle: Record<string, TelemetryReading> = {};
      (data ?? []).forEach((r: any) => { if (!byVehicle[r.vehicle_id]) byVehicle[r.vehicle_id] = r; });
      setReadings(byVehicle);
    };
    load();
    const channel = supabase.channel(`telemetry-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry_readings" }, (payload) => {
        const r = payload.new as TelemetryReading;
        setReadings((prev) => ({ ...prev, [r.vehicle_id]: r }));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return readings;
}

export function useLatestPredictions() {
  const [preds, setPreds] = useState<Record<string, Prediction>>({});
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("maintenance_predictions")
        .select("*").order("predicted_at", { ascending: false }).limit(500);
      const byVehicle: Record<string, Prediction> = {};
      (data ?? []).forEach((p: any) => { if (!byVehicle[p.vehicle_id]) byVehicle[p.vehicle_id] = p as Prediction; });
      setPreds(byVehicle);
    };
    load();
    const channel = supabase.channel(`preds-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_predictions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  return preds;
}

// Trails: last hour of GPS per vehicle, deduped, capped at 60 points
export function useVehicleTrails(vehicleIds: string[]) {
  const [trails, setTrails] = useState<Record<string, [number, number][]>>({});

  useEffect(() => {
    if (vehicleIds.length === 0) return;
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const load = async () => {
      const { data } = await supabase
        .from("telemetry_readings")
        .select("vehicle_id, lat, lng, ts")
        .gte("ts", since)
        .in("vehicle_id", vehicleIds)
        .order("ts", { ascending: true });
      const byV: Record<string, [number, number][]> = {};
      (data ?? []).forEach((r: any) => {
        if (r.lat == null || r.lng == null) return;
        (byV[r.vehicle_id] ??= []).push([Number(r.lat), Number(r.lng)]);
      });
      // cap + thin
      Object.keys(byV).forEach((k) => {
        const arr = byV[k];
        if (arr.length > 60) {
          const stride = Math.ceil(arr.length / 60);
          byV[k] = arr.filter((_, i) => i % stride === 0);
        }
      });
      setTrails(byV);
    };
    load();
    const ch = supabase.channel(`trails-live-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telemetry_readings" }, (payload) => {
        const r: any = payload.new;
        if (r.lat == null || r.lng == null) return;
        if (!vehicleIds.includes(r.vehicle_id)) return;
        setTrails((prev) => {
          const arr = (prev[r.vehicle_id] ?? []).slice();
          arr.push([Number(r.lat), Number(r.lng)]);
          if (arr.length > 60) arr.shift();
          return { ...prev, [r.vehicle_id]: arr };
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [vehicleIds.join(",")]);

  return trails;
}

export function riskColor(risk?: string) {
  if (risk === "high") return "destructive";
  if (risk === "medium") return "warning";
  return "primary";
}

export function riskHex(risk?: string) {
  if (risk === "high") return "#ef4444";
  if (risk === "medium") return "#fbbf24";
  return "#10f5b1";
}
