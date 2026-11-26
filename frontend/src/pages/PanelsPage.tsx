import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Info, Pencil, Trash2, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useInverters, useLatestPanelReadings, usePanels } from '@/hooks/useSolarQueries'
import { solarDataService } from '@/services/solarDataService'

export function PanelsPage() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const { data: panels, isLoading: loadingPanels } = usePanels()
  const { data: inverters } = useInverters()
  const { data: readings, isLoading: loadingReadings } = useLatestPanelReadings(100)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

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

  if (loadingPanels || loadingReadings) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    )
  }

  const invById = new Map((inverters ?? []).map((i) => [i.id, i]))
  const latestByPanelId = new Map<string, NonNullable<typeof readings>[number]>()
  readings?.forEach((r) => {
    const prev = latestByPanelId.get(r.panel_id)
    if (!prev || r.recorded_at > prev.recorded_at) {
      latestByPanelId.set(r.panel_id, r)
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Individual Panel Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Per-panel telemetry when reported by DeyeCloud PV channels (630 W rated modules).
        </p>
      </div>

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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {panels.map((panel) => {
            const inv = invById.get(panel.inverter_id)
            const latest = latestByPanelId.get(panel.id)
            const perf = latest?.performance_pct
            const isEditing = editingId === panel.id

            return (
              <Card key={panel.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" />
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
                              renameMutation.mutate({ id: panel.id, name: draftName.trim() })
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
                        <CardTitle className="text-sm truncate">{panel.name}</CardTitle>
                      )}
                    </div>
                    <Badge variant={latest ? 'success' : 'secondary'}>
                      PV{panel.channel_index}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs flex items-center justify-between gap-2">
                    <span className="truncate">
                      {inv?.name ?? 'Inverter'} • {panel.rated_capacity_w} W
                    </span>
                    {isAdmin && !isEditing && (
                      <span className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(panel.id)
                            setDraftName(panel.name)
                          }}
                          title="Rename panel"
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(panel.id)}
                          disabled={deleteMutation.isPending}
                          title="Delete panel"
                          className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Power</span>
                    <span className="font-semibold">
                      {latest?.power_w != null ? `${Math.round(latest.power_w)} W` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Daily Gen</span>
                    <span className="font-semibold">
                      {latest?.daily_energy_kwh != null ? `${latest.daily_energy_kwh} kWh` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Gen</span>
                    <span className="font-semibold">
                      {latest?.total_energy_kwh != null ? `${latest.total_energy_kwh} kWh` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t">
                    <span className="text-muted-foreground text-xs">Performance</span>
                    {perf != null ? (
                      <Badge variant={perf >= 70 ? 'success' : 'warning'}>{perf.toFixed(1)}%</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Insufficient data</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
