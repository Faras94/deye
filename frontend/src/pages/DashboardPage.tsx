import { Activity, AlertCircle, BatteryCharging, Calendar, Clock, Cpu, Sun, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GenerationTrendChart } from '@/charts/GenerationTrendChart'
import {
  useCollectionLogs,
  useInverters,
  useRecentReadings,
} from '@/hooks/useSolarQueries'

export function DashboardPage() {
  const { data: inverters, isLoading: loadingInv } = useInverters()
  const { data: readings, isLoading: loadingRead } = useRecentReadings(72)
  const { data: logs, isLoading: loadingLogs } = useCollectionLogs(10)

  const totalCapacityKw =
    inverters?.reduce((sum, inv) => sum + Number(inv.capacity_kw || 0), 0) ?? 5.4

  // Latest reading per inverter
  const latestBySn = new Map<string, (typeof readings extends (infer T)[] | undefined ? T : never)>()
  readings?.forEach((r) => {
    const prev = latestBySn.get(r.device_sn)
    if (!prev || r.recorded_at > prev.recorded_at) {
      latestBySn.set(r.device_sn, r)
    }
  })

  const latestList = Array.from(latestBySn.values())
  const currentPowerW = latestList.reduce((sum, r) => sum + Number(r.power_w ?? 0), 0)
  const todayEnergyKwh = latestList.reduce((sum, r) => sum + Number(r.daily_energy_kwh ?? 0), 0)
  const monthEnergyKwh = latestList.reduce((sum, r) => sum + Number(r.monthly_energy_kwh ?? 0), 0)
  const lifetimeEnergyKwh = latestList.reduce((sum, r) => sum + Number(r.total_energy_kwh ?? 0), 0)

  // Aggregate generation trend by timestamp
  const trendMap = new Map<string, number>()
  readings?.forEach((r) => {
    const label = new Date(r.recorded_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
    trendMap.set(label, (trendMap.get(label) ?? 0) + Number(r.power_w ?? 0))
  })
  const trendData = Array.from(trendMap.entries()).map(([label, value]) => ({
    label,
    value: Math.round(value),
  }))

  const lastSuccessIdx = logs?.findIndex((l) => l.status === 'success' || l.status === 'partial') ?? -1
  const lastSuccess = lastSuccessIdx >= 0 ? logs?.[lastSuccessIdx] : undefined
  const logsSinceLastSuccess = lastSuccessIdx >= 0 ? (logs?.slice(0, lastSuccessIdx) ?? []) : (logs ?? [])
  const recentErrors = logsSinceLastSuccess.filter((l) => l.status === 'failed' || l.error_message)

  if (loadingInv || loadingRead || loadingLogs) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solar Overview</h1>
          <p className="text-sm text-muted-foreground">
            Combined 3-microinverter installation • 5.4 kW AC capacity
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            Last successful sync:{' '}
            {lastSuccess?.finished_at
              ? new Date(lastSuccess.finished_at).toLocaleString()
              : 'Pending first run'}
          </span>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardDescription>Installed Capacity</CardDescription>
            <Sun className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCapacityKw.toFixed(1)} kW</div>
            <p className="text-xs text-muted-foreground mt-1">
              {inverters?.length ?? 3} Microinverters
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardDescription>Current Generation</CardDescription>
            <Zap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentPowerW >= 1000
                ? `${(currentPowerW / 1000).toFixed(2)} kW`
                : `${Math.round(currentPowerW)} W`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{Math.round(currentPowerW)} W AC</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardDescription>Energy Today</CardDescription>
            <Activity className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayEnergyKwh.toFixed(2)} kWh</div>
            <p className="text-xs text-muted-foreground mt-1">Daily cumulative</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardDescription>This Month</CardDescription>
            <Calendar className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthEnergyKwh.toFixed(1)} kWh</div>
            <p className="text-xs text-muted-foreground mt-1">Monthly cumulative</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardDescription>Lifetime Energy</CardDescription>
            <BatteryCharging className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lifetimeEnergyKwh >= 1000
                ? `${(lifetimeEnergyKwh / 1000).toFixed(2)} MWh`
                : `${lifetimeEnergyKwh.toFixed(1)} kWh`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lifetimeEnergyKwh.toFixed(0)} kWh total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Generation Trend + Inverter Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Generation Trend</CardTitle>
            <CardDescription>Combined AC output power across all 3 microinverters</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <GenerationTrendChart data={trendData} unit="W" height={300} />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
                No telemetry readings recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Microinverter Status</CardTitle>
            <CardDescription>Live health & latest output</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {inverters?.map((inv) => {
              const latest = latestBySn.get(inv.device_sn)
              const variant =
                inv.status === 'online'
                  ? 'success'
                  : inv.status === 'offline'
                    ? 'destructive'
                    : inv.status === 'alert'
                      ? 'warning'
                      : 'secondary'

              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm truncate">{inv.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      SN: {inv.device_sn} • {inv.capacity_kw} kW
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <Badge variant={variant}>{inv.status}</Badge>
                    <div className="text-xs font-semibold mt-1">
                      {latest?.power_w != null ? `${Math.round(latest.power_w)} W` : '—'}
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Collection Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            Recent Collection Logs & Errors
          </CardTitle>
          <CardDescription>Scheduled 30-minute GitHub Actions collector runs</CardDescription>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent collection errors. All scheduled runs completed cleanly.
            </p>
          ) : (
            <div className="space-y-2">
              {recentErrors.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
                >
                  <span className="text-destructive font-medium">
                    {log.error_message || `Collection ${log.status}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.started_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
