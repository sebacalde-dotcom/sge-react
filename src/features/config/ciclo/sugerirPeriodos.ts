import { diaInfo, type CalendarioCiclo } from '@/lib/calendario'
import type { RangoFechas } from '@/features/inasistencias/notificaciones/periodos'

const sumarDias = (iso: string, dias: number): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Días de clase entre dos fechas (inclusive): los que el calendario del ciclo marca como cursables. */
export function diasCursables(desde: string, hasta: string, calendario: CalendarioCiclo | null): string[] {
  const dias: string[] = []
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const [y, m, d] = f.split('-').map(Number)
    if (diaInfo(calendario, y, m, d).cursable) dias.push(f)
  }
  return dias
}

/**
 * Parte un tramo en `partes` períodos consecutivos con la misma cantidad de días de clase (feriados y asuetos no
 * cuentan). Cada período termina en su último día de clase y el siguiente empieza al día siguiente.
 */
export function partirPorDiasCursables(
  desde: string,
  hasta: string,
  partes: number,
  calendario: CalendarioCiclo | null,
): RangoFechas[] | null {
  const cursables = diasCursables(desde, hasta, calendario)
  if (partes < 1 || cursables.length < partes) return null
  const rangos: RangoFechas[] = []
  let inicio = desde
  for (let i = 1; i < partes; i++) {
    const corte = cursables[Math.ceil((cursables.length * i) / partes) - 1]
    rangos.push({ desde: inicio, hasta: corte })
    inicio = sumarDias(corte, 1)
  }
  rangos.push({ desde: inicio, hasta })
  return rangos
}

interface FechasParaSugerir {
  inicio: string
  fin: string
  c1_desde: string
  c1_hasta: string
  c2_desde: string
  c2_hasta: string
}

/**
 * Cuatro bimestres: cada cuatrimestre se parte en dos mitades de días de clase, así el 2° bimestre termina con el
 * 1° cuatrimestre y el 3° empieza con el 2°. Sin las fechas de los cuatrimestres, se parte todo el ciclo en cuatro.
 */
export function sugerirBimestres(f: FechasParaSugerir, calendario: CalendarioCiclo | null): RangoFechas[] | null {
  if (f.c1_desde && f.c1_hasta && f.c2_desde && f.c2_hasta) {
    const primero = partirPorDiasCursables(f.c1_desde, f.c1_hasta, 2, calendario)
    const segundo = partirPorDiasCursables(f.c2_desde, f.c2_hasta, 2, calendario)
    return primero && segundo ? [...primero, ...segundo] : null
  }
  return f.inicio && f.fin ? partirPorDiasCursables(f.inicio, f.fin, 4, calendario) : null
}

/** Tres trimestres con la misma cantidad de días de clase entre el inicio y el fin del ciclo. */
export function sugerirTrimestres(f: Pick<FechasParaSugerir, 'inicio' | 'fin'>, calendario: CalendarioCiclo | null): RangoFechas[] | null {
  return f.inicio && f.fin ? partirPorDiasCursables(f.inicio, f.fin, 3, calendario) : null
}

/** Primer problema de una lista de períodos cargados a mano (en orden), o null si está bien. */
export function validarPeriodos(
  nombre: string,
  periodos: RangoFechas[],
  ciclo: { inicio: string; fin: string },
): string | null {
  for (const [i, p] of periodos.entries()) {
    const n = `${i + 1}° ${nombre}`
    if (!p.desde || !p.hasta) return `Completá las fechas del ${n}`
    if (p.desde > p.hasta) return `El ${n} termina antes de empezar`
    if (ciclo.inicio && p.desde < ciclo.inicio) return `El ${n} empieza antes del inicio del ciclo`
    if (ciclo.fin && p.hasta > ciclo.fin) return `El ${n} termina después del fin del ciclo`
    const anterior = periodos[i - 1]
    if (anterior && p.desde <= anterior.hasta) return `El ${n} tiene que empezar después de que termine el ${i}° ${nombre}`
  }
  return null
}
