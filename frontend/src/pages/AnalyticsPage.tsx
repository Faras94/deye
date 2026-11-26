import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { GenerationTrendChart } from '@/charts/GenerationTrendChart'
import { ComparisonChart } from '@/charts/ComparisonChart'
import {
  useDailyEnergy,
  useInverters,
  useLatestPanelReadings,
  useMonthlyEnergy,
  usePanels,
  useRecentReadings,
} from '@/hooks/useSolarQueries'

export function AnalyticsPage() {
  const { data: inverters } = useInverters()
  const { data: panels } = usePanels()
  const { data: recentReadings, isLoading: loadingRecent } = useRecentReadings(150)
  const { data: dailyEnergy, isLoading: loadingDaily } = useDailyEnergy(90)
  const { data: monthlyEnergy, isLoading: loadingMonthly } = useMonthlyEnergy(36)
  const { data: panelReadings } = useLatestPanelReadings(100)

  const hourlyData = useMemo(() => {
    const map = new Map<string, number>()
    recentReadings?.forEach((r) => {
      const hour = new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      map.set(hour, (map.get(hour) ?? 0) + Number(r.power_w ?? 0))
    })
    return Array.from(map.entries()).map(([label, value]) => ({ label, value: Math.round(value) }))
  }, [recentReadings])

  const dailyData = useMemo(() => {
    const map = new Map<string, number>()
    dailyEnergy?.forEach((d) => {
      map.set(d.reading_date, (map.get(d.reading_date) ?? 0) + Number(d.energy_kwh))
    })
    return Array.from(map.entries()).map(([label, value]) => ({
      label,
      value: Number(value.toFixed(2)),
    }))
  }, [dailyEnergy])

  const weeklyData = useMemo(() => {
    const map = new Map<string, number>()
    dailyEnergy?.forEach((d) => {
      const dt = new Date(d.reading_date)
      const weekStart = new Date(dt)
      weekStart.setDate(dt.getDate() - dt.getDay())
      const key = weekStart.toISOString().slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + Number(d.energy_kwh))
    })
    return Array.from(map.entries()).map(([label, value]) => ({
      label: `Wk ${label.slice(5)}`,
      value: Number(value.toFixed(2)),
    }))
  }, [dailyEnergy])

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>()
    monthlyEnergy?.forEach((m) => {
      map.set(m.year_month, (map.get(m.year_month) ?? 0) + Number(m.energy_kwh))
    })
    return Array.from(map.entries()).map(([label, value]) => ({
      label,
      value: Number(value.toFixed(1)),
    }))
  }, [monthlyEnergy])

  const yearlyData = useMemo(() => {
    const map = new Map<string, number>()
    monthlyEnergy?.forEach((m) => {
      const yr = m.year_month.slice(0, 4)
      map.set(yr, (map.get(yr) ?? 0) + Number(m.energy_kwh))
    })
    return Array.from(map.entries()).map(([label, value]) => ({
      label,
      value: Number(value.toFixed(1)),
    }))
  }, [monthlyEnergy])

  const inverterComparison = useMemo(() => {
    const totals = new Map<string, number>()
    dailyEnergy?.forEach((d) => {
      totals.set(d.device_sn, (totals.get(d.device_sn) ?? 0) + Number(d.energy_kwh))
    })
    return (inverters ?? []).map((inv) => ({
      name: inv.name,
      value: Number((totals.get(inv.device_sn) ?? 0).toFixed(2)),
    }))
  }, [dailyEnergy, inverters])

  const panelComparison = useMemo(() => {
    const latest = new Map<string, number>()
    panelReadings?.forEach((r) => {
      if (!latest.has(r.panel_id) && r.power_w != null) {
        latest.set(r.panel_id, Number(r.power_w))
      }
    })
    return (panels ?? []).map((p) => ({
      name: p.name,
      value: Math.round(latest.get(p.id) ?? 0),
    }))
  }, [panelReadings, panels])

  const peakPowerW = useMemo(() => {
    const peaks = (dailyEnergy ?? []).map((d) => Number(d.peak_power_w ?? 0))
    return peaks.length > 0 ? Math.max(...peaks) : 0
  }, [dailyEnergy])

  if (loadingRecent || loadingDaily || loadingMonthly) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solar Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Multi-timeframe production trends, peak generation, and hardware comparisons.
          </p>
        </div>
        <Card className="px-4 py-2">
          <div className="text-xs text-muted-foreground">Recorded Peak Inverter Output</div>
          <div className="text-lg font-bold text-amber-500">{Math.round(peakPowerW)} W</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Energy Production Trends</CardTitle>
          <CardDescription>Switch between hourly, daily, weekly, monthly, and yearly views</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="daily">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="hourly">Hourly</TabsTrigger>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
            <TabsContent value="hourly">
              <GenerationTrendChart data={hourlyData} unit="W" type="line" height={320} />
            </TabsContent>
            <TabsContent value="daily">
              <GenerationTrendChart data={dailyData} unit="kWh" type="bar" height={320} />
            </TabsContent>
            <TabsContent value="weekly">
              <GenerationTrendChart data={weeklyData} unit="kWh" type="bar" height={320} />
            </TabsContent>
            <TabsContent value="monthly">
              <GenerationTrendChart data={monthlyData} unit="kWh" type="bar" height={320} color="#10b981" />
            </TabsContent>
            <TabsContent value="yearly">
              <GenerationTrendChart data={yearlyData} unit="kWh" type="bar" height={320} color="#3b82f6" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Inverter Comparison</CardTitle>
            <CardDescription>Cumulative energy (kWh) over the selected daily window</CardDescription>
          </CardHeader>
          <CardContent>
            <ComparisonChart data={inverterComparison} unit="kWh" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Panel Comparison</CardTitle>
            <CardDescription>Latest reported DC power (W) per configured panel</CardDescription>
          </CardHeader>
          <CardContent>
            {panelComparison.length > 0 ? (
              <ComparisonChart data={panelComparison} unit="W" />
            ) : (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No panel-level readings available yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
