export type UserRole = 'admin' | 'viewer'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Inverter {
  id: string
  device_sn: string
  name: string
  capacity_kw: number
  rated_power_w: number
  station_id: number | null
  device_type: string
  status: 'online' | 'offline' | 'alert' | 'unknown'
  last_communication_at: string | null
  is_active: boolean
  display_order: number
}

export interface Panel {
  id: string
  inverter_id: string
  name: string
  channel_index: number
  rated_capacity_w: number
  deye_power_key: string | null
  deye_voltage_key: string | null
  deye_current_key: string | null
  deye_energy_key: string | null
  is_active: boolean
}

export interface InverterReading {
  id: number
  inverter_id: string
  device_sn: string
  recorded_at: string
  power_w: number | null
  daily_energy_kwh: number | null
  monthly_energy_kwh: number | null
  total_energy_kwh: number | null
  ac_voltage_v: number | null
  ac_current_a: number | null
  ac_frequency_hz: number | null
  temperature_c: number | null
  status: string
}

export interface PanelReading {
  id: number
  panel_id: string
  inverter_id: string
  device_sn: string
  channel_index: number
  recorded_at: string
  power_w: number | null
  voltage_v: number | null
  current_a: number | null
  daily_energy_kwh: number | null
  total_energy_kwh: number | null
  performance_pct: number | null
  is_estimated: boolean
}

export interface DailyEnergy {
  id: number
  inverter_id: string
  device_sn: string
  reading_date: string
  energy_kwh: number
  peak_power_w: number | null
  avg_power_w: number | null
  sample_count: number
}

export interface MonthlyEnergy {
  id: number
  inverter_id: string
  device_sn: string
  year_month: string
  energy_kwh: number
  peak_power_w: number | null
  active_days: number
}

export interface CollectionLog {
  id: number
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'partial' | 'failed'
  devices_queried: number
  readings_inserted: number
  api_calls_made: number
  error_message: string | null
}

export interface SolarAlert {
  id: number
  inverter_id: string | null
  device_sn: string | null
  alert_type:
    | 'inverter_offline'
    | 'missing_data'
    | 'generation_drop'
    | 'api_auth_failure'
    | 'collection_failure'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  is_resolved: boolean
  resolved_at: string | null
  created_at: string
}

export interface SystemSetting {
  key: string
  value: unknown
  description: string | null
  updated_at: string
}
