import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  LayoutGrid,
  Leaf,
  Pencil,
  Sun,
  Thermometer,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { GenerationTrendChart } from '@/charts/GenerationTrendChart'
import {
  MicroinverterGraphic,
  PanelSparkline,
  SolarPanelGraphic,
} from '@/components/SolarGraphics'
import { SolarArrayView } from '@/components/SolarArrayView'
import { useAuth } from '@/hooks/useAuth'
import {
  useDailyEnergy,
  useInverters,
  useLatestPanelReadings,
  usePanels,
  useRecentReadings,
} from '@/hooks/useSolarQueries'
import { solarDataService } from '@/services/solarDataService'

export function PanelsPage() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { data: panels, isLoading: loadingPanels } = usePanels()
  const { data: inverters, isLoading: loadingInv } = useInverters()
  const { data: panelReadings, isLoading: loadingPanelReadings } = useLatestPanelReadings(200)
  const { data: invReadings } = useRecentReadings(150)
  const { data: dailyEnergy } = useDailyEnergy(30)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [trendRange, setTrendRange] = useState<'today' | '7d' | '30d'>('today')
  const [viewMode, setViewMode] = useState<'array' | 'grouped'>(() => {
    const saved = localStorage.getItem('deye-panels-view')
    return saved === 'grouped' ? 'grouped' : 'array'
  })

  const handleViewChange = (mode: 'array' | 'grouped') => {
    setViewMode(mode)
    localStorage.setItem('deye-panels-view', mode)
  }

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      solarDataService.renamePanel(id, name),
    onSuccess: () => {
      setEditingId(null)
      queryClient.invalidateQueries({ queryKey: ['panels'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => solarDataService.deletePanel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panels'] })
    },
  })

  const latestInvBySn = useMemo(() => {
    const map = new Map<string, NonNullable<typeof invReadings>[number]>()
    invReadings?.forEach((r) => {
      const prev = map.get(r.device_sn)
      if (!prev || r.recorded_at > prev.recorded_at) {
        map.set(r.device_sn, r)
      }
    })
    return map
  }, [invReadings])

  const readingsByPanel = useMemo(() => {
    const map = new Map<string, NonNullable<typeof panelReadings>>()
    panelReadings?.forEach((r) => {
      const list = map.get(r.panel_id) ?? []
      list.push(r)
      map.set(r.panel_id, list)
    })
    map.forEach((list) => list.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)))
    return map
  }, [panelReadings])

  const totalPowerW = Array.from(latestInvBySn.values()).reduce(
    (sum, r) => sum + Number(r.power_w ?? 0),
    0,
  )
  const totalTodayKwh = Array.from(latestInvBySn.values()).reduce(
    (sum, r) => sum + Number(r.daily_energy_kwh ?? 0),
    0,
  )
  const co2SavedKg = totalTodayKwh * 0.82
  const totalPanelCapacityKw =
    (panels?.reduce((s, p) => s + Number(p.rated_capacity_w || 0), 0) ?? 0) / 1000
  const totalInverterCapacityKw =
    inverters?.reduce((s, i) => s + Number(i.capacity_kw || 0), 0) ?? 5.4

  const trendData = useMemo(() => {
    if (trendRange === 'today') {
      const map = new Map<string, number>()
      invReadings?.forEach((r) => {
        const label = new Date(r.recorded_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
        map.set(label, (map.get(label) ?? 0) + Number(r.power_w ?? 0))
      })
      return Array.from(map.entries()).map(([label, value]) => ({
        label,
        value: Math.round(value),
      }))
    }

    const daysBack = trendRange === '7d' ? 7 : 30
    const cutoff = new Date(Date.now() - daysBack * 86400 * 1000).toISOString().slice(0, 10)
    const map = new Map<string, number>()
    dailyEnergy?.forEach((d) => {
      if (d.reading_date >= cutoff) {
        map.set(d.reading_date, (map.get(d.reading_date) ?? 0) + Number(d.energy_kwh))
      }
    })
    return Array.from(map.entries()).map(([label, value]) => ({
      label: label.slice(5),
      value: Number(value.toFixed(2)),
    }))
  }, [trendRange, invReadings, dailyEnergy])

  if (loadingPanels || loadingInv || loadingPanelReadings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const onlineInverters = inverters?.filter((i) => i.status === 'online').length ?? 0

  return (
    <div className="space-y-6">
      {/* Top Hero Summary Bar */}
      <div className="rounded-2xl border bg-gradient-to-r from-card via-card to-sky-950/20 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Sun className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Individual Panel View</h1>
            <p className="text-xs text-muted-foreground">
              Per-panel PV telemetry grouped by microinverter • 630 W modules
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border bg-background/60 px-3 py-2 flex items-center gap-2.5">
            <Zap className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[11px] text-muted-foreground">Total Generation</div>
              <div className="text-sm sm:text-base font-bold">
                {totalPowerW >= 1000
                  ? `${(totalPowerW / 1000).toFixed(2)} kW`
                  : `${Math.round(totalPowerW)} W`}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-background/60 px-3 py-2 flex items-center gap-2.5">
            <Sun className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[11px] text-muted-foreground">Today&apos;s Energy</div>
              <div className="text-sm sm:text-base font-bold">{totalTodayKwh.toFixed(2)} kWh</div>
            </div>
          </div>

          <div className="rounded-xl border bg-background/60 px-3 py-2 flex items-center gap-2.5">
            <Leaf className="h-4 w-4 text-emerald-500 shrink-0" />
            <div>
              <div className="text-[11px] text-muted-foreground">CO₂ Saved Today</div>
              <div className="text-sm sm:text-base font-bold">{co2SavedKg.toFixed(1)} kg</div>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex items-center justify-end gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1 text-xs">
          <button
            type="button"
            onClick={() => handleViewChange('array')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
              viewMode === 'array'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Array View (PV1–PV8)</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('grouped')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
              viewMode === 'grouped'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Inverter Grouped</span>
          </button>
        </div>
      </div>

      {/* Grouped Microinverter -> Panel Cards OR Array View (PV1-PV8) */}
      {!panels || panels.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Info className="h-8 w-8 text-muted-foreground mx-auto" />
            <div className="font-medium">No solar panels configured yet</div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              An Admin can configure the exact panel count and inverter-to-panel PV channel mapping
              in Settings. Panel readings are never fabricated from inverter totals.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'array' ? (
        <SolarArrayView
          panels={panels}
          inverters={inverters ?? []}
          readingsByPanel={readingsByPanel}
          latestInvBySn={latestInvBySn}
          totalPowerW={totalPowerW}
        />
      ) : (
        <div className="space-y-4">
          {inverters?.map((inv) => {
            const invPanels = panels.filter((p) => p.inverter_id === inv.id)
            if (invPanels.length === 0) return null

            const latestInv = latestInvBySn.get(inv.device_sn)
            const isOnline = inv.status === 'online'
            const isCollapsed = Boolean(collapsed[inv.id])
            const invPanelKwp =
              invPanels.reduce((s, p) => s + Number(p.rated_capacity_w || 0), 0) / 1000

            return (
              <Card key={inv.id} className="overflow-hidden border-border/80 bg-card/90">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-b">
                  <div className="flex items-center gap-3">
                    <MicroinverterGraphic online={isOnline} />
                    <div>
                      <div className="font-semibold text-sm sm:text-base">{inv.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {invPanelKwp.toFixed(2)} kWp ({invPanels.length}{' '}
                        {invPanels.length === 1 ? 'Panel' : 'Panels'}) • SN: {inv.device_sn}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
                    <Badge variant={isOnline ? 'success' : 'secondary'}>
                      {isOnline ? 'Online' : inv.status}
                    </Badge>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Current Power</div>
                      <div className="font-bold">
                        {latestInv?.power_w != null ? `${Math.round(latestInv.power_w)} W` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Today&apos;s Energy</div>
                      <div className="font-bold">
                        {latestInv?.daily_energy_kwh != null
                          ? `${latestInv.daily_energy_kwh.toFixed(2)} kWh`
                          : '—'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [inv.id]: !prev[inv.id] }))
                      }
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                      aria-label="Toggle inverter panels"
                    >
                      {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {invPanels.map((panel) => {
                      const history = readingsByPanel.get(panel.id) ?? []
                      const latest = history[history.length - 1]
                      const isEditing = editingId === panel.id
                      const hasLivePower = (latest?.power_w ?? 0) > 0
                      const sparkValues = history.slice(-16).map((h) => Number(h.power_w ?? 0))

                      return (
                        <div
                          key={panel.id}
                          className="rounded-xl border bg-background/70 overflow-hidden flex flex-col justify-between"
                        >
                          <div className="p-3.5 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              {isEditing ? (
                                <div className="flex items-center gap-1 w-full">
                                  <Input
                                    value={draftName}
                                    onChange={(e) => setDraftName(e.target.value)}
                                    className="h-7 text-xs"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    disabled={!draftName.trim() || renameMutation.isPending}
                                    onClick={() =>
                                      renameMutation.mutate({
                                        id: panel.id,
                                        name: draftName.trim(),
                                      })
                                    }
                                  >
                                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => setEditingId(null)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="font-semibold text-sm truncate">
                                    {panel.name}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span
                                      className={`inline-block h-2 w-2 rounded-full ${
                                        hasLivePower ? 'bg-emerald-400' : 'bg-slate-500'
                                      }`}
                                      title={hasLivePower ? 'Generating' : 'Idle / No data'}
                                    />
                                    <span className="text-[11px] text-muted-foreground">
                                      PV{panel.channel_index}
                                    </span>
                                    {isAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingId(panel.id)
                                            setDraftName(panel.name)
                                          }}
                                          title="Rename panel"
                                          className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => deleteMutation.mutate(panel.id)}
                                          disabled={deleteMutation.isPending}
                                          title="Delete panel"
                                          className="p-0.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <SolarPanelGraphic active={hasLivePower} />
                              <div className="text-right">
                                <div className="text-2xl font-bold tracking-tight">
                                  {latest?.power_w != null
                                    ? `${Math.round(latest.power_w)} W`
                                    : '— W'}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {latest?.performance_pct != null
                                    ? `${latest.performance_pct.toFixed(0)}% of ${panel.rated_capacity_w}W`
                                    : `${panel.rated_capacity_w} W rated`}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                              <span className="flex items-center gap-1">
                                <Zap className="h-3 w-3 text-amber-400" />
                                {latest?.total_energy_kwh != null
                                  ? `${latest.total_energy_kwh.toFixed(1)} kWh`
                                  : latest?.voltage_v != null
                                    ? `${latest.voltage_v.toFixed(1)} V`
                                    : 'No PV data yet'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Thermometer className="h-3 w-3" />
                                {latestInv?.temperature_c != null
                                  ? `${latestInv.temperature_c.toFixed(0)}°C`
                                  : '—'}
                              </span>
                            </div>
                          </div>

                          <PanelSparkline values={sparkValues} active={hasLivePower} />
                        </div>
                      )
                    })}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Bottom Row: Total Power Trend + System Summary + Performance Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-6">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Total Power Trend</CardTitle>
              <CardDescription>
                {trendRange === 'today' ? 'Intraday AC output (W)' : 'Daily energy (kWh)'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
              {(['today', '7d', '30d'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTrendRange(r)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    trendRange === r
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <GenerationTrendChart
              data={trendData}
              unit={trendRange === 'today' ? 'W' : 'kWh'}
              type={trendRange === 'today' ? 'line' : 'bar'}
              height={210}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Panels</span>
              <span className="font-semibold">{panels?.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Panel Capacity</span>
              <span className="font-semibold">{totalPanelCapacityKw.toFixed(2)} kWp</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Microinverters</span>
              <span className="font-semibold">{inverters?.length ?? 3}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inverter Rating</span>
              <span className="font-semibold">{totalInverterCapacityKw.toFixed(1)} kW</span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`lg:col-span-3 flex flex-col justify-center ${
            onlineInverters > 0
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-border bg-card'
          }`}
        >
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-base">
              <Leaf
                className={`h-5 w-5 ${
                  onlineInverters > 0 ? 'text-emerald-400' : 'text-muted-foreground'
                }`}
              />
              <span>
                {onlineInverters > 0 ? 'Active Generation' : 'Standby / Night Mode'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {onlineInverters > 0
                ? `${onlineInverters} of ${inverters?.length ?? 3} microinverters are online and feeding power.`
                : 'Microinverters are currently asleep or awaiting the next daylight telemetry cycle.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
