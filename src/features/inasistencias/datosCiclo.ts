import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import type { ReglaRegularidad } from './regularidad'

export interface PersonaBasica {
  apellido: string
  nombre: string
  dni: string | null
}

export interface AlumnoCiclo {
  persona_id: string
  personas: PersonaBasica | null
  cursos: { nombre: string; division: string | null } | null
}

export interface FaltaCiclo {
  persona_id: string
  fecha: string
  tipo: string
  valor: number
  justificada: boolean
}

export interface ReincorporacionFila {
  id: string
  persona_id: string
  ciclo_id: string
  fecha: string
  observaciones: string | null
  reglas?: ReglaRegularidad[] | null
  personas: PersonaBasica | null
  personal: { apellido: string; nombre: string } | null
}

export async function traerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tamano = 1000
  const filas: T[] = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await pagina(desde, desde + tamano - 1)
    if (error) throw error
    filas.push(...((data ?? []) as T[]))
    if (!data || data.length < tamano) break
  }
  return filas
}

export const nombreCurso = (c: AlumnoCiclo['cursos']) => (c ? `${c.nombre}${c.division ? ` ${c.division}` : ''}` : '')

export function useAlumnosCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['ciclo-datos', 'alumnos', cicloId],
    enabled: !!cicloId,
    queryFn: () =>
      traerTodo<AlumnoCiclo>((desde, hasta) =>
        supabase
          .from('alumno_datos')
          .select(
            'persona_id, personas!alumno_datos_persona_id_fkey(apellido, nombre, dni), cursos!alumno_datos_curso_id_fkey(nombre, division)',
          )
          .eq('ciclo_id', cicloId!)
          .eq('estado', 'activo')
          .order('persona_id')
          .range(desde, hasta),
      ),
  })
}

export function useFaltasCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['ciclo-datos', 'faltas', cicloId],
    enabled: !!cicloId,
    queryFn: () =>
      traerTodo<FaltaCiclo>((desde, hasta) =>
        supabase
          .from('inasistencias')
          .select('persona_id, fecha, tipo, valor, justificada')
          .eq('ciclo_id', cicloId!)
          .order('id')
          .range(desde, hasta),
      ),
  })
}

export function useReincorporaciones() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['ciclo-datos', 'reincorporaciones', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const traer = (columnas: string) =>
        traerTodo<ReincorporacionFila>((desde, hasta) =>
          supabase
            .from('reincorporaciones')
            // Dos relaciones distintas hacia personas (el alumno y quien autorizó): hace falta el nombre de cada FK
            .select(
              `id, persona_id, ciclo_id, fecha, observaciones, ${columnas}personas!reincorporaciones_persona_id_fkey(apellido, nombre, dni), personal:personas!reincorporaciones_autorizada_por_fkey(apellido, nombre)`,
            )
            .eq('ciclo_id', cicloId!)
            .order('fecha', { ascending: false })
            .range(desde, hasta),
        )
      try {
        return { disponible: true, soportaReglas: true, filas: await traer('reglas, ') }
      } catch {
        // Sin la columna reglas (migración 008): cada reincorporación reinicia todas las reglas.
        try {
          return { disponible: true, soportaReglas: false, filas: await traer('') }
        } catch {
          return { disponible: false, soportaReglas: false, filas: [] as ReincorporacionFila[] }
        }
      }
    },
  })
}
