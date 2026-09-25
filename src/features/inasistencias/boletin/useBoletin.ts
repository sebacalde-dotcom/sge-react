import { useMemo } from 'react'
import { useAlumnosCiclo, useFaltasCiclo, nombreCurso, type FaltaCiclo } from '../datosCiclo'
import { useAsistenciaPorMateria } from '../useAsistenciaPorMateria'
import type { AlumnoBoletin } from './BoletinHoja'

export const RUTA_BOLETIN = '/inasistencias/boletin'
export const RUTA_IMPRIMIR_BOLETIN = '/inasistencias/boletin/imprimir'

const SIN_FALTAS: FaltaCiclo[] = []

/** Alumnos de un curso con sus faltas del ciclo y, si se pide, su asistencia por materia. */
export function useBoletinCurso(cursoId: string | null | undefined, incluirMaterias: boolean) {
  const alumnosQ = useAlumnosCiclo()
  const faltasQ = useFaltasCiclo()

  const alumnos = useMemo<AlumnoBoletin[]>(
    () =>
      (alumnosQ.data ?? [])
        .filter((a) => a.curso_id === cursoId && a.personas)
        .map((a) => ({
          persona_id: a.persona_id,
          apellido: a.personas!.apellido,
          nombre: a.personas!.nombre,
          dni: a.personas!.dni,
          curso: nombreCurso(a.cursos),
        }))
        .sort((a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre)),
    [alumnosQ.data, cursoId],
  )

  const faltasPorAlumno = useMemo(() => {
    const mapa = new Map<string, FaltaCiclo[]>()
    for (const f of faltasQ.data ?? []) {
      const lista = mapa.get(f.persona_id)
      if (lista) lista.push(f)
      else mapa.set(f.persona_id, [f])
    }
    return mapa
  }, [faltasQ.data])

  const personaIds = useMemo(() => alumnos.map((a) => a.persona_id), [alumnos])
  const asistencia = useAsistenciaPorMateria(cursoId, personaIds, incluirMaterias)

  return {
    alumnos,
    faltasDe: (personaId: string) => faltasPorAlumno.get(personaId) ?? SIN_FALTAS,
    materiasDe: (personaId: string) => (incluirMaterias ? (asistencia.porAlumno[personaId] ?? []) : null),
    sinHorario: asistencia.sinHorario,
    isLoading: alumnosQ.isLoading || faltasQ.isLoading || (incluirMaterias && asistencia.isLoading),
  }
}
