import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { traerTodo } from '@/features/inasistencias/datosCiclo'
import type { Turno } from './grilla'

export interface FilaHorario {
  id: string
  curso_id: string
  materia_id: string
  dia: number
  turno: Turno
  modulo: number
}

/** El horario guardado de todos los cursos del ciclo. `disponible` es falso si todavía no se corrió la migración 016. */
export function useHorarioCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['horario', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      try {
        const filas = await traerTodo<FilaHorario>((desde, hasta) =>
          supabase
            .from('horario_modulos')
            .select('id, curso_id, materia_id, dia, turno, modulo')
            .eq('ciclo_id', cicloId!)
            .order('id')
            .range(desde, hasta),
        )
        return { disponible: true, filas }
      } catch {
        return { disponible: false, filas: [] as FilaHorario[] }
      }
    },
  })
}
