import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { traerTodo } from '@/features/inasistencias/datosCiclo'

export interface FilaDisponibilidad {
  id: string
  personal_id: string
  dia: number
  desde: string
  hasta: string
}

/** La disponibilidad de todos los docentes del ciclo. `disponible` es falso si todavía no se corrió la migración 018. */
export function useDisponibilidadCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['disponibilidad', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      try {
        const filas = await traerTodo<FilaDisponibilidad>((desde, hasta) =>
          supabase
            .from('docente_disponibilidad')
            .select('id, personal_id, dia, desde, hasta')
            .eq('ciclo_id', cicloId!)
            .order('id')
            .range(desde, hasta),
        )
        return { disponible: true, filas }
      } catch {
        return { disponible: false, filas: [] as FilaDisponibilidad[] }
      }
    },
  })
}
