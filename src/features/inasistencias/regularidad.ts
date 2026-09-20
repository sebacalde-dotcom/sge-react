import { instanciaPeriodo, type FechasCiclo, type PeriodoNotificacion, type RangoFechas } from './notificaciones/periodos'

export interface ReglaRegularidad {
  limite: number
  periodo: PeriodoNotificacion
}

export interface FaltaSimple {
  fecha: string
  valor: number
}

export interface Infraccion {
  regla: ReglaRegularidad
  desde: string
  hasta: string
  total: number
  fecha: string
}

export interface ProgresoRegla {
  regla: ReglaRegularidad
  total: number
}

export interface EstadoRegularidad {
  noRegular: boolean
  noRegularDesde: string | null
  infracciones: Infraccion[]
  progreso: ProgresoRegla[]
}

const suma = (faltas: FaltaSimple[]) => faltas.reduce((s, f) => s + Number(f.valor), 0)

/**
 * Un alumno es No Regular si en algún período de alguna regla juntó al menos `limite` inasistencias,
 * contando solo las posteriores a la última reincorporación (`desde`). Las anteriores se conservan
 * pero ya no cuentan. Sigue No Regular hasta que una nueva reincorporación mueva `desde`.
 */
export function evaluarRegularidad(
  faltas: FaltaSimple[],
  reglas: ReglaRegularidad[],
  ciclo: FechasCiclo | null,
  desde: string | null,
  fechaReferencia: string,
): EstadoRegularidad {
  const validas = (desde ? faltas.filter((f) => f.fecha >= desde) : [...faltas]).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const infracciones: Infraccion[] = []
  const progreso: ProgresoRegla[] = []

  for (const regla of reglas) {
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
        if (acumulado >= regla.limite) {
          infracciones.push({ regla, desde: g.rango.desde, hasta: g.rango.hasta, total: suma(g.filas), fecha: f.fecha })
          break
        }
      }
    }

    const actual = instanciaPeriodo(regla.periodo, fechaReferencia, ciclo)
    progreso.push({
      regla,
      total: suma(validas.filter((f) => f.fecha >= actual.desde && f.fecha <= actual.hasta)),
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
