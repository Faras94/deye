import { useQuery } from '@tanstack/react-query'
import { solarDataService } from '@/services/solarDataService'

export function useInverters() {
  return useQuery({
    queryKey: ['inverters'],
    queryFn: solarDataService.getInverters,
    staleTime: 60_000,
  })
}

export function usePanels() {
  return useQuery({
    queryKey: ['panels'],
    queryFn: solarDataService.getPanels,
    staleTime: 60_000,
  })
}

export function useRecentReadings(limit = 72) {
  return useQuery({
    queryKey: ['inverter_readings', limit],
    queryFn: () => solarDataService.getRecentInverterReadings(limit),
    staleTime: 60_000,
  })
}

export function useLatestPanelReadings(limit = 60) {
  return useQuery({
    queryKey: ['panel_readings', limit],
    queryFn: () => solarDataService.getLatestPanelReadings(limit),
    staleTime: 60_000,
  })
}

export function useDailyEnergy(days = 30) {
  return useQuery({
    queryKey: ['daily_energy', days],
    queryFn: () => solarDataService.getDailyEnergy(days),
    staleTime: 120_000,
  })
}

export function useMonthlyEnergy(limit = 36) {
  return useQuery({
    queryKey: ['monthly_energy', limit],
    queryFn: () => solarDataService.getMonthlyEnergy(limit),
    staleTime: 300_000,
  })
}

export function useCollectionLogs(limit = 20) {
  return useQuery({
    queryKey: ['collection_logs', limit],
    queryFn: () => solarDataService.getCollectionLogs(limit),
    staleTime: 60_000,
  })
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: solarDataService.getAlerts,
    staleTime: 60_000,
  })
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: solarDataService.getProfiles,
    staleTime: 120_000,
  })
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ['system_settings'],
    queryFn: solarDataService.getSystemSettings,
    staleTime: 120_000,
  })
}
