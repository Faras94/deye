import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Activity, Check, Lock, Pencil, Plus, Server, Trash2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import {
  useCollectionLogs,
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
  const { data: collectionLogs } = useCollectionLogs(100)

  const [newPanelName, setNewPanelName] = useState('')
  const [newPanelInvId, setNewPanelInvId] = useState('')
  const [newPanelChannel, setNewPanelChannel] = useState('1')
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null)
  const [editingPanelName, setEditingPanelName] = useState('')
  const [ghTokenInput, setGhTokenInput] = useState<string>(() => localStorage.getItem('deye-gh-pat') ?? '')
  const [ghTokenSaved, setGhTokenSaved] = useState<boolean>(() => Boolean(localStorage.getItem('deye-gh-pat')))

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

  const renamePanelMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      solarDataService.renamePanel(id, name),
    onSuccess: () => {
      setEditingPanelId(null)
      queryClient.invalidateQueries({ queryKey: ['panels'] })
    },
  })

  const deletePanelMutation = useMutation({
    mutationFn: (id: string) => solarDataService.deletePanel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panels'] })
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'viewer' }) =>
      solarDataService.updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  })

  const invById = useMemo(
    () => new Map((inverters ?? []).map((inv) => [inv.id, inv])),
    [inverters],
  )

  const apiUsage = useMemo(() => {
    const logs = collectionLogs ?? []
    const todayStr = new Date().toISOString().slice(0, 10)
    let todayCalls = 0
    let totalCalls = 0
    const endpoints: Record<string, number> = {}

    logs.forEach((log) => {
      const calls = Number(log.api_calls_made ?? 0)
      totalCalls += calls
      if (log.started_at.slice(0, 10) === todayStr) {
        todayCalls += calls
      }
      const ep = log.details?.endpoints
      if (ep) {
        Object.entries(ep).forEach(([path, count]) => {
          endpoints[path] = (endpoints[path] ?? 0) + Number(count ?? 0)
        })
      }
    })

    return {
      todayCalls,
      totalCalls,
      runCount: logs.length,
      endpoints: Object.entries(endpoints).sort((a, b) => b[1] - a[1]),
    }
  }, [collectionLogs])

  const formatEndpointName = (path: string) => {
    const names: Record<string, string> = {
      '/v1.0/device/latest': 'Live Telemetry',
      '/v1.0/account/token': 'Auth Token',
      '/v1.0/station/list': 'Station List',
      '/v1.0/station/device': 'Station Devices',
      '/v1.0/device/measurePoints': 'Measure Points',
      '/v1.0/device/history': 'Device History',
    }
    return names[path] ? `${names[path]} (${path})` : path
  }

  const visibleSettings = useMemo(
    () => (settings ?? []).filter((s) => !s.key.includes('token') && !s.key.includes('cache')),
    [settings],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings & Administration</h1>
        <p className="text-sm text-muted-foreground">
          Manage household users (max 5), microinverters, 630 W panels, and API usage limits.
        </p>
      </div>

      {!isAdmin && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm flex items-center gap-2 text-amber-600 dark:text-amber-300">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Viewer account: administrative changes are disabled by Row Level Security.</span>
        </div>
      )}

      {/* API Call Tracker & Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-emerald-500" />
            DeyeCloud API Usage & Quota Tracker
          </CardTitle>
          <CardDescription>
            Tracks every DeyeCloud API call made by the scheduled collector (dashboard reads use Supabase only = 0 DeyeCloud calls)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">API Calls Today (UTC)</div>
              <div className="text-2xl font-bold mt-0.5">{apiUsage.todayCalls}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                30-min schedule ≈ 48 calls/day
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Tracked Calls (Last {apiUsage.runCount} Runs)</div>
              <div className="text-2xl font-bold mt-0.5">{apiUsage.totalCalls}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Token cached to avoid extra auth calls
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Endpoints Called</div>
              {apiUsage.endpoints.length > 0 ? (
                <div className="mt-1 space-y-1">
                  {apiUsage.endpoints.map(([path, count]) => (
                    <div key={path} className="flex justify-between gap-2 text-xs">
                      <span className="truncate">{formatEndpointName(path)}</span>
                      <span className="font-semibold shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground mt-1">
                  Endpoint breakdown will appear after the next collector run
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Run Time</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">API Calls</th>
                  <th className="py-2 pr-3 font-medium">Endpoints</th>
                  <th className="py-2 pr-3 font-medium">Devices</th>
                  <th className="py-2 font-medium">Readings Saved</th>
                </tr>
              </thead>
              <tbody>
                {(collectionLogs ?? []).slice(0, 8).map((log) => {
                  const epEntries = Object.entries(log.details?.endpoints ?? {})
                  return (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {new Date(log.started_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={
                            log.status === 'success'
                              ? 'success'
                              : log.status === 'failed'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 font-semibold">{log.api_calls_made}</td>
                      <td className="py-2 pr-3 text-muted-foreground">
                        {epEntries.length > 0
                          ? epEntries.map(([p, c]) => `${formatEndpointName(p)} ×${c}`).join(', ')
                          : '—'}
                      </td>
                      <td className="py-2 pr-3">{log.devices_queried}</td>
                      <td className="py-2">{log.readings_inserted}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
            Add, rename, or remove physical 630 W panels ({panels?.length ?? 0} configured)
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
            {panels?.map((p) => {
              const inv = invById.get(p.inverter_id)
              const isEditing = editingPanelId === p.id

              return (
                <div
                  key={p.id}
                  className="rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingPanelName}
                          onChange={(e) => setEditingPanelName(e.target.value)}
                          className="h-7 text-xs"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={!editingPanelName.trim() || renamePanelMutation.isPending}
                          onClick={() =>
                            renamePanelMutation.mutate({
                              id: p.id,
                              name: editingPanelName.trim(),
                            })
                          }
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditingPanelId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-muted-foreground truncate">
                          {inv?.name ?? 'Inverter'} • PV{p.channel_index} • {p.rated_capacity_w} W
                        </div>
                      </>
                    )}
                  </div>

                  {isAdmin && !isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPanelId(p.id)
                          setEditingPanelName(p.name)
                        }}
                        title="Rename panel"
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePanelMutation.mutate(p.id)}
                        disabled={deletePanelMutation.isPending}
                        title="Delete panel"
                        className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Live API Trigger Setup */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live API Refresh (DeyeCloud On-Demand)</CardTitle>
            <CardDescription>
              Optional: save a GitHub Fine-Grained Token (Actions: Read &amp; Write on Faras94/deye)
              in this browser so the header&apos;s &quot;Live API&quot; button can trigger a fresh
              DeyeCloud collection immediately. Stored locally in your browser only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="password"
                placeholder="github_pat_..."
                value={ghTokenInput}
                onChange={(e) => setGhTokenInput(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => {
                  const trimmed = ghTokenInput.trim()
                  if (trimmed) {
                    localStorage.setItem('deye-gh-pat', trimmed)
                    setGhTokenSaved(true)
                  }
                }}
                disabled={!ghTokenInput.trim()}
              >
                Save Token
              </Button>
              {ghTokenSaved && (
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem('deye-gh-pat')
                    setGhTokenInput('')
                    setGhTokenSaved(false)
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
              <span>
                Status: {ghTokenSaved ? 'Configured in this browser' : 'Not configured'}
              </span>
              <a
                href="https://github.com/Faras94/deye/actions/workflows/collect-data.yml"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Open GitHub Actions Collector →
              </a>
            </div>
          </CardContent>
        </Card>
      )}

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
          {visibleSettings.map((s) => (
            <div key={s.key} className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">{s.description || s.key}</div>
              <div className="font-medium text-sm mt-0.5">
                {typeof s.value === 'string' ? s.value : String(s.value)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
