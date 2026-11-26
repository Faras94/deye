-- Deye Solar Monitor V2 - Initial PostgreSQL Schema
-- All timestamps are stored consistently in UTC (TIMESTAMPTZ).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User Profiles (1 Admin + up to 4 Viewers = max 5 users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Microinverters (3 configured: 2.2 kW, 2.2 kW, 1.0 kW = 5.4 kW combined)
CREATE TABLE IF NOT EXISTS public.inverters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_sn TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    capacity_kw NUMERIC(6, 3) NOT NULL CHECK (capacity_kw > 0),
    rated_power_w NUMERIC(10, 2) GENERATED ALWAYS AS (capacity_kw * 1000.0) STORED,
    station_id BIGINT,
    device_type TEXT NOT NULL DEFAULT 'MICRO_INVERTER',
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'alert', 'unknown')),
    last_communication_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_inverters_device_sn ON public.inverters(device_sn);

-- 3. Solar Panels (configurable count & inverter-to-panel mapping, 630W default)
CREATE TABLE IF NOT EXISTS public.panels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inverter_id UUID NOT NULL REFERENCES public.inverters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel_index INTEGER NOT NULL CHECK (channel_index >= 1 AND channel_index <= 8),
    rated_capacity_w NUMERIC(8, 2) NOT NULL DEFAULT 630.00 CHECK (rated_capacity_w > 0),
    deye_power_key TEXT,
    deye_voltage_key TEXT,
    deye_current_key TEXT,
    deye_energy_key TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (inverter_id, channel_index)
);

CREATE INDEX IF NOT EXISTS idx_panels_inverter_id ON public.panels(inverter_id);

-- 4. Inverter Telemetry Readings (time-series)
CREATE TABLE IF NOT EXISTS public.inverter_readings (
    id BIGSERIAL PRIMARY KEY,
    inverter_id UUID NOT NULL REFERENCES public.inverters(id) ON DELETE CASCADE,
    device_sn TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    power_w NUMERIC(10, 2),
    daily_energy_kwh NUMERIC(10, 3),
    monthly_energy_kwh NUMERIC(12, 3),
    total_energy_kwh NUMERIC(14, 3),
    ac_voltage_v NUMERIC(7, 2),
    ac_current_a NUMERIC(7, 2),
    ac_frequency_hz NUMERIC(6, 2),
    temperature_c NUMERIC(6, 2),
    status TEXT NOT NULL DEFAULT 'unknown',
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (device_sn, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_inverter_readings_sn_time
    ON public.inverter_readings(device_sn, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_inverter_readings_recorded_at
    ON public.inverter_readings(recorded_at DESC);

-- 5. Panel Telemetry Readings (time-series)
CREATE TABLE IF NOT EXISTS public.panel_readings (
    id BIGSERIAL PRIMARY KEY,
    panel_id UUID NOT NULL REFERENCES public.panels(id) ON DELETE CASCADE,
    inverter_id UUID NOT NULL REFERENCES public.inverters(id) ON DELETE CASCADE,
    device_sn TEXT NOT NULL,
    channel_index INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    power_w NUMERIC(10, 2),
    voltage_v NUMERIC(7, 2),
    current_a NUMERIC(7, 2),
    daily_energy_kwh NUMERIC(10, 3),
    total_energy_kwh NUMERIC(14, 3),
    performance_pct NUMERIC(6, 2),
    is_estimated BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (panel_id, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_panel_readings_panel_time
    ON public.panel_readings(panel_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_panel_readings_sn_time
    ON public.panel_readings(device_sn, recorded_at DESC);

-- 6. Daily Energy Summaries
CREATE TABLE IF NOT EXISTS public.daily_energy (
    id BIGSERIAL PRIMARY KEY,
    inverter_id UUID NOT NULL REFERENCES public.inverters(id) ON DELETE CASCADE,
    device_sn TEXT NOT NULL,
    reading_date DATE NOT NULL,
    energy_kwh NUMERIC(10, 3) NOT NULL DEFAULT 0,
    peak_power_w NUMERIC(10, 2),
    avg_power_w NUMERIC(10, 2),
    sample_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (device_sn, reading_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_energy_date_sn
    ON public.daily_energy(reading_date DESC, device_sn);

-- 7. Monthly Energy Summaries
CREATE TABLE IF NOT EXISTS public.monthly_energy (
    id BIGSERIAL PRIMARY KEY,
    inverter_id UUID NOT NULL REFERENCES public.inverters(id) ON DELETE CASCADE,
    device_sn TEXT NOT NULL,
    year_month TEXT NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
    energy_kwh NUMERIC(12, 3) NOT NULL DEFAULT 0,
    peak_power_w NUMERIC(10, 2),
    active_days INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (device_sn, year_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_energy_ym_sn
    ON public.monthly_energy(year_month DESC, device_sn);

-- 8. Data Collection Logs
CREATE TABLE IF NOT EXISTS public.collection_logs (
    id BIGSERIAL PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
    devices_queried INTEGER NOT NULL DEFAULT 0,
    readings_inserted INTEGER NOT NULL DEFAULT 0,
    api_calls_made INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_collection_logs_started_at
    ON public.collection_logs(started_at DESC);

-- 9. System & Solar Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id BIGSERIAL PRIMARY KEY,
    inverter_id UUID REFERENCES public.inverters(id) ON DELETE SET NULL,
    device_sn TEXT,
    alert_type TEXT NOT NULL CHECK (
        alert_type IN ('inverter_offline', 'missing_data', 'generation_drop', 'api_auth_failure', 'collection_failure')
    ),
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_alerts_resolved_created
    ON public.alerts(is_resolved, created_at DESC);

-- 10. System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
