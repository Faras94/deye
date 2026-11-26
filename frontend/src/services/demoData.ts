import type {
  CollectionLog,
  DailyEnergy,
  Inverter,
  InverterReading,
  MonthlyEnergy,
  Panel,
  PanelReading,
  SolarAlert,
  SystemSetting,
  UserProfile,
} from '@/types/v2'

const now = new Date()
const isoHoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString()
const dateDaysAgo = (d: number) => {
  const dt = new Date(now.getTime() - d * 86400 * 1000)
  return dt.toISOString().slice(0, 10)
}

export const DEMO_INVERTERS: Inverter[] = [
  {
    id: 'inv-1',
    device_sn: '260605A076',
    name: 'Microinverter 1 (2.2 kW)',
    capacity_kw: 2.2,
    rated_power_w: 2200,
    station_id: 1001,
    device_type: 'MICRO_INVERTER',
    status: 'online',
    last_communication_at: isoHoursAgo(0.2),
    is_active: true,
    display_order: 1,
  },
  {
    id: 'inv-2',
    device_sn: '260603A1D5',
    name: 'Microinverter 2 (2.2 kW)',
    capacity_kw: 2.2,
    rated_power_w: 2200,
    station_id: 1001,
    device_type: 'MICRO_INVERTER',
    status: 'online',
    last_communication_at: isoHoursAgo(0.2),
    is_active: true,
    display_order: 2,
  },
  {
    id: 'inv-3',
    device_sn: '260505A373',
    name: 'Microinverter 3 (1.0 kW)',
    capacity_kw: 1.0,
    rated_power_w: 1000,
    station_id: 1001,
    device_type: 'MICRO_INVERTER',
    status: 'online',
    last_communication_at: isoHoursAgo(0.2),
    is_active: true,
    display_order: 3,
  },
]

export const DEMO_PANELS: Panel[] = [
  { id: 'p-1', inverter_id: 'inv-1', name: 'Array A - Panel 1', channel_index: 1, rated_capacity_w: 630, deye_power_key: 'DCPowerPV1', deye_voltage_key: 'DCVoltagePV1', deye_current_key: 'DCCurrentPV1', deye_energy_key: 'TotalProduction1', is_active: true },
  { id: 'p-2', inverter_id: 'inv-1', name: 'Array A - Panel 2', channel_index: 2, rated_capacity_w: 630, deye_power_key: 'DCPowerPV2', deye_voltage_key: 'DCVoltagePV2', deye_current_key: 'DCCurrentPV2', deye_energy_key: 'TotalProduction2', is_active: true },
  { id: 'p-3', inverter_id: 'inv-1', name: 'Array A - Panel 3', channel_index: 3, rated_capacity_w: 630, deye_power_key: 'DCPowerPV3', deye_voltage_key: 'DCVoltagePV3', deye_current_key: 'DCCurrentPV3', deye_energy_key: 'TotalProduction3', is_active: true },
  { id: 'p-4', inverter_id: 'inv-1', name: 'Array A - Panel 4', channel_index: 4, rated_capacity_w: 630, deye_power_key: 'DCPowerPV4', deye_voltage_key: 'DCVoltagePV4', deye_current_key: 'DCCurrentPV4', deye_energy_key: 'TotalProduction4', is_active: true },
  { id: 'p-5', inverter_id: 'inv-2', name: 'Array B - Panel 1', channel_index: 1, rated_capacity_w: 630, deye_power_key: 'DCPowerPV1', deye_voltage_key: 'DCVoltagePV1', deye_current_key: 'DCCurrentPV1', deye_energy_key: 'TotalProduction1', is_active: true },
  { id: 'p-6', inverter_id: 'inv-2', name: 'Array B - Panel 2', channel_index: 2, rated_capacity_w: 630, deye_power_key: 'DCPowerPV2', deye_voltage_key: 'DCVoltagePV2', deye_current_key: 'DCCurrentPV2', deye_energy_key: 'TotalProduction2', is_active: true },
  { id: 'p-7', inverter_id: 'inv-3', name: 'Array C - Panel 1', channel_index: 1, rated_capacity_w: 630, deye_power_key: 'DCPowerPV1', deye_voltage_key: 'DCVoltagePV1', deye_current_key: 'DCCurrentPV1', deye_energy_key: 'TotalProduction1', is_active: true },
  { id: 'p-8', inverter_id: 'inv-3', name: 'Array C - Panel 2', channel_index: 2, rated_capacity_w: 630, deye_power_key: 'DCPowerPV2', deye_voltage_key: 'DCVoltagePV2', deye_current_key: 'DCCurrentPV2', deye_energy_key: 'TotalProduction2', is_active: true },
]

