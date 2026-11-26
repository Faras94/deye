import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock, Plus, Server, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import {
  useInverters,
  usePanels,
  useProfiles,
  useSystemSettings,
} from '@/hooks/useSolarQueries'
import { solarDataService } from '@/services/solarDataService'

export function SettingsPage() {
  const { isAdmin, isDemoMode } = useAuth()
  const queryClient = useQueryClient()
  const { data: profiles } = useProfiles()
  const { data: inverters } = useInverters()
  const { data: panels } = usePanels()
  const { data: settings } = useSystemSettings()

  const [newPanelName, setNewPanelName] = useState('')
  const [newPanelInvId, setNewPanelInvId] = useState('')
  const [newPanelChannel, setNewPanelChannel] = useState('1')

  const addPanelMutation = useMutation({
    mutationFn: () =>
      solarDataService.upsertPanel({
        inverter_id: newPanelInvId || inverters?.[0]?.id || '',
        name: newPanelName.trim(),
        channel_index: Number(newPanelChannel),
        rated_capacity_w: 630,
      }),
    onSuccess: () => {
      setNewPanelName('')
      queryClient.invalidateQueries({ queryKey: ['panels'] })
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'viewer' }) =>
      solarDataService.updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings & Administration</h1>
        <p className="text-sm text-muted-foreground">
          Manage household users (max 5), microinverters, 630 W panels, and collector status.
        </p>
      </div>

      {!isAdmin && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex items-center gap-2 text-amber-600 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Viewer account: administrative changes are disabled by Row Level Security.</span>
        </div>
      )}

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            User Management ({profiles?.length ?? 0} / 5 Users)
          </CardTitle>
          <CardDescription>1 Admin + up to 4 Viewers sharing this installation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {profiles?.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{u.full_name || u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      roleMutation.mutate({
                        userId: u.id,
                        role: u.role === 'admin' ? 'viewer' : 'admin',
                      })
                    }
                  >
                    Make {u.role === 'admin' ? 'Viewer' : 'Admin'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Panel Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solar Panel Configuration (630 W Modules)</CardTitle>
          <CardDescription>
            Map each physical 630 W panel to its microinverter PV channel ({panels?.length ?? 0} configured)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label>Panel Name</Label>
                <Input
                  placeholder="e.g. Roof East #1"
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Microinverter</Label>
                <select
                  value={newPanelInvId || inverters?.[0]?.id || ''}
                  onChange={(e) => setNewPanelInvId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm"
                >
                  {inverters?.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>PV Channel (1-4)</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={newPanelChannel}
                  onChange={(e) => setNewPanelChannel(e.target.value)}
                />
              </div>
              <Button
                onClick={() => addPanelMutation.mutate()}
                disabled={!newPanelName.trim() || addPanelMutation.isPending}
              >
                <Plus className="h-4 w-4" />
                Add Panel
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {panels?.map((p) => (
              <div key={p.id} className="rounded-lg border px-3 py-2 text-xs flex justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">
                  PV{p.channel_index} • {p.rated_capacity_w} W
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System & API Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            Collector & Application Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Backend Mode</div>
            <div className="font-medium mt-0.5">
              {isDemoMode ? 'Demo Preview (Supabase env not set)' : 'Supabase PostgreSQL + RLS'}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">DeyeCloud Collector</div>
            <div className="font-medium mt-0.5">GitHub Actions (Every 30 minutes)</div>
          </div>
          {settings?.map((s) => (
            <div key={s.key} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{s.description || s.key}</div>
              <div className="font-mono text-xs mt-0.5">{JSON.stringify(s.value)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
