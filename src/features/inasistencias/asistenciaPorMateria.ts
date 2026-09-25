/**
 * Calcula la asistencia por materia de un alumno cruzando sus inasistencias con el horario del curso.
 *
 * Para cada día cursable del período se mira qué materias se dictaron (según el horario semanal) y si el alumno
 * estuvo ausente ese día (y turno, en doble turno). No hace falta registrar asistencia clase por clase: la
 * ausencia diaria se propaga a todas las materias de ese día.
 */

import type { CalendarioCiclo } from '@/lib/calendario'
import { diaInfo } from '@/lib/calendario'
import type { Turno } from '@/features/config/ciclo/grilla'

export interface ModuloHorario {
  materia_id: string
  dia: number // 1=lun ... 6=sab
  turno: Turno
}

export interface FaltaDiaria {
  fecha: string // YYYY-MM-DD
  turno: string // 'unico' | 'manana' | 'tarde'
  valor: number
  justificada: boolean
}

export interface AsistenciaMateria {
  materia_id: string
  modulos_totales: number
  modulos_perdidos: number
  porcentaje: number // 0–100, redondeado a 2 decimales
}

function diaDeSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  // JS: 0=dom, 1=lun ... 6=sab → convertir a 1=lun ... 6=sab, 0=dom
  return dow === 0 ? 7 : dow
}

function esCursable(calendario: CalendarioCiclo | null, fecha: string): boolean {
  const [y, m, d] = fecha.split('-').map(Number)
  return diaInfo(calendario, y, m, d).cursable
}

function fechasEnRango(desde: string, hasta: string): string[] {
  const fechas: string[] = []
  const d = new Date(desde + 'T12:00:00')
  const fin = new Date(hasta + 'T12:00:00')
  while (d <= fin) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    fechas.push(`${y}-${m}-${dd}`)
    d.setDate(d.getDate() + 1)
  }
  return fechas
}

/**
 * Calcula la asistencia por materia de un alumno en un rango de fechas.
 *
 * @param horario - módulos semanales del curso del alumno (de `horario_modulos`)
 * @param faltas - inasistencias del alumno en el período
 * @param calendario - calendario del ciclo (días especiales, inicio, fin)
 * @param desde - fecha inicio del rango (YYYY-MM-DD)
 * @param hasta - fecha fin del rango (YYYY-MM-DD)
 * @param turnos - turnos en los que cursa el curso (dos = doble turno, y las faltas se registran por turno)
 */
export function calcularAsistenciaPorMateria(
  horario: ModuloHorario[],
  faltas: FaltaDiaria[],
  calendario: CalendarioCiclo | null,
  desde: string,
  hasta: string,
  turnos: Turno[],
): AsistenciaMateria[] {
  if (horario.length === 0 || turnos.length === 0) return []
  const dobleTurno = turnos.length > 1

  // Indexar horario por día+turno → materias (con repetición = módulos)
  const horarioPorDiaTurno = new Map<string, string[]>()
  for (const m of horario) {
    const clave = `${m.dia}_${m.turno}`
    const lista = horarioPorDiaTurno.get(clave)
    if (lista) lista.push(m.materia_id)
    else horarioPorDiaTurno.set(clave, [m.materia_id])
  }

  // Indexar faltas por fecha+turno
  const faltasPorFechaTurno = new Map<string, FaltaDiaria>()
  for (const f of faltas) {
    faltasPorFechaTurno.set(`${f.fecha}_${f.turno}`, f)
  }

  // Acumuladores por materia
  const totales = new Map<string, number>()
  const perdidos = new Map<string, number>()

  for (const fecha of fechasEnRango(desde, hasta)) {
    if (!esCursable(calendario, fecha)) continue

    const dow = diaDeSemana(fecha)

    for (const turno of turnos) {
      const materiasDia = horarioPorDiaTurno.get(`${dow}_${turno}`)
      if (!materiasDia) continue

      // Contar módulos por materia este día
      for (const materiaId of materiasDia) {
        totales.set(materiaId, (totales.get(materiaId) ?? 0) + 1)
      }

      // ¿Faltó este día en este turno?
      const turnoFalta = dobleTurno ? turno : 'unico'
      const falta = faltasPorFechaTurno.get(`${fecha}_${turnoFalta}`)
      if (falta) {
        for (const materiaId of materiasDia) {
          perdidos.set(materiaId, (perdidos.get(materiaId) ?? 0) + 1)
        }
      }
    }
  }

  const resultado: AsistenciaMateria[] = []
  for (const [materiaId, total] of totales) {
    const perdido = perdidos.get(materiaId) ?? 0
    const porcentaje = total > 0 ? Math.round(((total - perdido) / total) * 10000) / 100 : 100
    resultado.push({
      materia_id: materiaId,
      modulos_totales: total,
      modulos_perdidos: perdido,
      porcentaje,
    })
  }

  return resultado.sort((a, b) => a.porcentaje - b.porcentaje)
}

/** Materias que no llegan al porcentaje mínimo de asistencia. */
export function materiasEnRiesgo(
  asistencia: AsistenciaMateria[],
  minimoAsistencia = 75,
): AsistenciaMateria[] {
  return asistencia.filter((a) => a.porcentaje < minimoAsistencia)
}
