
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'fleet_manager', 'driver');
CREATE TYPE public.vehicle_status AS ENUM ('active', 'idle', 'maintenance');
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- USER ROLES (separate table — security best practice)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Convenience: get highest privilege role for a user
CREATE OR REPLACE FUNCTION public.current_user_is_staff()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')
$$;

-- =========================================
-- DRIVERS
-- =========================================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  license_number TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- =========================================
-- VEHICLES
-- =========================================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plate TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'truck',
  status public.vehicle_status NOT NULL DEFAULT 'idle',
  odometer NUMERIC NOT NULL DEFAULT 0,
  assigned_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  last_lat NUMERIC,
  last_lng NUMERIC,
  ingest_api_key_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vehicles_status ON public.vehicles(status);
CREATE INDEX idx_vehicles_driver ON public.vehicles(assigned_driver_id);

-- =========================================
-- TELEMETRY
-- =========================================
CREATE TABLE public.telemetry_readings (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  engine_temp NUMERIC,
  rpm NUMERIC,
  fuel_level NUMERIC,
  vibration NUMERIC,
  battery_voltage NUMERIC,
  speed NUMERIC,
  lat NUMERIC,
  lng NUMERIC
);
ALTER TABLE public.telemetry_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_telemetry_vehicle_ts ON public.telemetry_readings(vehicle_id, ts DESC);

-- =========================================
-- MAINTENANCE PREDICTIONS
-- =========================================
CREATE TABLE public.maintenance_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  risk public.risk_level NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_action TEXT
);
ALTER TABLE public.maintenance_predictions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_predictions_vehicle ON public.maintenance_predictions(vehicle_id, predicted_at DESC);

-- =========================================
-- MAINTENANCE RECORDS
-- =========================================
CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  performed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- =========================================
-- ALERTS
-- =========================================
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_alerts_unresolved ON public.alerts(is_resolved, created_at DESC);

-- =========================================
-- TRIGGERS: updated_at + auto-create profile + default driver role
-- =========================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_vehicles_touch BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'driver')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- RLS POLICIES
-- =========================================

-- profiles
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_is_staff());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "roles_self_view" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- drivers
CREATE POLICY "drivers_self_select" ON public.drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_staff());
CREATE POLICY "drivers_self_upsert" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.current_user_is_staff());
CREATE POLICY "drivers_self_update" ON public.drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.current_user_is_staff())
  WITH CHECK (user_id = auth.uid() OR public.current_user_is_staff());
CREATE POLICY "drivers_staff_delete" ON public.drivers FOR DELETE TO authenticated
  USING (public.current_user_is_staff());

-- vehicles
CREATE POLICY "vehicles_select" ON public.vehicles FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = vehicles.assigned_driver_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "vehicles_staff_manage" ON public.vehicles FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());

-- telemetry_readings
CREATE POLICY "telemetry_select" ON public.telemetry_readings FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.vehicles v
      JOIN public.drivers d ON d.id = v.assigned_driver_id
      WHERE v.id = telemetry_readings.vehicle_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "telemetry_staff_insert" ON public.telemetry_readings FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff());

-- maintenance_predictions
CREATE POLICY "predictions_select" ON public.maintenance_predictions FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.vehicles v
      JOIN public.drivers d ON d.id = v.assigned_driver_id
      WHERE v.id = maintenance_predictions.vehicle_id AND d.user_id = auth.uid()
    )
  );

-- maintenance_records
CREATE POLICY "records_select" ON public.maintenance_records FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.vehicles v
      JOIN public.drivers d ON d.id = v.assigned_driver_id
      WHERE v.id = maintenance_records.vehicle_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "records_staff_manage" ON public.maintenance_records FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());

-- alerts
CREATE POLICY "alerts_select" ON public.alerts FOR SELECT TO authenticated
  USING (
    public.current_user_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.vehicles v
      JOIN public.drivers d ON d.id = v.assigned_driver_id
      WHERE v.id = alerts.vehicle_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "alerts_staff_manage" ON public.alerts FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());

-- =========================================
-- REALTIME
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.telemetry_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles;
