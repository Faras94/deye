import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useAlerts } from '@/hooks/useSolarQueries'
import { solarDataService } from '@/services/solarDataService'

export function AlertsPage() {
  const { isAdmin, profile } = useAuth()
  const { data: alerts, isLoading } = useAlerts()
  const queryClient = useQueryClient()

  const resolveMutation = useMutation({
    mutationFn: (alertId: number) => solarDataService.resolveAlert(alertId, profile?.id ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Monitors inverter offline states, missing data, generation drops, and API auth errors.
        </p>
      </div>

      {!alerts || alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <div className="font-medium">No active alerts</div>
            <p className="text-sm text-muted-foreground">
              All microinverters and scheduled collections are operating normally.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-base">{alert.title}</CardTitle>
                    <Badge
                      variant={
                        alert.severity === 'critical'
                          ? 'destructive'
                          : alert.severity === 'warning'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {alert.severity}
                    </Badge>
                    {alert.is_resolved && <Badge variant="success">Resolved</Badge>}
                  </div>
                  <CardDescription>{alert.message}</CardDescription>
                </div>

                {!alert.is_resolved && isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate(alert.id)}
                  >
                    Mark Resolved
                  </Button>
                )}
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex gap-4">
                <span>Type: {alert.alert_type}</span>
                {alert.device_sn && <span>Device: {alert.device_sn}</span>}
                <span>Created: {new Date(alert.created_at).toLocaleString()}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
