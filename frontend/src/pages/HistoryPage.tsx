import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useInverters } from '@/hooks/useSolarQueries'
import { solarDataService } from '@/services/solarDataService'

function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function HistoryPage() {
  const { data: inverters } = useInverters()
  const [deviceSn, setDeviceSn] = useState('all')
  const [startDateTime, setStartDateTime] = useState('')
  const [endDateTime, setEndDateTime] = useState('')
  const [activePreset, setActivePreset] = useState<'all' | '1h' | '6h' | '24h' | '7d'>('all')
  const [page, setPage] = useState(0)
  const pageSize = 20

  const startIso = startDateTime ? new Date(startDateTime).toISOString() : undefined
  const endIso = endDateTime ? new Date(endDateTime).toISOString() : undefined

  const { data, isLoading } = useQuery({
    queryKey: ['history_page', page, deviceSn, startIso, endIso],
    queryFn: () =>
      solarDataService.getHistoryPage({
        page,
        pageSize,
        deviceSn,
        startIso,
        endIso,
      }),
    staleTime: 30_000,
  })

  const applyPreset = (preset: 'all' | '1h' | '6h' | '24h' | '7d') => {
    setActivePreset(preset)
    setPage(0)
    if (preset === 'all') {
      setStartDateTime('')
      setEndDateTime('')
      return
    }
    const now = new Date()
    const hoursMap = { '1h': 1, '6h': 6, '24h': 24, '7d': 24 * 7 }
    const start = new Date(now.getTime() - hoursMap[preset] * 3600 * 1000)
    setStartDateTime(toLocalDatetimeInput(start))
    setEndDateTime(toLocalDatetimeInput(now))
  }

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const handleExportCsv = () => {
    if (rows.length === 0) return
    const headers = [
      'recorded_at_utc',
      'device_sn',
      'status',
      'power_w',
      'daily_energy_kwh',
      'monthly_energy_kwh',
      'total_energy_kwh',
      'ac_voltage_v',
      'temperature_c',
    ]
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.recorded_at,
          r.device_sn,
          r.status,
          r.power_w ?? '',
          r.daily_energy_kwh ?? '',
          r.monthly_energy_kwh ?? '',
          r.total_energy_kwh ?? '',
          r.ac_voltage_v ?? '',
          r.temperature_c ?? '',
        ].join(','),
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deye-solar-history-page-${page + 1}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historical Records</h1>
          <p className="text-sm text-muted-foreground">
            Filter stored telemetry by 1-hour / custom date &amp; time range or inverter and export to CSV.
          </p>
        </div>
        <Button variant="outline" onClick={handleExportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: '1h', label: 'Last 1 Hour' },
                { id: '6h', label: '6 Hours' },
                { id: '24h', label: '24 Hours' },
                { id: '7d', label: '7 Days' },
                { id: 'all', label: 'All' },
              ] as const
            ).map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={activePreset === p.id ? 'default' : 'outline'}
                onClick={() => applyPreset(p.id)}
                className="h-7 px-2.5 text-xs"
              >
                <Clock className="h-3 w-3" />
                {p.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="inverter-filter">Inverter</Label>
            <select
              id="inverter-filter"
              value={deviceSn}
              onChange={(e) => {
                setDeviceSn(e.target.value)
                setPage(0)
              }}
              className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="all">All Microinverters</option>
              {inverters?.map((inv) => (
                <option key={inv.id} value={inv.device_sn}>
                  {inv.name} ({inv.device_sn})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-datetime">Start Date &amp; Time</Label>
            <Input
              id="start-datetime"
              type="datetime-local"
              value={startDateTime}
              onChange={(e) => {
                setStartDateTime(e.target.value)
                setActivePreset('all')
                setPage(0)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-datetime">End Date &amp; Time</Label>
            <Input
              id="end-datetime"
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => {
                setEndDateTime(e.target.value)
                setActivePreset('all')
                setPage(0)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Telemetry Log</CardTitle>
          <CardDescription>
            Showing {rows.length} of {total} records (Page {page + 1} of {totalPages})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No historical records match the selected filters.
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="space-y-2.5 md:hidden">
                {rows.map((r) => (
                  <div
                    key={`m-${r.device_sn}-${r.recorded_at}-${r.id}`}
                    className="rounded-xl border p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {new Date(r.recorded_at).toLocaleString()}
                      </span>
                      <Badge variant={r.status === 'online' ? 'success' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div>
                        SN: <span className="font-mono text-foreground">{r.device_sn}</span>
                      </div>
                      <div>
                        Power:{' '}
                        <span className="font-semibold text-foreground">
                          {r.power_w != null ? `${Math.round(r.power_w)} W` : '—'}
                        </span>
                      </div>
                      <div>
                        Daily:{' '}
                        <span className="font-semibold text-foreground">
                          {r.daily_energy_kwh != null ? `${r.daily_energy_kwh} kWh` : '—'}
                        </span>
                      </div>
                      <div>
                        Total:{' '}
                        <span className="font-semibold text-foreground">
                          {r.total_energy_kwh != null ? `${r.total_energy_kwh} kWh` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Timestamp</th>
                      <th className="py-2 pr-4 font-medium">Inverter SN</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Power</th>
                      <th className="py-2 pr-4 font-medium">Daily</th>
                      <th className="py-2 pr-4 font-medium">Total</th>
                      <th className="py-2 font-medium">Temp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={`${r.device_sn}-${r.recorded_at}-${r.id}`}
                        className="border-b last:border-0"
                      >
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {new Date(r.recorded_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">{r.device_sn}</td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={r.status === 'online' ? 'success' : 'secondary'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.power_w != null ? `${Math.round(r.power_w)} W` : '—'}
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.daily_energy_kwh != null ? `${r.daily_energy_kwh} kWh` : '—'}
                        </td>
                        <td className="py-2.5 pr-4">
                          {r.total_energy_kwh != null ? `${r.total_energy_kwh} kWh` : '—'}
                        </td>
                        <td className="py-2.5">
                          {r.temperature_c != null ? `${r.temperature_c} °C` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
