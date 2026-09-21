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
  /** El módulo lo puso a mano quien arma el horario y el generador lo respeta. Existe después de la migración 019. */
  fijo?: boolean
}

/** Sin la migración 019 no se sabe cuáles son fijos: lo cargado a mano se toma como fijo. */
export const esFijo = (fila: Pick<FilaHorario, 'fijo'>): boolean => fila.fijo ?? true

/**
 * El horario guardado de todos los cursos del ciclo. `disponible` es falso si todavía no se corrió la migración 016 y
 * `soportaFijo` si falta la 019.
 */
export function useHorarioCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['horario', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const traer = (columnas: string) =>
        traerTodo<FilaHorario>((desde, hasta) =>
          supabase.from('horario_modulos').select(columnas).eq('ciclo_id', cicloId!).order('id').range(desde, hasta),
        )
      try {
        return { disponible: true, soportaFijo: true, filas: await traer('id, curso_id, materia_id, dia, turno, modulo, fijo') }
      } catch {
        // Sin la migración 019 no existe la columna "fijo"
      }
      try {
        return { disponible: true, soportaFijo: false, filas: await traer('id, curso_id, materia_id, dia, turno, modulo') }
      } catch {
        return { disponible: false, soportaFijo: false, filas: [] as FilaHorario[] }
      }
    },
  })
}
