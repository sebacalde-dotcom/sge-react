import { instanciaPeriodo, type FechasCiclo, type PeriodoNotificacion, type RangoFechas } from './notificaciones/periodos'
import { faltasQueCuentan, superaLimite, type Comparacion, type CuentaFaltas } from './conteo'

export interface ReglaRegularidad {
  limite: number
  periodo: PeriodoNotificacion
  /** Qué inasistencias suman. Sin dato (reglas anteriores), todas. */
  cuenta?: CuentaFaltas
  /** Si el límite se cumple al alcanzarlo o al superarlo. Sin dato (reglas anteriores), al alcanzarlo. */
  comparacion?: Comparacion
}

export interface FaltaSimple {
  fecha: string
  valor: number
  justificada?: boolean
}

/** `reglas` son las que se estaban infringiendo al reincorporar; `null` (registros anteriores) reinicia todas. */
export interface ReincorporacionRegla {
  fecha: string
  reglas: ReglaRegularidad[] | null
}

export interface Infraccion {
  regla: ReglaRegularidad
  desde: string
  hasta: string
  total: number
  fecha: string
  conteoDesde: string | null
}

export interface ProgresoRegla {
  regla: ReglaRegularidad
  total: number
  conteoDesde: string | null
}

export interface EstadoRegularidad {
  noRegular: boolean
  noRegularDesde: string | null
  infracciones: Infraccion[]
  progreso: ProgresoRegla[]
}

const suma = (faltas: FaltaSimple[]) => faltas.reduce((s, f) => s + Number(f.valor), 0)

export const mismaRegla = (a: ReglaRegularidad, b: ReglaRegularidad) => a.limite === b.limite && a.periodo === b.periodo

/** Fecha desde la que cuenta una regla: la última reincorporación que la reinició. */
export function conteoDesdeDeRegla(regla: ReglaRegularidad, reincorporaciones: ReincorporacionRegla[]): string | null {
  let desde: string | null = null
  for (const r of reincorporaciones) {
    const aplica = r.reglas === null || r.reglas.some((x) => mismaRegla(x, regla))
    if (aplica && (!desde || r.fecha > desde)) desde = r.fecha
  }
  return desde
}

/**
 * Un alumno es No Regular si en algún período de alguna regla juntó `limite` inasistencias (al alcanzarlo o al
 * superarlo, según la regla; contando todas o solo las injustificadas).
 * Cada regla cuenta solo las posteriores a la última reincorporación que la reinició: las anteriores se
 * conservan pero ya no cuentan para esa regla, y las demás reglas siguen contando lo que venían contando.
 * Sigue No Regular hasta que una reincorporación reinicie la regla que se infringió.
 */
export function evaluarRegularidad(
  faltas: FaltaSimple[],
  reglas: ReglaRegularidad[],
  ciclo: FechasCiclo | null,
  reincorporaciones: ReincorporacionRegla[],
  fechaReferencia: string,
): EstadoRegularidad {
  const ordenadas = [...faltas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const infracciones: Infraccion[] = []
  const progreso: ProgresoRegla[] = []

  for (const regla of reglas) {
    const conteoDesde = conteoDesdeDeRegla(regla, reincorporaciones)
    const desdeReinicio = conteoDesde ? ordenadas.filter((f) => f.fecha >= conteoDesde) : ordenadas
    const validas = faltasQueCuentan(desdeReinicio, regla.cuenta)

    const grupos = new Map<string, { rango: RangoFechas; filas: FaltaSimple[] }>()
    for (const f of validas) {
      const inst = instanciaPeriodo(regla.periodo, f.fecha, ciclo)
      const g = grupos.get(inst.clave)
      if (g) g.filas.push(f)
      else grupos.set(inst.clave, { rango: { desde: inst.desde, hasta: inst.hasta }, filas: [f] })
    }

    for (const g of grupos.values()) {
      let acumulado = 0
      for (const f of g.filas) {
        acumulado += Number(f.valor)
        if (superaLimite(acumulado, regla.limite, regla.comparacion)) {
          infracciones.push({
            regla,
            desde: g.rango.desde,
            hasta: g.rango.hasta,
            total: suma(g.filas),
            fecha: f.fecha,
            conteoDesde,
          })
          break
        }
      }
    }

    // Se agrupa igual que las infracciones (por período), para que una falta fuera de todos los períodos, como un
    // día de clase extra durante el receso, cuente en el mismo período en los dos lados.
    const actual = instanciaPeriodo(regla.periodo, fechaReferencia, ciclo)
    progreso.push({
      regla,
      total: suma(validas.filter((f) => instanciaPeriodo(regla.periodo, f.fecha, ciclo).clave === actual.clave)),
      conteoDesde,
    })
  }

  infracciones.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return {
    noRegular: infracciones.length > 0,
    noRegularDesde: infracciones[0]?.fecha ?? null,
    infracciones,
    progreso,
  }
}
