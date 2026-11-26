import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cpu,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/hooks/useAuth'
import { useAlerts } from '@/hooks/useSolarQueries'
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
  const { profile, role, isDemoMode, signOut, switchDemoRole } = useAuth()
  const { data: alerts } = useAlerts()

  const unresolvedAlerts = alerts?.filter((a) => !a.is_resolved).length ?? 0

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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-emerald-500" />
              <span className="hidden sm:inline">DeyeCloud Scheduled Collector (30m)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDemoMode ? (
              <Badge variant="warning" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Demo Mode (Connect Supabase for Live Data)
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Supabase Connected
              </Badge>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
