import { rangoPeriodo, type FechasCiclo, type RangoFechas } from './notificaciones/periodos'

export interface FaltaBoletin {
  fecha: string
  turno: string
  tipo: string
  valor: number
  justificada: boolean
}

export type FiltroJustificacion = 'todas' | 'justificadas' | 'injustificadas'

export interface Cuatrimestre extends RangoFechas {
  numero: number
  nombre: string
}

export interface TotalesPeriodo {
  justificadas: number
  injustificadas: number
  total: number
}

export interface FilaResumen extends TotalesPeriodo {
  cuatrimestre: Cuatrimestre
  /** Total desde el inicio del ciclo hasta el fin de este cuatrimestre. */
  acumulado: number
}

export interface Movimiento extends FaltaBoletin {
  cuatrimestre: number
  /** Suma de lo que se muestra hasta esta falta inclusive, como el saldo de un resumen de cuenta. */
  acumulado: number
}

export interface Extracto {
  /** Lo que sumaban las faltas del mismo filtro antes del período elegido ("saldo anterior"). */
  anterior: number
  movimientos: Movimiento[]
  total: number
}

const sumar = (faltas: FaltaBoletin[]) => faltas.reduce((s, f) => s + Number(f.valor), 0)

function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Los dos cuatrimestres del ciclo: las fechas cargadas en Ciclo Lectivo o, si faltan, bloques de 4 meses. */
export function cuatrimestresDelCiclo(ciclo: FechasCiclo | null): Cuatrimestre[] {
  const inicio = ciclo?.c1_desde ?? ciclo?.inicio ?? `${ciclo?.anio ?? new Date().getFullYear()}-03-01`
  const primero = rangoPeriodo('cuatrimestre', inicio, ciclo)
  const segundo = rangoPeriodo('cuatrimestre', diaSiguiente(primero.hasta), ciclo)
  const lista = segundo.desde === primero.desde ? [primero] : [primero, segundo]
  return lista.map((r, i) => ({ ...r, numero: i + 1, nombre: `${i + 1}° cuatrimestre` }))
}

/** A qué cuatrimestre (1 o 2) va una falta. Las del receso van al siguiente, como en el resto del sistema. */
export function cuatrimestreDeFecha(fecha: string, cuatrimestres: Cuatrimestre[], ciclo: FechasCiclo | null): number {
  const desde = rangoPeriodo('cuatrimestre', fecha, ciclo).desde
  return cuatrimestres.find((c) => c.desde === desde)?.numero ?? cuatrimestres[cuatrimestres.length - 1]?.numero ?? 1
}

const pasaFiltro = (f: FaltaBoletin, filtro: FiltroJustificacion) =>
  filtro === 'todas' || (filtro === 'justificadas' ? f.justificada : !f.justificada)

function ordenar<T extends FaltaBoletin>(faltas: T[]): T[] {
  const orden = (t: string) => (t === 'manana' ? 0 : t === 'tarde' ? 1 : 0)
  return [...faltas].sort((a, b) => a.fecha.localeCompare(b.fecha) || orden(a.turno) - orden(b.turno))
}

/** Justificadas, injustificadas y total de cada cuatrimestre, con el acumulado del ciclo al cierre de cada uno. */
export function resumenPorCuatrimestre(faltas: FaltaBoletin[], ciclo: FechasCiclo | null): FilaResumen[] {
  const cuatrimestres = cuatrimestresDelCiclo(ciclo)
  let acumulado = 0
  return cuatrimestres.map((c) => {
    const del = faltas.filter((f) => cuatrimestreDeFecha(f.fecha, cuatrimestres, ciclo) === c.numero)
    const justificadas = sumar(del.filter((f) => f.justificada))
    const injustificadas = sumar(del.filter((f) => !f.justificada))
    acumulado += justificadas + injustificadas
    return { cuatrimestre: c, justificadas, injustificadas, total: justificadas + injustificadas, acumulado }
  })
}

/**
 * Las faltas en orden, cada una con lo que suma al total. Con un cuatrimestre elegido, arranca con lo acumulado antes
 * ("saldo anterior") para que el total siga siendo el del ciclo. El acumulado respeta el filtro de justificación.
 */
export function extracto(
  faltas: FaltaBoletin[],
  ciclo: FechasCiclo | null,
  filtro: FiltroJustificacion = 'todas',
  cuatrimestre: number | null = null,
): Extracto {
  const cuatrimestres = cuatrimestresDelCiclo(ciclo)
  const conCuatrimestre = ordenar(faltas.filter((f) => pasaFiltro(f, filtro))).map((f) => ({
    ...f,
    cuatrimestre: cuatrimestreDeFecha(f.fecha, cuatrimestres, ciclo),
  }))
  const anterior = cuatrimestre === null ? 0 : sumar(conCuatrimestre.filter((f) => f.cuatrimestre < cuatrimestre))
  let acumulado = anterior
  const movimientos = conCuatrimestre
    .filter((f) => cuatrimestre === null || f.cuatrimestre === cuatrimestre)
    .map((f) => {
      acumulado += Number(f.valor)
      return { ...f, acumulado }
    })
  return { anterior, movimientos, total: acumulado }
}

export function etiquetaTurno(turno: string): string {
  return turno === 'manana' ? 'mañana' : turno === 'tarde' ? 'tarde' : ''
}
