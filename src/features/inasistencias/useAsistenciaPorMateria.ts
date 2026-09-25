import { useMemo } from 'react'
import { useCiclo } from '@/contexts/CicloContext'
import { useHorarioCiclo } from '@/features/config/ciclo/useHorarioCiclo'
import { useMateriasCiclo } from '@/features/config/ciclo/useMateriasCiclo'
import { useCursosCiclo } from '@/features/config/ciclo/useCursosCiclo'
import { turnosDelCurso, type Turno } from '@/features/config/ciclo/grilla'
import { useFaltasCiclo, type FaltaCiclo } from './datosCiclo'
import { hoyISO } from './useRegularidad'
import { calcularAsistenciaPorMateria, type AsistenciaMateria } from './asistenciaPorMateria'

export interface AsistenciaMateriaConNombre extends AsistenciaMateria {
  nombre: string
}

/** Porcentaje mínimo de asistencia por materia (PBA). */
export const MINIMO_ASISTENCIA_MATERIA = 75

/**
 * Asistencia por materia de los alumnos de un curso, desde el inicio del ciclo hasta hoy, derivada de sus faltas
 * diarias guardadas y del horario del curso. Todavía no considera cursos adicionales ni agrupamientos.
 */
export function useAsistenciaPorMateria(cursoId: string | null | undefined, personaIds: string[], activo: boolean) {
  const { ciclo } = useCiclo()
  const horarioQ = useHorarioCiclo()
  const materiasQ = useMateriasCiclo()
  const cursosQ = useCursosCiclo()
  const faltasQ = useFaltasCiclo()

  const idsClave = personaIds.join(',')

  const porAlumno = useMemo<Record<string, AsistenciaMateriaConNombre[]>>(() => {
    const resultado: Record<string, AsistenciaMateriaConNombre[]> = {}
    if (!activo || !cursoId || !ciclo?.inicio || !horarioQ.data || !faltasQ.data) return resultado

    const curso = cursosQ.data?.find((c) => c.id === cursoId)
    const horario = horarioQ.data.filas.filter((f) => f.curso_id === cursoId)
    let turnos: Turno[] = turnosDelCurso(curso?.turno ?? (ciclo.doble_turno ? 'doble' : null))
    // Sin turno cargado en el curso, se usan los turnos que aparecen en su horario
    if (turnos.length === 0) turnos = [...new Set(horario.map((f) => f.turno))]

    const hoy = hoyISO()
    const hasta = ciclo.fin && ciclo.fin < hoy ? ciclo.fin : hoy
    const nombres = new Map((materiasQ.data?.filas ?? []).map((m) => [m.id, m.nombre]))

    const ids = new Set(idsClave.split(','))
    const faltasPorAlumno = new Map<string, FaltaCiclo[]>()
    for (const f of faltasQ.data) {
      if (!ids.has(f.persona_id)) continue
      const lista = faltasPorAlumno.get(f.persona_id)
      if (lista) lista.push(f)
      else faltasPorAlumno.set(f.persona_id, [f])
    }

    for (const id of ids) {
      if (!id) continue
      resultado[id] = calcularAsistenciaPorMateria(horario, faltasPorAlumno.get(id) ?? [], ciclo, ciclo.inicio, hasta, turnos)
        .map((a) => ({ ...a, nombre: nombres.get(a.materia_id) ?? 'Materia' }))
    }
    return resultado
  }, [activo, cursoId, idsClave, ciclo, horarioQ.data, faltasQ.data, cursosQ.data, materiasQ.data])

  return {
    porAlumno,
    /** Falso si todavía no se corrió la migración del horario. */
    horarioDisponible: horarioQ.data?.disponible ?? true,
    /** El curso no tiene horario cargado: no se puede calcular. */
    sinHorario: !!cursoId && !!horarioQ.data && !horarioQ.data.filas.some((f) => f.curso_id === cursoId),
    isLoading: horarioQ.isLoading || faltasQ.isLoading || materiasQ.isLoading || cursosQ.isLoading,
  }
}
