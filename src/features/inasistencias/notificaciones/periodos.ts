import { superaLimite, type Comparacion, type CuentaFaltas } from '../conteo'

export type PeriodoNotificacion = 'mes' | 'bimestre' | 'trimestre' | 'cuatrimestre' | 'ciclo'

export const PERIODOS: { value: PeriodoNotificacion; label: string; enEl: string }[] = [
  { value: 'mes', label: 'Mes', enEl: 'el mes' },
  { value: 'bimestre', label: 'Bimestre', enEl: 'el bimestre' },
  { value: 'trimestre', label: 'Trimestre', enEl: 'el trimestre' },
  { value: 'cuatrimestre', label: 'Cuatrimestre', enEl: 'el cuatrimestre' },
  { value: 'ciclo', label: 'Ciclo lectivo', enEl: 'el ciclo lectivo' },
]

export interface NotificacionInasistencia {
  limite: number
  periodo: PeriodoNotificacion
  mensaje: string
  notificar_padres: boolean
  /** Qué inasistencias suman. Sin dato (reglas anteriores), todas. */
  cuenta?: CuentaFaltas
  /** Si el límite se cumple al alcanzarlo o al superarlo. Sin dato (reglas anteriores), al alcanzarlo. */
  comparacion?: Comparacion
}

export interface RangoFechas {
  desde: string
  hasta: string
}

/** Bimestres y trimestres cargados en Ciclo Lectivo, en orden. Si no hay, se calculan por bloques de meses. */
export interface PeriodosDefinidos {
  bimestres?: RangoFechas[] | null
  trimestres?: RangoFechas[] | null
}

export interface FechasCiclo {
  anio?: number
  inicio: string | null
  fin?: string | null
  c1_desde: string | null
  c1_hasta: string | null
  c2_desde: string | null
  c2_hasta: string | null
  periodos?: PeriodosDefinidos | null
}

export const RANGO_TODO: RangoFechas = { desde: '0000-01-01', hasta: '9999-12-31' }

const MES_INICIO_POR_DEFECTO = 3

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const ultimoDia = (y: number, m: number) => new Date(y, m, 0).getDate()

function mesInicio(ciclo: FechasCiclo | null): number {
  return ciclo?.inicio ? Number(ciclo.inicio.slice(5, 7)) : MES_INICIO_POR_DEFECTO
}

/**
 * Bloques de `n` meses contados desde el mes de inicio del ciclo. El último se corta en diciembre y nunca se
 * retoma en enero: el ciclo lectivo no cruza el año. Los meses anteriores al inicio caen en el primer bloque.
 */
function bloqueDeMeses(fecha: string, n: number, mesDeInicio: number): RangoFechas {
  const y = Number(fecha.slice(0, 4))
  const m = Number(fecha.slice(5, 7))
  const desdeMes = mesDeInicio + Math.floor(Math.max(0, m - mesDeInicio) / n) * n
  const finMes = Math.min(desdeMes + n - 1, 12)
  return {
    desde: iso(y, m < mesDeInicio ? 1 : desdeMes, 1),
    hasta: iso(y, finMes, ultimoDia(y, finMes)),
  }
}

/**
 * Ningún período pasa del fin del ciclo lectivo. El inicio no se recorta: la fecha de inicio identifica al
 * período (es la clave de las notificaciones ya generadas).
 */
function hastaElFinDelCiclo(rango: RangoFechas, ciclo: FechasCiclo | null): RangoFechas {
  const fin = ciclo?.fin
  return fin && fin >= rango.desde && fin < rango.hasta ? { ...rango, hasta: fin } : rango
}

/** Los bimestres o trimestres cargados en el ciclo (ordenados), o null si no se cargaron. */
export function periodosDefinidos(periodo: PeriodoNotificacion, ciclo: FechasCiclo | null): RangoFechas[] | null {
  const lista = periodo === 'bimestre' ? ciclo?.periodos?.bimestres : periodo === 'trimestre' ? ciclo?.periodos?.trimestres : null
  return lista && lista.length > 0 ? [...lista].sort((a, b) => a.desde.localeCompare(b.desde)) : null
}

