-- Maintenance schedules
CREATE TABLE public.maintenance_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  maintenance_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_select" ON public.maintenance_schedules FOR SELECT TO authenticated
USING (current_user_is_staff() OR EXISTS (
  SELECT 1 FROM vehicles v JOIN drivers d ON d.id = v.assigned_driver_id
  WHERE v.id = maintenance_schedules.vehicle_id AND d.user_id = auth.uid()
));
CREATE POLICY "schedules_staff_manage" ON public.maintenance_schedules FOR ALL TO authenticated
USING (current_user_is_staff()) WITH CHECK (current_user_is_staff());
CREATE TRIGGER schedules_touch BEFORE UPDATE ON public.maintenance_schedules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_schedules_vehicle ON public.maintenance_schedules(vehicle_id, scheduled_for);

-- Fuel logs
CREATE TABLE public.fuel_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id UUID NOT NULL,
  liters NUMERIC NOT NULL,
  price_per_liter NUMERIC NOT NULL DEFAULT 0,
  odometer NUMERIC,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  logged_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_select" ON public.fuel_logs FOR SELECT TO authenticated
USING (current_user_is_staff() OR EXISTS (
  SELECT 1 FROM vehicles v JOIN drivers d ON d.id = v.assigned_driver_id
  WHERE v.id = fuel_logs.vehicle_id AND d.user_id = auth.uid()
));
CREATE POLICY "fuel_staff_manage" ON public.fuel_logs FOR ALL TO authenticated
USING (current_user_is_staff()) WITH CHECK (current_user_is_staff());
CREATE POLICY "fuel_driver_insert" ON public.fuel_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM vehicles v JOIN drivers d ON d.id = v.assigned_driver_id
  WHERE v.id = fuel_logs.vehicle_id AND d.user_id = auth.uid()
));
CREATE INDEX idx_fuel_vehicle_ts ON public.fuel_logs(vehicle_id, logged_at DESC);

-- Planned routes
CREATE TABLE public.planned_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  vehicle_id UUID,
  stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  geometry JSONB,
  total_distance_m NUMERIC,
  total_duration_s NUMERIC,
  status TEXT NOT NULL DEFAULT 'planned',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.planned_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "routes_select" ON public.planned_routes FOR SELECT TO authenticated
USING (current_user_is_staff() OR EXISTS (
  SELECT 1 FROM vehicles v JOIN drivers d ON d.id = v.assigned_driver_id
  WHERE v.id = planned_routes.vehicle_id AND d.user_id = auth.uid()
));
CREATE POLICY "routes_staff_manage" ON public.planned_routes FOR ALL TO authenticated
USING (current_user_is_staff()) WITH CHECK (current_user_is_staff());

-- User dashboard layouts
CREATE TABLE public.user_dashboard_layouts (
  user_id UUID NOT NULL PRIMARY KEY,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "layout_self_select" ON public.user_dashboard_layouts FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "layout_self_upsert" ON public.user_dashboard_layouts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
CREATE POLICY "layout_self_update" ON public.user_dashboard_layouts FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Webhooks
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_admin_manage" ON public.webhooks FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Webhook deliveries (audit)
CREATE TABLE public.webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_status INTEGER,
  response_body TEXT,
  error TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_admin_select" ON public.webhook_deliveries FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_deliveries_webhook ON public.webhook_deliveries(webhook_id, delivered_at DESC);