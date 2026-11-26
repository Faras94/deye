import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { LoginPage } from '@/pages/LoginPage'

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const InvertersPage = lazy(() =>
  import('@/pages/InvertersPage').then((m) => ({ default: m.InvertersPage })),
)
const PanelsPage = lazy(() =>
  import('@/pages/PanelsPage').then((m) => ({ default: m.PanelsPage })),
)
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)
const HistoryPage = lazy(() =>
  import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
)
const AlertsPage = lazy(() =>
  import('@/pages/AlertsPage').then((m) => ({ default: m.AlertsPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function PageLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function AppRoutes({ darkMode, onToggleDark }: { darkMode: boolean; onToggleDark: () => void }) {
  const { user, isDemoMode, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Skeleton className="h-48 w-96" />
      </div>
    )
  }

  if (!isDemoMode && !user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<DashboardLayout darkMode={darkMode} onToggleDark={onToggleDark} />}>
        <Route
          path="/"
          element={
            <Suspense fallback={<PageLoader />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/inverters"
          element={
            <Suspense fallback={<PageLoader />}>
              <InvertersPage />
            </Suspense>
          }
        />
        <Route
          path="/panels"
          element={
            <Suspense fallback={<PageLoader />}>
              <PanelsPage />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnalyticsPage />
            </Suspense>
          }
        />
        <Route
          path="/history"
          element={
            <Suspense fallback={<PageLoader />}>
              <HistoryPage />
            </Suspense>
          }
        />
        <Route
          path="/alerts"
          element={
            <Suspense fallback={<PageLoader />}>
              <AlertsPage />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <SettingsPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('deye-theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('deye-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes darkMode={darkMode} onToggleDark={() => setDarkMode((d) => !d)} />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
