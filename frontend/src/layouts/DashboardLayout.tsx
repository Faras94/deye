import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cloud,
  Cpu,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { useAlerts, useCollectionLogs } from '@/hooks/useSolarQueries'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inverters', label: 'Inverters', icon: Cpu },
  { to: '/panels', label: 'Panels', icon: Zap },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/history', label: 'History', icon: History },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface DashboardLayoutProps {
  darkMode: boolean
  onToggleDark: () => void
  children?: ReactNode
}

export function DashboardLayout({ darkMode, onToggleDark }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    return localStorage.getItem('deye-auto-refresh') === 'true'
  })
  const [refreshMinutes, setRefreshMinutes] = useState<number>(() => {
    const saved = Number(localStorage.getItem('deye-refresh-minutes'))
    return saved > 0 && saved !== 30 ? saved : 5
  })
  const [refreshing, setRefreshing] = useState(false)
  const [liveSyncing, setLiveSyncing] = useState(false)
  const [liveStatusMsg, setLiveStatusMsg] = useState<string | null>(null)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date())
  const [lastRefreshMode, setLastRefreshMode] = useState<'auto-cache' | 'manual-cache' | 'live-api'>(
    'manual-cache',
  )
  const queryClient = useQueryClient()
  const { profile, role, isAdmin, isDemoMode, signOut, switchDemoRole } = useAuth()
  const { data: alerts } = useAlerts()
  const { data: collectionLogs } = useCollectionLogs(1)
  const lastCollectedAt = collectionLogs?.[0]?.started_at

  const unresolvedAlerts = alerts?.filter((a) => !a.is_resolved).length ?? 0

  const handleCacheRefresh = async () => {
    setRefreshing(true)
    setLiveStatusMsg(null)
    await queryClient.invalidateQueries()
    setLastRefreshedAt(new Date())
    setLastRefreshMode('manual-cache')
    setTimeout(() => setRefreshing(false), 400)
  }

  const handleLiveApiRefresh = async () => {
    if (isDemoMode) {
      setLiveStatusMsg('Live API sync is disabled in Demo Mode.')
      return
    }
    const ghToken = localStorage.getItem('deye-gh-pat')?.trim()
    if (!ghToken) {
      setLiveStatusMsg(
        isAdmin
          ? 'Set a GitHub Actions token in Settings → Live API Trigger to run from here.'
          : 'Ask an Admin to configure the Live API trigger token in Settings.',
      )
      return
    }

    setLiveSyncing(true)
    setLiveStatusMsg('Triggering DeyeCloud collector...')
    const triggerTime = new Date().toISOString()

    try {
      const resp = await fetch(
        'https://api.github.com/repos/Faras94/deye/actions/workflows/collect-data.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${ghToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        },
      )

      if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(`GitHub API ${resp.status}: ${errText.slice(0, 120)}`)
      }

      setLiveStatusMsg('Collector started — waiting for fresh DeyeCloud data...')

      // Poll collection_logs via React Query every 5s up to 60s
      let completed = false
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise((r) => setTimeout(r, 5000))
        await queryClient.invalidateQueries({ queryKey: ['collection_logs'] })
        const logs = queryClient.getQueryData<Array<{ started_at: string; status: string }>>([
          'collection_logs',
          1,
        ])
        const latest = logs?.[0]
        if (latest && latest.started_at >= triggerTime && latest.status !== 'running') {
          completed = true
          break
        }
      }

      await queryClient.invalidateQueries()
      setLastRefreshedAt(new Date())
      setLastRefreshMode('live-api')
      setLiveStatusMsg(
        completed
          ? 'Live DeyeCloud data loaded.'
          : 'Collector triggered. Data will appear shortly — click Cache to reload.',
      )
    } catch (err) {
      setLiveStatusMsg(err instanceof Error ? err.message : 'Failed to trigger Live API sync')
    } finally {
      setLiveSyncing(false)
    }
  }

  useEffect(() => {
    localStorage.setItem('deye-auto-refresh', String(autoRefresh))
    localStorage.setItem('deye-refresh-minutes', String(refreshMinutes))
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      queryClient.invalidateQueries()
      setLastRefreshedAt(new Date())
      setLastRefreshMode('auto-cache')
    }, refreshMinutes * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, refreshMinutes, queryClient])

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
            <Sun className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold tracking-tight text-foreground">Deye Solar</div>
            <div className="text-xs text-muted-foreground">Monitor V2 • 5.4 kW</div>
          </div>
        </div>

        <Separator />

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.to === '/alerts' && unresolvedAlerts > 0 && (
                  <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                    {unresolvedAlerts}
                  </Badge>
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4">
        <Separator />
        <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground truncate">
              {profile?.full_name || profile?.email || 'User'}
            </span>
            <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="text-[10px]">
              {role}
            </Badge>
          </div>
          {isDemoMode && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground">Preview role:</span>
              <button
                type="button"
                onClick={() => switchDemoRole(role === 'admin' ? 'viewer' : 'admin')}
                className="text-primary hover:underline font-medium"
              >
                Switch to {role === 'admin' ? 'viewer' : 'admin'}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 justify-start"
            onClick={onToggleDark}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </Button>
          {!isDemoMode && (
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r bg-card/60 backdrop-blur-sm">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 bg-card border-r h-full">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-md px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-foreground">Deye Solar</span>
              <span className="text-xs">Monitor V2</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1 text-xs">
              <span className="hidden sm:inline text-muted-foreground">Auto-refresh</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                aria-label="Toggle dashboard auto-refresh"
              />
              <select
                value={refreshMinutes}
                onChange={(e) => setRefreshMinutes(Number(e.target.value))}
                disabled={!autoRefresh}
                aria-label="Auto-refresh interval"
                className="bg-transparent text-xs font-medium focus:outline-none disabled:opacity-50"
              >
                <option value={1}>1m</option>
                <option value={5}>5m</option>
                <option value={10}>10m</option>
                <option value={15}>15m</option>
                <option value={60}>1h</option>
              </select>
            </div>

            <div className="flex items-center rounded-lg border bg-card p-0.5 gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleCacheRefresh}
                disabled={refreshing}
                title="Load from Cache / Supabase Memory (0 DeyeCloud API calls)"
              >
                <Database className={cn('h-3.5 w-3.5 text-sky-500', refreshing && 'animate-pulse')} />
                <span>Cache</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={handleLiveApiRefresh}
                disabled={liveSyncing}
                title={
                  lastCollectedAt
                    ? `Fetch Live from DeyeCloud API (last collected ${new Date(lastCollectedAt).toLocaleTimeString()})`
                    : 'Fetch Live from DeyeCloud API'
                }
              >
                <Cloud className={cn('h-3.5 w-3.5 text-emerald-500', liveSyncing && 'animate-pulse')} />
                <span>{liveSyncing ? 'Syncing...' : 'Live API'}</span>
              </Button>
            </div>

            <span className="hidden md:inline text-xs text-muted-foreground whitespace-nowrap">
              {lastRefreshedAt.toLocaleTimeString()}{' '}
              <span className="text-[10px]">
                (
                {lastRefreshMode === 'auto-cache'
                  ? `Auto ${refreshMinutes}m • Cache`
                  : lastRefreshMode === 'live-api'
                    ? 'Live API'
                    : 'Manual • Cache'}
                )
              </span>
            </span>

            {isDemoMode ? (
              <Badge variant="warning" className="gap-1 hidden md:inline-flex">
                <ShieldCheck className="h-3 w-3" />
                Demo Mode
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1 hidden md:inline-flex">
                <ShieldCheck className="h-3 w-3" />
                Supabase Connected
              </Badge>
            )}
          </div>
        </header>

        {liveStatusMsg && (
          <div className="border-b bg-muted/50 px-4 lg:px-6 py-2 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className={cn('h-3.5 w-3.5 shrink-0', liveSyncing && 'animate-spin text-emerald-500')} />
              <span>{liveStatusMsg}</span>
              <NavLink to="/settings" className="text-primary hover:underline font-medium">
                Settings
              </NavLink>
            </div>
            <button
              type="button"
              onClick={() => setLiveStatusMsg(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss status"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <main className="flex-1 p-4 pb-20 sm:p-6 sm:pb-20 lg:p-8 lg:pb-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-md grid grid-cols-5 h-16">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={`mobile-${item.to}`}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
