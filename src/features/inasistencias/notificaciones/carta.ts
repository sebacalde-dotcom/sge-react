import type { FechasCiclo, PeriodoNotificacion } from './periodos'

export interface ResumenInasistencias {
  total: number
  justificadas: number
  injustificadas: number
}

export interface FaltaDetalle {
  fecha: string
  tipo: string
  valor: number
  justificada: boolean
}

export interface DatosCarta {
  curso: string
  anio: number | null
  periodo_texto: string
  periodo: ResumenInasistencias
  ciclo: ResumenInasistencias
  fechas: FaltaDetalle[]
}

export interface FilaInasistencia {
  fecha: string
  tipo: string
  valor: number
  justificada: boolean
}

export const DEFAULT_TEXTO_CARTA = `Por medio de la presente se notifica a los padres, madres o tutores de {alumno} (DNI {dni}), alumno/a de {curso}, que ha alcanzado las {limite} inasistencias durante {periodo}, registrando {cantidad} en total.

Se solicita tomar conocimiento de la situación y comunicarse con la institución ante cualquier consulta. Recordamos que la asistencia regular es fundamental para el proceso de aprendizaje.`

export const VARIABLES_CARTA: { nombre: string; descripcion: string }[] = [
  { nombre: '{alumno}', descripcion: 'Nombre y apellido del alumno' },
  { nombre: '{dni}', descripcion: 'DNI del alumno' },
  { nombre: '{curso}', descripcion: 'Curso del alumno' },
  { nombre: '{limite}', descripcion: 'Cantidad de inasistencias de la regla' },
  { nombre: '{cantidad}', descripcion: 'Inasistencias que tiene en el período' },
  { nombre: '{periodo}', descripcion: 'Período de la regla (ej: el mes de septiembre de 2026)' },
  { nombre: '{fecha}', descripcion: 'Fecha de emisión' },
]

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function formatFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
}

export function descripcionPeriodo(
  periodo: PeriodoNotificacion,
  desde: string,
  hasta: string,
  ciclo: FechasCiclo | null,
): string {
  const y = Number(desde.slice(0, 4))
  const m1 = Number(desde.slice(5, 7))
  const m2 = Number(hasta.slice(5, 7))
  switch (periodo) {
    case 'mes':
      return `el mes de ${MESES[m1 - 1]} de ${y}`
    case 'bimestre':
    case 'trimestre': {
      const nombre = periodo === 'bimestre' ? 'bimestre' : 'trimestre'
      return m1 === m2
        ? `el ${nombre} de ${MESES[m1 - 1]} de ${y}`
        : `el ${nombre} de ${MESES[m1 - 1]} a ${MESES[m2 - 1]} de ${y}`
    }
    case 'cuatrimestre': {
      const rango = `(${formatFecha(desde)} al ${formatFecha(hasta)})`
      if (ciclo?.c1_desde === desde) return `el 1° cuatrimestre ${rango}`
      if (ciclo?.c2_desde === desde) return `el 2° cuatrimestre ${rango}`
      return `el cuatrimestre ${rango}`
    }
    default:
      return `el ciclo lectivo ${ciclo?.anio ?? y}`
  }
}

export function resumir(filas: FilaInasistencia[]): ResumenInasistencias {
  const r = { total: 0, justificadas: 0, injustificadas: 0 }
  for (const f of filas) {
    const v = Number(f.valor)
    r.total += v
    if (f.justificada) r.justificadas += v
    else r.injustificadas += v
  }
  return r
}

export function renderTexto(plantilla: string, variables: Record<string, string>): string {
  return plantilla.replace(/\{(\w+)\}/g, (coincidencia, clave: string) => variables[clave] ?? coincidencia)
}
