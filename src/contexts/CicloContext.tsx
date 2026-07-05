import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

interface CicloData {
  id: string
  anio: number
  inicio: string | null
  fin: string | null
  c1_desde: string | null
  c1_hasta: string | null
  c2_desde: string | null
  c2_hasta: string | null
  dias_especiales: Record<string, { tipo: string; descripcion: string }>
}

interface CicloState {
  ciclo: CicloData | null
  cicloId: string | null
  isLoading: boolean
  setCicloId: (id: string) => void
}

const CicloContext = createContext<CicloState | null>(null)

export function CicloProvider({ children }: { children: ReactNode }) {
  const { isAuthorized } = useAuth()
  const [ciclo, setCiclo] = useState<CicloData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isAuthorized) return
    loadLatestCiclo()
  }, [isAuthorized])

  async function loadLatestCiclo() {
    setIsLoading(true)
    const { data } = await supabase
      .from('ciclos')
      .select('*')
      .order('anio', { ascending: false })
      .limit(1)
      .single()

    setCiclo(data as CicloData | null)
    setIsLoading(false)
  }

  function setCicloId(id: string) {
    supabase
      .from('ciclos')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setCiclo(data as CicloData)
      })
  }

  return (
    <CicloContext.Provider value={{
      ciclo,
      cicloId: ciclo?.id ?? null,
      isLoading,
      setCicloId,
    }}>
      {children}
    </CicloContext.Provider>
  )
}

export function useCiclo() {
  const ctx = useContext(CicloContext)
  if (!ctx) throw new Error('useCiclo must be used within CicloProvider')
  return ctx
}
