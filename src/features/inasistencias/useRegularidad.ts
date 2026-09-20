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
import { evaluarRegularidad, type EstadoRegularidad, type ReglaRegularidad } from './regularidad'

interface ConfigRegularidad {
  reglas_regularidad?: ReglaRegularidad[]
  limite_no_regular?: number
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

export const hoyISO = () => new Date().toISOString().slice(0, 10)

export interface AlumnoRegularidad extends PersonaBasica {
  persona_id: string
  curso: string
  faltas: FaltaCiclo[]
  ultimaReincorporacion: string | null
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

    const ultimaPorPersona = new Map<string, string>()
    for (const r of reincQ.data.filas) {
      const actual = ultimaPorPersona.get(r.persona_id)
      if (!actual || r.fecha > actual) ultimaPorPersona.set(r.persona_id, r.fecha)
    }

    const hoy = hoyISO()
    for (const a of alumnosQ.data) {
      if (!a.personas) continue
      const faltas = faltasPorPersona.get(a.persona_id) ?? []
      const ultima = ultimaPorPersona.get(a.persona_id) ?? null
      lista.push({
        ...a.personas,
        persona_id: a.persona_id,
        curso: nombreCurso(a.cursos),
        faltas,
        ultimaReincorporacion: ultima,
        estado: evaluarRegularidad(faltas, reglas, ciclo, ultima, hoy),
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
  }
}
