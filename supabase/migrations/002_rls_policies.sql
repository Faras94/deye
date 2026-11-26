-- Deye Solar Monitor V2 - Row Level Security (RLS) Policies
-- Supports 1 Admin + up to 4 Viewers sharing the same solar installation data.
-- Telemetry inserts/updates are performed exclusively by the Python collector via service_role.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inverter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_energy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_energy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER avoids recursive RLS checks on profiles)
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND is_active = true
    );
$$;

-- 1. profiles
CREATE POLICY "Active users can view profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_active_user() OR id = auth.uid());

CREATE POLICY "Admins can insert profiles"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete profiles"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- 2. inverters
CREATE POLICY "Active users can view inverters"
    ON public.inverters FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Admins can manage inverters"
    ON public.inverters FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. panels
CREATE POLICY "Active users can view panels"
    ON public.panels FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Admins can manage panels"
    ON public.panels FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 4. inverter_readings (read-only for all dashboard users; collector uses service_role)
CREATE POLICY "Active users can view inverter readings"
    ON public.inverter_readings FOR SELECT
    TO authenticated
    USING (public.is_active_user());

-- 5. panel_readings (read-only for all dashboard users)
CREATE POLICY "Active users can view panel readings"
    ON public.panel_readings FOR SELECT
    TO authenticated
    USING (public.is_active_user());

-- 6. daily_energy (read-only for all dashboard users)
CREATE POLICY "Active users can view daily energy"
    ON public.daily_energy FOR SELECT
    TO authenticated
    USING (public.is_active_user());

-- 7. monthly_energy (read-only for all dashboard users)
CREATE POLICY "Active users can view monthly energy"
    ON public.monthly_energy FOR SELECT
    TO authenticated
    USING (public.is_active_user());

-- 8. collection_logs (read-only for all dashboard users)
CREATE POLICY "Active users can view collection logs"
    ON public.collection_logs FOR SELECT
    TO authenticated
    USING (public.is_active_user());

-- 9. alerts (all active users can view; only admins can resolve/manage)
CREATE POLICY "Active users can view alerts"
    ON public.alerts FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Admins can manage alerts"
    ON public.alerts FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 10. system_settings (all active users can view; only admins can modify)
CREATE POLICY "Active users can view system settings"
    ON public.system_settings FOR SELECT
    TO authenticated
    USING (public.is_active_user());

CREATE POLICY "Admins can manage system settings"
    ON public.system_settings FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
