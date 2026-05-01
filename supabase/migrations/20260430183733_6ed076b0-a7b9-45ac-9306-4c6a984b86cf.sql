
-- Wave A/B foundations: keep prediction history, add health score, geofences, alert rules, audit log, trips

-- 1) Sensor contribution breakdown for explainability (added as JSONB column on predictions)
ALTER TABLE public.maintenance_predictions
  ADD COLUMN IF NOT EXISTS sensor_contributions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS health_score NUMERIC NOT NULL DEFAULT 100;

-- 2) Geofences (admin-drawn circles)
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  center_lat NUMERIC NOT NULL,
  center_lng NUMERIC NOT NULL,
  radius_m NUMERIC NOT NULL DEFAULT 500,
  alert_on_enter BOOLEAN NOT NULL DEFAULT TRUE,
  alert_on_exit BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geofences_select" ON public.geofences FOR SELECT TO authenticated USING (true);
CREATE POLICY "geofences_staff_manage" ON public.geofences FOR ALL TO authenticated
  USING (current_user_is_staff()) WITH CHECK (current_user_is_staff());

-- 3) Alert rules (configurable thresholds)
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,                 -- engine_temp, vibration, battery_voltage, fuel_level, speed
  comparator TEXT NOT NULL DEFAULT '>', -- > , < , >=, <=
  threshold NUMERIC NOT NULL,
  consecutive_required INT NOT NULL DEFAULT 1,
  severity TEXT NOT NULL DEFAULT 'warning', -- info|warning|critical
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_select" ON public.alert_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules_staff_manage" ON public.alert_rules FOR ALL TO authenticated
  USING (current_user_is_staff()) WITH CHECK (current_user_is_staff());

-- Seed a few sensible defaults
INSERT INTO public.alert_rules (name, metric, comparator, threshold, consecutive_required, severity)
VALUES
  ('Engine overheating', 'engine_temp', '>', 115, 2, 'critical'),
  ('High vibration', 'vibration', '>', 0.9, 2, 'critical'),
  ('Low battery', 'battery_voltage', '<', 11.5, 2, 'warning'),
  ('Low fuel', 'fuel_level', '<', 10, 1, 'warning'),
  ('Over-speed', 'speed', '>', 110, 1, 'warning')
ON CONFLICT DO NOTHING;

-- 4) Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_staff" ON public.audit_log FOR SELECT TO authenticated USING (current_user_is_staff());
CREATE POLICY "audit_insert_self" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- 5) Index telemetry for faster trip / map queries
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle_ts ON public.telemetry_readings(vehicle_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_vehicle_at ON public.maintenance_predictions(vehicle_id, predicted_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON public.alerts(is_resolved, created_at DESC);

-- 6) Driver behavior counters (computed on-read but cache last refresh per driver)
CREATE TABLE IF NOT EXISTS public.driver_scores (
  driver_id UUID NOT NULL PRIMARY KEY,
  harsh_accel INT NOT NULL DEFAULT 0,
  over_speed INT NOT NULL DEFAULT 0,
  idle_minutes NUMERIC NOT NULL DEFAULT 0,
  score NUMERIC NOT NULL DEFAULT 100,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "driver_scores_select" ON public.driver_scores FOR SELECT TO authenticated
  USING (current_user_is_staff() OR EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_scores.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "driver_scores_staff_manage" ON public.driver_scores FOR ALL TO authenticated
  USING (current_user_is_staff()) WITH CHECK (current_user_is_staff());