export const DEMO_INVERTER_READINGS: InverterReading[] = Array.from({ length: 24 }).flatMap((_, idx) => {
  const hoursAgo = (23 - idx) * 0.5
  const factor = Math.max(0.05, Math.sin(((idx + 2) / 26) * Math.PI))
  return [
    {
      id: idx * 3 + 1,
      inverter_id: 'inv-1',
      device_sn: '260605A076',
      recorded_at: isoHoursAgo(hoursAgo),
      power_w: Math.round(1680 * factor),
      daily_energy_kwh: Number((8.4 * ((idx + 1) / 24)).toFixed(2)),
      monthly_energy_kwh: 214.6,
      total_energy_kwh: 3420.5,
      ac_voltage_v: 231.4,
      ac_current_a: Number(((1680 * factor) / 231.4).toFixed(2)),
      ac_frequency_hz: 50.01,
      temperature_c: 38.5,
      status: 'online',
    },
    {
      id: idx * 3 + 2,
      inverter_id: 'inv-2',
      device_sn: '260603A1D5',
      recorded_at: isoHoursAgo(hoursAgo),
      power_w: Math.round(1610 * factor),
      daily_energy_kwh: Number((8.1 * ((idx + 1) / 24)).toFixed(2)),
      monthly_energy_kwh: 208.2,
      total_energy_kwh: 3310.1,
      ac_voltage_v: 230.9,
      ac_current_a: Number(((1610 * factor) / 230.9).toFixed(2)),
      ac_frequency_hz: 50.0,
      temperature_c: 37.9,
      status: 'online',
    },
    {
      id: idx * 3 + 3,
      inverter_id: 'inv-3',
      device_sn: '260505A373',
      recorded_at: isoHoursAgo(hoursAgo),
      power_w: Math.round(740 * factor),
      daily_energy_kwh: Number((3.8 * ((idx + 1) / 24)).toFixed(2)),
      monthly_energy_kwh: 98.4,
      total_energy_kwh: 1580.4,
      ac_voltage_v: 231.1,
      ac_current_a: Number(((740 * factor) / 231.1).toFixed(2)),
      ac_frequency_hz: 50.01,
      temperature_c: 35.2,
      status: 'online',
    },
  ]
})

export const DEMO_PANEL_READINGS: PanelReading[] = DEMO_PANELS.map((p, i) => {
  const power = Math.round(440 + ((i * 23) % 95))
  return {
    id: i + 1,
    panel_id: p.id,
    inverter_id: p.inverter_id,
    device_sn: DEMO_INVERTERS.find((inv) => inv.id === p.inverter_id)?.device_sn ?? '',
    channel_index: p.channel_index,
    recorded_at: isoHoursAgo(0.2),
    power_w: power,
    voltage_v: 39.8,
    current_a: Number((power / 39.8).toFixed(2)),
    daily_energy_kwh: Number((2.1 + i * 0.08).toFixed(2)),
    total_energy_kwh: Number((410 + i * 18).toFixed(1)),
    performance_pct: Number(((power / p.rated_capacity_w) * 100).toFixed(1)),
    is_estimated: false,
  }
})

