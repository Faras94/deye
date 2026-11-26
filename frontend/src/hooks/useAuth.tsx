import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/services/supabase'
import type { UserProfile, UserRole } from '@/types/v2'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  role: UserRole
  isAdmin: boolean
  isDemoMode: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  switchDemoRole: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const DEMO_PROFILES: Record<UserRole, UserProfile> = {
  admin: {
    id: 'demo-admin',
    email: 'admin@deye-solar.local',
    full_name: 'Solar Admin (Demo)',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  viewer: {
    id: 'demo-viewer',
    email: 'viewer@deye-solar.local',
    full_name: 'Family Viewer (Demo)',
    role: 'viewer',
    is_active: true,
    created_at: new Date().toISOString(),
  },
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(
    isSupabaseConfigured ? null : DEMO_PROFILES.admin,
  )
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured)

  useEffect(() => {
    const client = supabase
    if (!client) {
      setLoading(false)
      return
    }

    let mounted = true

    const loadProfile = async (userId: string) => {
      const { data } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (mounted) {
        setProfile((data as UserProfile | null) ?? null)
      }
    }

    client.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      if (s?.user) {
        await loadProfile(s.user.id)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      if (s?.user) {
        await loadProfile(s.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setProfile(null)
  }

  const switchDemoRole = (role: UserRole) => {
    if (!isSupabaseConfigured) {
      setProfile(DEMO_PROFILES[role])
    }
  }

  const role: UserRole = profile?.role ?? 'viewer'

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        role,
        isAdmin: role === 'admin',
        isDemoMode: !isSupabaseConfigured,
        loading,
        signIn,
        signOut,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
