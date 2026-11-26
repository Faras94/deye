import { useState } from 'react'
import { Cpu } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GenerationTrendChart } from '@/charts/GenerationTrendChart'
import { useInverters, useRecentReadings } from '@/hooks/useSolarQueries'
import { cn } from '@/lib/utils'

export function InvertersPage() {
  const { data: inverters, isLoading: loadingInv } = useInverters()
  const { data: readings, isLoading: loadingRead } = useRecentReadings(150)
  const [selectedSn, setSelectedSn] = useState<string | null>(null)

  if (loadingInv || loadingRead) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  const activeSn = selectedSn ?? inverters?.[0]?.device_sn ?? null
  const activeInverter = inverters?.find((i) => i.device_sn === activeSn)

  const selectedReadings = (readings ?? []).filter((r) => r.device_sn === activeSn)
  const chartData = selectedReadings.map((r) => ({
    label: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: Math.round(r.power_w ?? 0),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inverter Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Select a microinverter card to inspect its detailed telemetry history.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {inverters?.map((inv) => {
          const invReadings = (readings ?? []).filter((r) => r.device_sn === inv.device_sn)
          const latest = invReadings[invReadings.length - 1]
          const isSelected = inv.device_sn === activeSn

          return (
            <Card
              key={inv.id}
              onClick={() => setSelectedSn(inv.device_sn)}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/60',
                isSelected && 'ring-2 ring-primary border-primary',
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-amber-500" />
                    <CardTitle className="text-base">{inv.name}</CardTitle>
                  </div>
                  <Badge
                    variant={
                      inv.status === 'online'
                        ? 'success'
                        : inv.status === 'offline'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {inv.status}
                  </Badge>
                </div>
                <CardDescription>Device ID: {inv.device_sn}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Installed Capacity</div>
                  <div className="font-semibold">{inv.capacity_kw} kW</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Current Power</div>
                  <div className="font-semibold">
                    {latest?.power_w != null ? `${Math.round(latest.power_w)} W` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Today&apos;s Energy</div>
                  <div className="font-semibold">
                    {latest?.daily_energy_kwh != null ? `${latest.daily_energy_kwh} kWh` : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Energy</div>
                  <div className="font-semibold">
                    {latest?.total_energy_kwh != null ? `${latest.total_energy_kwh} kWh` : '—'}
                  </div>
                </div>
                <div className="col-span-2 pt-1 border-t text-xs text-muted-foreground">
                  Last comm:{' '}
                  {inv.last_communication_at
                    ? new Date(inv.last_communication_at).toLocaleString()
                    : 'Never'}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {activeInverter && (
        <Card>
          <CardHeader>
            <CardTitle>{activeInverter.name} — Detailed Power History</CardTitle>
            <CardDescription>
              Device SN: {activeInverter.device_sn} • Capacity: {activeInverter.capacity_kw} kW
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <GenerationTrendChart data={chartData} unit="W" height={320} />
            ) : (
              <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                No historical readings found for {activeInverter.device_sn}.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
