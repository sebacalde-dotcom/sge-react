import type { Comparacion, CuentaFaltas } from './conteo'
import { cantidadRegla } from './notificaciones/carta'
import { etiquetaPeriodo, type PeriodoNotificacion } from './notificaciones/periodos'

interface ReglaDescribible {
  limite: number
  periodo: PeriodoNotificacion
  cuenta?: CuentaFaltas
  comparacion?: Comparacion
}

/** La regla en una frase: "10 inasistencias en el bimestre", "más de 5 inasistencias injustificadas en el bimestre". */
export function descripcionRegla(r: ReglaDescribible): string {
  return `${cantidadRegla(r.limite, r.comparacion, r.cuenta)} en ${etiquetaPeriodo(r.periodo)}`
}
