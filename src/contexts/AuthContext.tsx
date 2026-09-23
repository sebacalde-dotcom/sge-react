import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/constants'

interface PersonalData {
  id: string
  apellido: string
  nombre: string
  email: string
  rol: UserRole
  foto_url: string | null
}

interface AuthState {
  user: User | null
  personal: PersonalData | null
  isLoading: boolean
  isAuthorized: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [personal, setPersonal] = useState<PersonalData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        lookupPersonal(session.user)
      } else {
        setIsLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        lookupPersonal(session.user)
      } else {
        setPersonal(null)
        setIsLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function lookupPersonal(authUser: User) {
    const email = authUser.email?.toLowerCase()
    if (!email) {
      setIsLoading(false)
      return
    }

    // El acceso es un legajo (personas) con rol asignado: sin rol, no está autorizado aunque el mail coincida.
    const { data, error } = await supabase
      .from('personas')
      .select('id, apellido, nombre, email, rol, foto_url')
      .ilike('email', email)
      .is('archivado_at', null)
      .not('rol', 'is', null)
      .single()

    if (error || !data) {
      await supabase.auth.signOut()
      setPersonal(null)
    } else {
      if (!data.foto_url && authUser.user_metadata?.avatar_url) {
        data.foto_url = authUser.user_metadata.avatar_url
      }
      setPersonal(data as PersonalData)

      // Vincula el usuario de Google con su legajo (personas.auth_user_id).
      // Usa una función SECURITY DEFINER para saltear la RLS en el primer login
      // (ver supabase/migrations/002_link_user.sql y 021_unificar_personal_en_personas.sql).
      await supabase.rpc('link_current_user')
    }

    setIsLoading(false)
  }

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setPersonal(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      personal,
      isLoading,
      isAuthorized: !!personal,
      signIn,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
