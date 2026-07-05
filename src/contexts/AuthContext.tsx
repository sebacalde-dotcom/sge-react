import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/constants'

interface PersonalData {
  id: string
  apellido: string
  nombre: string
  mail: string
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

    const { data, error } = await supabase
      .from('personal')
      .select('id, apellido, nombre, mail, rol, foto_url')
      .ilike('mail', email)
      .eq('eliminado', false)
      .single()

    if (error || !data) {
      await supabase.auth.signOut()
      setPersonal(null)
    } else {
      if (!data.foto_url && authUser.user_metadata?.avatar_url) {
        data.foto_url = authUser.user_metadata.avatar_url
      }
      setPersonal(data as PersonalData)

      await supabase
        .from('personal')
        .update({ auth_user_id: authUser.id })
        .eq('id', data.id)
        .is('auth_user_id', null)
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
