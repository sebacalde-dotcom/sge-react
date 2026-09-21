import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'

export interface CursoCiclo {
  id: string
  nombre: string
  division: string | null
  seccion_id: string | null
  /** 'manana', 'tarde' o 'doble'; existe después de la migración 015. Sin dato, rige el valor por defecto del ciclo. */
  turno?: string | null
  secciones: { id: string; nombre: string } | null
}

/** Los cursos del ciclo con su sección. Comparte la clave de consulta con la pestaña Cursos. */
export function useCursosCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['cursos', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cursos')
        .select('*, secciones(id, nombre)')
        .eq('ciclo_id', cicloId!)
        .order('nombre')
      if (error) throw error
      return data as CursoCiclo[]
    },
  })
}

/** ¿Ya se corrió la migración 015 (columna turno de los cursos)? Se sondea porque un ciclo sin cursos no lo muestra. */
export function useSoportaTurno() {
  const { data } = useQuery({
    queryKey: ['cursos-turno-soportado'],
    queryFn: async () => {
      const { error } = await supabase.from('cursos').select('turno').limit(1)
      return !error
    },
  })
  return data ?? true
}
