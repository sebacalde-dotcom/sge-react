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
}

export interface FechasCiclo {
  inicio: string | null
  c1_desde: string | null
  c1_hasta: string | null
  c2_desde: string | null
  c2_hasta: string | null
}

export interface RangoFechas {
  desde: string
  hasta: string
}

export const RANGO_TODO: RangoFechas = { desde: '0000-01-01', hasta: '9999-12-31' }

const MES_INICIO_POR_DEFECTO = 3

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
const ultimoDia = (y: number, m: number) => new Date(y, m, 0).getDate()

function mesInicio(ciclo: FechasCiclo | null): number {
  return ciclo?.inicio ? Number(ciclo.inicio.slice(5, 7)) : MES_INICIO_POR_DEFECTO
}

function bloqueDeMeses(fecha: string, n: number, mesDeInicio: number): RangoFechas {
  const y = Number(fecha.slice(0, 4))
  const m = Number(fecha.slice(5, 7))
  const k = (m - mesDeInicio + 12) % 12
  const offset = Math.floor(k / n) * n
  const desdeMes = ((mesDeInicio - 1 + offset) % 12) + 1
  const desdeAnio = desdeMes > m ? y - 1 : y
  const finAbs = desdeAnio * 12 + (desdeMes - 1) + (n - 1)
  const finAnio = Math.floor(finAbs / 12)
  const finMes = (finAbs % 12) + 1
  return {
    desde: desdeAnio < y ? iso(y, 1, 1) : iso(desdeAnio, desdeMes, 1),
    hasta: finAnio > y ? iso(y, 12, 31) : iso(finAnio, finMes, ultimoDia(finAnio, finMes)),
  }
}

export function rangoPeriodo(periodo: PeriodoNotificacion, fecha: string, ciclo: FechasCiclo | null): RangoFechas {
  const y = Number(fecha.slice(0, 4))
  const m = Number(fecha.slice(5, 7))
  switch (periodo) {
    case 'mes':
      return { desde: iso(y, m, 1), hasta: iso(y, m, ultimoDia(y, m)) }
    case 'bimestre':
      return bloqueDeMeses(fecha, 2, mesInicio(ciclo))
    case 'trimestre':
      return bloqueDeMeses(fecha, 3, mesInicio(ciclo))
    case 'cuatrimestre':
      if (ciclo?.c1_desde && ciclo.c1_hasta && ciclo.c2_desde && ciclo.c2_hasta) {
        return fecha <= ciclo.c1_hasta
          ? { desde: ciclo.c1_desde, hasta: ciclo.c1_hasta }
          : { desde: ciclo.c2_desde, hasta: ciclo.c2_hasta }
      }
      return bloqueDeMeses(fecha, 4, mesInicio(ciclo))
    default:
      return RANGO_TODO
  }
}

export function notificacionesCruzadas(
  notificaciones: NotificacionInasistencia[],
  contar: (rango: RangoFechas) => { antes: number; despues: number },
  fecha: string,
  ciclo: FechasCiclo | null,
): NotificacionInasistencia[] {
  return notificaciones
    .filter((n) => {
      const { antes, despues } = contar(rangoPeriodo(n.periodo ?? 'ciclo', fecha, ciclo))
      return despues >= n.limite && antes < n.limite
    })
    .sort((a, b) => a.limite - b.limite)
}

export function etiquetaPeriodo(periodo: PeriodoNotificacion | undefined): string {
  return PERIODOS.find((p) => p.value === (periodo ?? 'ciclo'))?.enEl ?? 'el ciclo lectivo'
}
