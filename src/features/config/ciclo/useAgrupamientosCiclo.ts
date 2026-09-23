import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { traerTodo } from '@/features/inasistencias/datosCiclo'
import { indicePorMateria, type Agrupamiento, type Grupo, type Membresia } from './agrupamientos'

export interface GrupoConDocente extends Grupo {
  personal: { apellido: string; nombre: string } | null
}

export interface AgrupamientoConDocentes extends Agrupamiento {
  grupos: GrupoConDocente[]
}

interface FilaAgrupamiento {
  id: string
  nombre: string
  agrupamiento_materias: { materia_id: string }[]
  grupos: GrupoConDocente[]
}

/** Los agrupamientos del ciclo con sus materias y grupos. `disponible` es falso si todavía no se corrió la migración 020. */
export function useAgrupamientosCiclo() {
  const { cicloId } = useCiclo()
  const { data, isLoading } = useQuery({
    queryKey: ['agrupamientos', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const { data: filas, error } = await supabase
        .from('agrupamientos')
        .select('id, nombre, agrupamiento_materias(materia_id), grupos(id, nombre, personal_id, personal:personas(apellido, nombre))')
        .eq('ciclo_id', cicloId!)
        .order('nombre')
      if (error) return { disponible: false, agrupamientos: [] as AgrupamientoConDocentes[] }
      const agrupamientos = (filas as unknown as FilaAgrupamiento[]).map((f) => ({
        id: f.id,
        nombre: f.nombre,
        materias: f.agrupamiento_materias.map((m) => m.materia_id),
        grupos: [...f.grupos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
      }))
      return { disponible: true, agrupamientos }
    },
  })

  const agrupamientos = useMemo(() => data?.agrupamientos ?? [], [data])
  const porMateria = useMemo(() => indicePorMateria(agrupamientos), [agrupamientos])
  /** Los nombres de los docentes de los grupos: pueden no dar ninguna materia por su cuenta. */
  const nombresDeDocentes = useMemo(() => {
    const nombres = new Map<string, string>()
    for (const a of agrupamientos) for (const g of a.grupos) if (g.personal_id && g.personal) nombres.set(g.personal_id, `${g.personal.apellido}, ${g.personal.nombre}`)
    return nombres
  }, [agrupamientos])

  return { disponible: data?.disponible ?? true, cargando: isLoading, agrupamientos, porMateria, nombresDeDocentes }
}

/** Los períodos en que cada alumno estuvo en cada grupo, de todos los agrupamientos del ciclo. */
export function useMembresiasCiclo(agrupamientoIds: string[]) {
  const clave = agrupamientoIds.join(',')
  return useQuery({
    queryKey: ['grupo-alumnos', clave],
    enabled: agrupamientoIds.length > 0,
    queryFn: () =>
      traerTodo<Membresia>((desde, hasta) =>
        supabase.from('grupo_alumnos').select('id, grupo_id, persona_id, desde, hasta').in('agrupamiento_id', agrupamientoIds).order('id').range(desde, hasta),
      ),
  })
}
