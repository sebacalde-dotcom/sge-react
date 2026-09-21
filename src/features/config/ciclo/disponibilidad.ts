import { DIAS_SEMANA, TURNOS, modulosDelDia, type GrillaModulos, type Turno } from './grilla'

/** Un rango de horas en el que un docente puede dar clase un día. Un docente puede tener varias por día. */
export interface Franja {
  dia: number
  /** "HH:MM" */
  desde: string
  hasta: string
}

const FORMATO_HORA = /^\d{1,2}:\d{2}$/

const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Las horas que devuelve la base ("08:00:00") a "08:00". */
export const horaCorta = (hora: string): string => hora.slice(0, 5)

const nombreDia = (dia: number) => DIAS_SEMANA.find((d) => d.n === dia)?.label ?? `el día ${dia}`

/** El primer problema de una lista de franjas, o null si está bien. Dos franjas que se tocan (una termina cuando empieza la otra) son válidas. */
export function validarFranjas(franjas: Franja[]): string | null {
  for (const f of franjas) {
    if (!FORMATO_HORA.test(f.desde) || !FORMATO_HORA.test(f.hasta)) return `Completá las horas de una franja del ${nombreDia(f.dia)}`
    if (aMinutos(f.hasta) <= aMinutos(f.desde)) return `Una franja del ${nombreDia(f.dia)} termina antes de empezar`
  }
  for (const d of DIAS_SEMANA) {
    const delDia = franjas.filter((f) => f.dia === d.n).sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))
    for (let i = 1; i < delDia.length; i++) {
      if (aMinutos(delDia[i].desde) < aMinutos(delDia[i - 1].hasta)) return `Hay franjas superpuestas el ${d.label}`
    }
  }
  return null
}

/** Une las franjas de un mismo día que se superponen o se tocan, ordenadas por día y hora. */
export function fusionarFranjas(franjas: Franja[]): Franja[] {
  const resultado: Franja[] = []
  const ordenadas = [...franjas].sort((a, b) => a.dia - b.dia || aMinutos(a.desde) - aMinutos(b.desde))
  for (const f of ordenadas) {
    const ultima = resultado[resultado.length - 1]
    if (ultima && ultima.dia === f.dia && aMinutos(f.desde) <= aMinutos(ultima.hasta)) {
      if (aMinutos(f.hasta) > aMinutos(ultima.hasta)) ultima.hasta = f.hasta
    } else {
      resultado.push({ ...f })
    }
  }
  return resultado
}

/** ¿Un módulo (con su hora de inicio y de fin) cae por completo dentro de la disponibilidad de ese día? */
export function franjasCubren(franjas: Franja[], dia: number, inicio: string, fin: string): boolean {
  return fusionarFranjas(franjas).some((f) => f.dia === dia && aMinutos(f.desde) <= aMinutos(inicio) && aMinutos(f.hasta) >= aMinutos(fin))
}

export interface EspacioDeLaGrilla {
  turno: Turno
  dia: number
  /** Número de módulo dentro del día, desde 1. */
  modulo: number
}

/** Los espacios de la grilla (de todos los turnos) que caen dentro de la disponibilidad. */
export function espaciosDisponibles(franjas: Franja[], grilla: GrillaModulos | null | undefined): EspacioDeLaGrilla[] {
  const espacios: EspacioDeLaGrilla[] = []
  for (const t of TURNOS) {
    for (const d of DIAS_SEMANA) {
      modulosDelDia(grilla, t.value, d.n).forEach((m, i) => {
        if (franjasCubren(franjas, d.n, m.inicio, m.fin)) espacios.push({ turno: t.value, dia: d.n, modulo: i + 1 })
      })
    }
  }
  return espacios
}

/** Cuántos espacios tiene la grilla en total, de todos los turnos. */
export const totalEspacios = (grilla: GrillaModulos | null | undefined): number =>
  TURNOS.reduce((suma, t) => suma + DIAS_SEMANA.reduce((s, d) => s + modulosDelDia(grilla, t.value, d.n).length, 0), 0)

/** Desde el inicio del primer módulo hasta el final del último de un turno en un día, o null si ese día no tiene módulos. */
export function limitesDeTurno(grilla: GrillaModulos | null | undefined, turno: Turno, dia: number): { desde: string; hasta: string } | null {
  const modulos = modulosDelDia(grilla, turno, dia)
  return modulos.length > 0 ? { desde: modulos[0].inicio, hasta: modulos[modulos.length - 1].fin } : null
}

/**
 * ¿Puede el docente dar clase en este módulo? `null` si no cargó disponibilidad: sin datos se asume que puede en
 * cualquier horario, y el control no le marca nada.
 */
export function puedeDarClase(
  franjas: Franja[] | undefined,
  grilla: GrillaModulos | null | undefined,
  turno: Turno,
  dia: number,
  modulo: number,
): boolean | null {
  if (!franjas || franjas.length === 0) return null
  const m = modulosDelDia(grilla, turno, dia)[modulo - 1]
  return m ? franjasCubren(franjas, dia, m.inicio, m.fin) : null
}

export interface ControlDeCarga {
  estado: 'sin_disponibilidad' | 'alcanza' | 'no_alcanza'
  disponibles: number
  necesarios: number
}

/**
 * Compara los módulos por semana que dicta un docente con los espacios en los que está disponible. Sin disponibilidad
 * cargada no se puede controlar. Que alcance no garantiza el horario (puede haber otros choques), pero que no alcance
 * lo hace imposible.
 */
export function controlDeCarga(franjas: Franja[], grilla: GrillaModulos | null | undefined, necesarios: number): ControlDeCarga {
  if (franjas.length === 0) return { estado: 'sin_disponibilidad', disponibles: 0, necesarios }
  const disponibles = espaciosDisponibles(franjas, grilla).length
  return { estado: necesarios <= disponibles ? 'alcanza' : 'no_alcanza', disponibles, necesarios }
}

/** Las filas que devuelve la base, agrupadas por docente y con las horas sin segundos. */
export function agruparPorDocente(filas: { personal_id: string; dia: number; desde: string; hasta: string }[]): Map<string, Franja[]> {
  const mapa = new Map<string, Franja[]>()
  for (const f of filas) {
    mapa.set(f.personal_id, [...(mapa.get(f.personal_id) ?? []), { dia: f.dia, desde: horaCorta(f.desde), hasta: horaCorta(f.hasta) }])
  }
  return mapa
}

/** ¿La franja tiene las dos horas y termina después de empezar? */
export const franjaBienFormada = (f: Franja): boolean =>
  FORMATO_HORA.test(f.desde) && FORMATO_HORA.test(f.hasta) && aMinutos(f.hasta) > aMinutos(f.desde)
