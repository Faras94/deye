import { isSupabaseConfigured, supabase } from '@/services/supabase'
import {
  DEMO_ALERTS,
  DEMO_COLLECTION_LOGS,
  DEMO_DAILY_ENERGY,
  DEMO_INVERTERS,
  DEMO_INVERTER_READINGS,
  DEMO_MONTHLY_ENERGY,
  DEMO_PANELS,
  DEMO_PANEL_READINGS,
  DEMO_PROFILES,
  DEMO_SETTINGS,
} from '@/services/demoData'
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
  UserRole,
} from '@/types/v2'

export const solarDataService = {
  async getInverters(): Promise<Inverter[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_INVERTERS
    const { data, error } = await supabase
      .from('inverters')
      .select('*')
      .order('display_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as Inverter[]
  },

  async getPanels(): Promise<Panel[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_PANELS
    const { data, error } = await supabase
      .from('panels')
      .select('*')
      .order('channel_index', { ascending: true })
    if (error) throw error
    return (data ?? []) as Panel[]
  },

  async getRecentInverterReadings(limit = 72): Promise<InverterReading[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_INVERTER_READINGS
    const { data, error } = await supabase
      .from('inverter_readings')
      .select(
        'id,inverter_id,device_sn,recorded_at,power_w,daily_energy_kwh,monthly_energy_kwh,total_energy_kwh,ac_voltage_v,ac_current_a,ac_frequency_hz,temperature_c,status',
      )
      .order('recorded_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return ((data ?? []) as InverterReading[]).reverse()
  },

  async getLatestPanelReadings(limit = 60): Promise<PanelReading[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_PANEL_READINGS
    const { data, error } = await supabase
      .from('panel_readings')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as PanelReading[]
  },

  async getDailyEnergy(days = 30): Promise<DailyEnergy[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_DAILY_ENERGY
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('daily_energy')
      .select('*')
      .gte('reading_date', since)
      .order('reading_date', { ascending: true })
    if (error) throw error
    return (data ?? []) as DailyEnergy[]
  },

  async getMonthlyEnergy(limit = 36): Promise<MonthlyEnergy[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_MONTHLY_ENERGY
    const { data, error } = await supabase
      .from('monthly_energy')
      .select('*')
      .order('year_month', { ascending: true })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as MonthlyEnergy[]
  },

  async getCollectionLogs(limit = 20): Promise<CollectionLog[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_COLLECTION_LOGS
    const { data, error } = await supabase
      .from('collection_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as CollectionLog[]
  },

  async getAlerts(): Promise<SolarAlert[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_ALERTS
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return (data ?? []) as SolarAlert[]
  },

  async resolveAlert(alertId: number, resolvedBy: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { error } = await supabase
      .from('alerts')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', alertId)
    if (error) throw error
  },

  async getHistoryPage(params: {
    page: number
    pageSize: number
    deviceSn?: string
    startDate?: string
    endDate?: string
  }): Promise<{ rows: InverterReading[]; total: number }> {
    if (!isSupabaseConfigured || !supabase) {
      let filtered = [...DEMO_INVERTER_READINGS].reverse()
      if (params.deviceSn && params.deviceSn !== 'all') {
        filtered = filtered.filter((r) => r.device_sn === params.deviceSn)
      }
      const start = params.page * params.pageSize
      return {
        rows: filtered.slice(start, start + params.pageSize),
        total: filtered.length,
      }
    }

    let query = supabase
      .from('inverter_readings')
      .select(
        'id,inverter_id,device_sn,recorded_at,power_w,daily_energy_kwh,monthly_energy_kwh,total_energy_kwh,ac_voltage_v,ac_current_a,ac_frequency_hz,temperature_c,status',
        { count: 'exact' },
      )
      .order('recorded_at', { ascending: false })

    if (params.deviceSn && params.deviceSn !== 'all') {
      query = query.eq('device_sn', params.deviceSn)
    }
    if (params.startDate) {
      query = query.gte('recorded_at', `${params.startDate}T00:00:00Z`)
    }
    if (params.endDate) {
      query = query.lte('recorded_at', `${params.endDate}T23:59:59Z`)
    }

    const from = params.page * params.pageSize
    const to = from + params.pageSize - 1
    const { data, count, error } = await query.range(from, to)
    if (error) throw error
    return {
      rows: (data ?? []) as InverterReading[],
      total: count ?? 0,
    }
  },

  async getProfiles(): Promise<UserProfile[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_PROFILES
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as UserProfile[]
  },

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (error) throw error
  },

  async getSystemSettings(): Promise<SystemSetting[]> {
    if (!isSupabaseConfigured || !supabase) return DEMO_SETTINGS
    const { data, error } = await supabase.from('system_settings').select('*')
    if (error) throw error
    return (data ?? []) as SystemSetting[]
  },

  async upsertPanel(panel: Partial<Panel> & { inverter_id: string; name: string; channel_index: number }): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { error } = await supabase.from('panels').upsert(panel)
    if (error) throw error
  },

  async renamePanel(panelId: string, name: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { error } = await supabase.from('panels').update({ name }).eq('id', panelId)
    if (error) throw error
  },

  async deletePanel(panelId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { error } = await supabase.from('panels').delete().eq('id', panelId)
    if (error) throw error
  },

  async updateInverter(id: string, patch: Partial<Inverter>): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return
    const { error } = await supabase.from('inverters').update(patch).eq('id', id)
    if (error) throw error
  },
}