/** Bimestre o trimestre que se calcula por bloques de meses porque el ciclo no los define (para avisarlo en pantalla). */
export const periodoSinDefinir = (periodo: PeriodoNotificacion, ciclo: FechasCiclo | null) =>
  (periodo === 'bimestre' || periodo === 'trimestre') && !periodosDefinidos(periodo, ciclo)

/** Número (1, 2, 3…) del bimestre o trimestre definido que empieza en `desde`; null si no hay ninguno. */
export function numeroDePeriodoDefinido(periodo: PeriodoNotificacion, desde: string, ciclo: FechasCiclo | null): number | null {
  const indice = periodosDefinidos(periodo, ciclo)?.findIndex((p) => p.desde === desde) ?? -1
  return indice >= 0 ? indice + 1 : null
}

/** El período de la lista que contiene la fecha. Una fecha fuera de todos (receso) va al próximo; si no hay, al último. */
function periodoDeLista(lista: RangoFechas[], fecha: string): RangoFechas {
  return lista.find((p) => p.desde <= fecha && fecha <= p.hasta) ?? lista.find((p) => p.desde > fecha) ?? lista[lista.length - 1]
}

export function rangoPeriodo(periodo: PeriodoNotificacion, fecha: string, ciclo: FechasCiclo | null): RangoFechas {
  const y = Number(fecha.slice(0, 4))
  const m = Number(fecha.slice(5, 7))
  switch (periodo) {
    case 'mes':
      return hastaElFinDelCiclo({ desde: iso(y, m, 1), hasta: iso(y, m, ultimoDia(y, m)) }, ciclo)
    case 'bimestre': {
      const definidos = periodosDefinidos('bimestre', ciclo)
      return definidos ? periodoDeLista(definidos, fecha) : hastaElFinDelCiclo(bloqueDeMeses(fecha, 2, mesInicio(ciclo)), ciclo)
    }
    case 'trimestre': {
      const definidos = periodosDefinidos('trimestre', ciclo)
      return definidos ? periodoDeLista(definidos, fecha) : hastaElFinDelCiclo(bloqueDeMeses(fecha, 3, mesInicio(ciclo)), ciclo)
    }
    case 'cuatrimestre':
      if (ciclo?.c1_desde && ciclo.c1_hasta && ciclo.c2_desde && ciclo.c2_hasta) {
        return fecha <= ciclo.c1_hasta
          ? { desde: ciclo.c1_desde, hasta: ciclo.c1_hasta }
          : { desde: ciclo.c2_desde, hasta: ciclo.c2_hasta }
      }
      return hastaElFinDelCiclo(bloqueDeMeses(fecha, 4, mesInicio(ciclo)), ciclo)
    default:
      return RANGO_TODO
  }
}

export function instanciaPeriodo(
  periodo: PeriodoNotificacion,
  fecha: string,
  ciclo: FechasCiclo | null,
): RangoFechas & { clave: string } {
  if (periodo === 'ciclo') {
    return { ...RANGO_TODO, clave: `${ciclo?.anio ?? fecha.slice(0, 4)}-01-01` }
  }
  const rango = rangoPeriodo(periodo, fecha, ciclo)
  return { ...rango, clave: rango.desde }
}

/**
 * Reglas cuyo límite se cruzó con la última falta cargada. `contar` recibe la regla para poder sumar solo las
 * inasistencias que ella cuenta (todas o solo las injustificadas).
 */
export function notificacionesCruzadas(
  notificaciones: NotificacionInasistencia[],
  contar: (rango: RangoFechas, regla: NotificacionInasistencia) => { antes: number; despues: number },
  fecha: string,
  ciclo: FechasCiclo | null,
): NotificacionInasistencia[] {
  return notificaciones
    .filter((n) => {
      const { antes, despues } = contar(rangoPeriodo(n.periodo ?? 'ciclo', fecha, ciclo), n)
      return superaLimite(despues, n.limite, n.comparacion) && !superaLimite(antes, n.limite, n.comparacion)
    })
    .sort((a, b) => a.limite - b.limite)
}

export function etiquetaPeriodo(periodo: PeriodoNotificacion | undefined): string {
  return PERIODOS.find((p) => p.value === (periodo ?? 'ciclo'))?.enEl ?? 'el ciclo lectivo'
}
