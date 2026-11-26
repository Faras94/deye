-- Deye Solar Monitor V2 - Triggers, User Cap (max 5), and Retention Policy

-- Auto-create profile on Supabase Auth signup.
-- First registered user becomes 'admin'; subsequent users become 'viewer'.
-- Enforces max 5 users total to match system design.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_count INTEGER;
    assigned_role TEXT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM public.profiles;
    IF user_count >= 5 THEN
        RAISE EXCEPTION 'Maximum of 5 users reached for this Deye Solar Monitor installation.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
        assigned_role := 'admin';
    ELSE
        assigned_role := 'viewer';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role, is_active)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        assigned_role,
        true
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_inverters_updated_at ON public.inverters;
CREATE TRIGGER trg_inverters_updated_at
    BEFORE UPDATE ON public.inverters
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_panels_updated_at ON public.panels;
CREATE TRIGGER trg_panels_updated_at
    BEFORE UPDATE ON public.panels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Retention cleanup function to keep Supabase Free Tier storage well under 500 MB.
-- Preserves daily_energy and monthly_energy forever; prunes raw granular readings & old logs.
CREATE OR REPLACE FUNCTION public.cleanup_old_readings(
    raw_retention_days INTEGER DEFAULT 90,
    log_retention_days INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_inv INTEGER := 0;
    deleted_pnl INTEGER := 0;
    deleted_logs INTEGER := 0;
BEGIN
    DELETE FROM public.inverter_readings
    WHERE recorded_at < timezone('utc', now()) - make_interval(days => raw_retention_days);
    GET DIAGNOSTICS deleted_inv = ROW_COUNT;

    DELETE FROM public.panel_readings
    WHERE recorded_at < timezone('utc', now()) - make_interval(days => raw_retention_days);
    GET DIAGNOSTICS deleted_pnl = ROW_COUNT;

    DELETE FROM public.collection_logs
    WHERE started_at < timezone('utc', now()) - make_interval(days => log_retention_days);
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted_inverter_readings', deleted_inv,
        'deleted_panel_readings', deleted_pnl,
        'deleted_collection_logs', deleted_logs,
        'executed_at', timezone('utc', now())
    );
END;
$$;
