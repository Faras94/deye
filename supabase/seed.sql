-- Deye Solar Monitor V2 - Initial Seed Data
-- Configures the 3 existing microinverters (2.2 kW + 2.2 kW + 1.0 kW = 5.4 kW)
-- and default system settings. Panel count & mapping are configurable in Settings.

INSERT INTO public.inverters (device_sn, name, capacity_kw, device_type, status, display_order)
VALUES
    ('260605A076', 'Microinverter 1 (2.2 kW)', 2.200, 'MICRO_INVERTER', 'unknown', 1),
    ('260603A1D5', 'Microinverter 2 (2.2 kW)', 2.200, 'MICRO_INVERTER', 'unknown', 2),
    ('260505A373', 'Microinverter 3 (1.0 kW)', 1.000, 'MICRO_INVERTER', 'unknown', 3)
ON CONFLICT (device_sn) DO UPDATE
SET
    capacity_kw = EXCLUDED.capacity_kw,
    display_order = EXCLUDED.display_order;

INSERT INTO public.system_settings (key, value, description)
VALUES
    ('collection_interval_minutes', '30'::jsonb, 'Scheduled collector interval in minutes'),
    ('raw_retention_days', '90'::jsonb, 'Days to retain raw 30-minute telemetry readings'),
    ('panel_default_rating_w', '630'::jsonb, 'Default rated wattage per solar panel'),
    ('offline_alert_threshold_minutes', '90'::jsonb, 'Minutes without communication during daylight before alerting'),
    ('max_users', '5'::jsonb, 'Maximum allowed user accounts (1 admin + 4 viewers)')
ON CONFLICT (key) DO NOTHING;