export const DEMO_DAILY_ENERGY: DailyEnergy[] = Array.from({ length: 14 }).flatMap((_, d) => {
  const dt = dateDaysAgo(13 - d)
  const wave = 0.75 + 0.25 * Math.sin(d * 0.7)
  return [
    { id: d * 3 + 1, inverter_id: 'inv-1', device_sn: '260605A076', reading_date: dt, energy_kwh: Number((8.8 * wave).toFixed(2)), peak_power_w: 1850, avg_power_w: 920, sample_count: 24 },
    { id: d * 3 + 2, inverter_id: 'inv-2', device_sn: '260603A1D5', reading_date: dt, energy_kwh: Number((8.4 * wave).toFixed(2)), peak_power_w: 1790, avg_power_w: 890, sample_count: 24 },
    { id: d * 3 + 3, inverter_id: 'inv-3', device_sn: '260505A373', reading_date: dt, energy_kwh: Number((4.0 * wave).toFixed(2)), peak_power_w: 860, avg_power_w: 430, sample_count: 24 },
  ]
})

export const DEMO_MONTHLY_ENERGY: MonthlyEnergy[] = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].flatMap(
  (ym, idx) => [
    { id: idx * 3 + 1, inverter_id: 'inv-1', device_sn: '260605A076', year_month: ym, energy_kwh: 230 + idx * 9, peak_power_w: 1960, active_days: 28 },
    { id: idx * 3 + 2, inverter_id: 'inv-2', device_sn: '260603A1D5', year_month: ym, energy_kwh: 222 + idx * 8, peak_power_w: 1910, active_days: 28 },
    { id: idx * 3 + 3, inverter_id: 'inv-3', device_sn: '260505A373', year_month: ym, energy_kwh: 104 + idx * 4, peak_power_w: 910, active_days: 28 },
  ],
)

export const DEMO_COLLECTION_LOGS: CollectionLog[] = [
  { id: 1, started_at: isoHoursAgo(0.2), finished_at: isoHoursAgo(0.19), status: 'success', devices_queried: 3, readings_inserted: 11, api_calls_made: 1, error_message: null },
  { id: 2, started_at: isoHoursAgo(0.7), finished_at: isoHoursAgo(0.69), status: 'success', devices_queried: 3, readings_inserted: 11, api_calls_made: 1, error_message: null },
  { id: 3, started_at: isoHoursAgo(1.2), finished_at: isoHoursAgo(1.19), status: 'success', devices_queried: 3, readings_inserted: 11, api_calls_made: 1, error_message: null },
]

export const DEMO_ALERTS: SolarAlert[] = [
  {
    id: 1,
    inverter_id: 'inv-3',
    device_sn: '260505A373',
    alert_type: 'missing_data',
    severity: 'info',
    title: 'Demo Mode Active',
    message: 'Showing sample telemetry because VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not configured yet.',
    is_resolved: false,
    resolved_at: null,
    created_at: isoHoursAgo(0.5),
  },
]

export const DEMO_PROFILES: UserProfile[] = [
  { id: 'demo-admin', email: 'admin@deye-solar.local', full_name: 'Solar Admin', role: 'admin', is_active: true, created_at: isoHoursAgo(100) },
  { id: 'demo-v1', email: 'viewer1@deye-solar.local', full_name: 'Family Viewer 1', role: 'viewer', is_active: true, created_at: isoHoursAgo(90) },
]

export const DEMO_SETTINGS: SystemSetting[] = [
  { key: 'collection_interval_minutes', value: 30, description: 'Scheduled collector interval in minutes', updated_at: isoHoursAgo(10) },
  { key: 'raw_retention_days', value: 90, description: 'Days to retain raw 30-minute telemetry readings', updated_at: isoHoursAgo(10) },
  { key: 'panel_default_rating_w', value: 630, description: 'Default rated wattage per solar panel', updated_at: isoHoursAgo(10) },
]
