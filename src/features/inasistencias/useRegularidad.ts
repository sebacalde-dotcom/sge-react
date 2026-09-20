import { useMemo } from 'react'
import { useCiclo } from '@/contexts/CicloContext'
import { useConfig } from '@/hooks/useConfig'
import {
  nombreCurso,
  useAlumnosCiclo,
  useFaltasCiclo,
  useReincorporaciones,
  type FaltaCiclo,
  type PersonaBasica,
} from './datosCiclo'
import { evaluarRegularidad, type EstadoRegularidad, type ReglaRegularidad, type ReincorporacionRegla } from './regularidad'

interface ConfigRegularidad {
  reglas_regularidad?: ReglaRegularidad[]
  limite_no_regular?: number
  /** Algunos regímenes (ej.: CABA) no admiten reincorporaciones por criterio institucional. Sin dato, se permiten. */
  permite_reincorporaciones?: boolean
}

const LIMITE_POR_DEFECTO = 25

export function reglasDesdeConfig(config: ConfigRegularidad | undefined): ReglaRegularidad[] {
  if (config?.reglas_regularidad !== undefined) {
    return config.reglas_regularidad.map((r) => ({ ...r, periodo: r.periodo ?? 'ciclo' }))
  }
  return [{ limite: config?.limite_no_regular ?? LIMITE_POR_DEFECTO, periodo: 'ciclo' }]
}

// Las reglas viven en la config de inasistencias; hasta que se guarden, se toma el límite único anterior como regla de ciclo.
export function useReglasRegularidad() {
  const { data, isLoading } = useConfig<ConfigRegularidad>('inasistencias')
  const reglas = useMemo(() => reglasDesdeConfig(data), [data])
  return { reglas, isLoading }
}

export function usePermiteReincorporaciones(): boolean {
  const { data } = useConfig<ConfigRegularidad>('inasistencias')
  return data?.permite_reincorporaciones ?? true
}

export const hoyISO = () => new Date().toISOString().slice(0, 10)

export interface AlumnoRegularidad extends PersonaBasica {
  persona_id: string
  curso: string
  faltas: FaltaCiclo[]
  ultimaReincorporacion: string | null
  reincorporaciones: ReincorporacionRegla[]
  estado: EstadoRegularidad
}

export function useRegularidad() {
  const { ciclo } = useCiclo()
  const { reglas, isLoading: cargandoReglas } = useReglasRegularidad()
  const alumnosQ = useAlumnosCiclo()
  const faltasQ = useFaltasCiclo()
  const reincQ = useReincorporaciones()

  const alumnos = useMemo(() => {
    const lista: AlumnoRegularidad[] = []
    if (!alumnosQ.data || !faltasQ.data || !reincQ.data) return lista

    const faltasPorPersona = new Map<string, FaltaCiclo[]>()
    for (const f of faltasQ.data) {
      const l = faltasPorPersona.get(f.persona_id)
      if (l) l.push(f)
      else faltasPorPersona.set(f.persona_id, [f])
    }

    const reincPorPersona = new Map<string, ReincorporacionRegla[]>()
    for (const r of reincQ.data.filas) {
      const item: ReincorporacionRegla = { fecha: r.fecha, reglas: r.reglas ?? null }
      const l = reincPorPersona.get(r.persona_id)
      if (l) l.push(item)
      else reincPorPersona.set(r.persona_id, [item])
    }

    const hoy = hoyISO()
    for (const a of alumnosQ.data) {
      if (!a.personas) continue
      const faltas = faltasPorPersona.get(a.persona_id) ?? []
      const reincs = reincPorPersona.get(a.persona_id) ?? []
      const ultima = reincs.reduce<string | null>((max, r) => (!max || r.fecha > max ? r.fecha : max), null)
      lista.push({
        ...a.personas,
        persona_id: a.persona_id,
        curso: nombreCurso(a.cursos),
        faltas,
        ultimaReincorporacion: ultima,
        reincorporaciones: reincs,
        estado: evaluarRegularidad(faltas, reglas, ciclo, reincs, hoy),
      })
    }
    return lista.sort((x, y) => x.apellido.localeCompare(y.apellido) || x.nombre.localeCompare(y.nombre))
  }, [alumnosQ.data, faltasQ.data, reincQ.data, reglas, ciclo])

  return {
    alumnos,
    noRegulares: alumnos.filter((a) => a.estado.noRegular),
    reincorporaciones: reincQ.data?.filas ?? [],
    reglas,
    isLoading: cargandoReglas || alumnosQ.isLoading || faltasQ.isLoading || reincQ.isLoading,
    tablaDisponible: reincQ.data?.disponible ?? true,
    soportaReglas: reincQ.data?.soportaReglas ?? true,
  }
}
