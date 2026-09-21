import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { DiaEspecial } from '@/lib/calendario'
import type { PeriodosDefinidos } from '@/features/inasistencias/notificaciones/periodos'
import type { GrillaModulos } from '@/features/config/ciclo/grilla'
import type { ReglasHorario } from '@/features/config/ciclo/generador'
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
  dias_especiales: Record<string, DiaEspecial> | null
  doble_turno?: boolean
  // Existe después de la migración 012
  periodos?: PeriodosDefinidos | null
  // Existe después de la migración 013: 'pba' o 'caba'; vacío = el de la jurisdicción de la institución
  regimen?: string | null
  // Existe después de la migración 015: los módulos de cada turno y de cada día
  grilla_modulos?: GrillaModulos | null
  // Existe después de la migración 019: las reglas del director para armar el horario
  reglas_horario?: ReglasHorario | null
}

interface CicloState {
  ciclo: CicloData | null
  cicloId: string | null
  isLoading: boolean
  setCicloId: (id: string) => void
  refresh: () => Promise<void>
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

  async function refresh() {
    if (!ciclo) return
    const { data } = await supabase.from('ciclos').select('*').eq('id', ciclo.id).single()
    if (data) setCiclo(data as CicloData)
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
      refresh,
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
