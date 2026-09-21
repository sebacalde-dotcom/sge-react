export type Turno = 'manana' | 'tarde'
/** Un curso cursa en un turno o en los dos (doble turno). */
export type TurnoCurso = Turno | 'doble'

export const TURNOS: { value: Turno; label: string }[] = [
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
]

export const TURNOS_CURSO: { value: TurnoCurso; label: string }[] = [
  { value: 'manana', label: 'Mañana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'doble', label: 'Doble turno (mañana y tarde)' },
]

/** Los días de clase de la semana; el número es la clave con la que se guarda cada día. */
export const DIAS_SEMANA = [
  { n: 1, label: 'Lunes' },
  { n: 2, label: 'Martes' },
  { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' },
  { n: 5, label: 'Viernes' },
] as const

export interface Modulo {
  /** Hora de inicio, "HH:MM". */
  inicio: string
  fin: string
}

/** Los módulos de cada turno y cada día (la clave es el número de día, "1" a "5"). Varían de un día a otro. */
export type GrillaModulos = Partial<Record<Turno, Partial<Record<string, Modulo[]>>>>

const FORMATO_HORA = /^\d{1,2}:\d{2}$/

const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

const aHora = (minutos: number): string => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

/** Módulos consecutivos a partir de una hora, con un descanso opcional entre uno y otro (los recreos). */
export function generarModulos(inicio: string, cantidad: number, duracion = 60, descanso = 0): Modulo[] {
  if (!FORMATO_HORA.test(inicio) || !(cantidad > 0) || !(duracion > 0)) return []
  const modulos: Modulo[] = []
  let desde = aMinutos(inicio)
  for (let i = 0; i < Math.floor(cantidad); i++) {
    modulos.push({ inicio: aHora(desde), fin: aHora(desde + duracion) })
    desde += duracion + Math.max(0, descanso)
  }
  return modulos
}

/** Los parámetros con los que se armó un día, para volver a mostrarlos y editarlos. */
export interface ParametrosDia {
  cantidad: number
  inicio: string
  duracion: number
  descanso: number
}

export function parametrosDeModulos(modulos: Modulo[] | undefined, inicioPorDefecto: string): ParametrosDia {
  if (!modulos || modulos.length === 0) return { cantidad: 0, inicio: inicioPorDefecto, duracion: 60, descanso: 0 }
  const [primero, segundo] = modulos
  return {
    cantidad: modulos.length,
    inicio: primero.inicio,
    duracion: aMinutos(primero.fin) - aMinutos(primero.inicio),
    descanso: segundo ? aMinutos(segundo.inicio) - aMinutos(primero.fin) : 0,
  }
}

export const modulosDelDia = (grilla: GrillaModulos | null | undefined, turno: Turno, dia: number): Modulo[] =>
  grilla?.[turno]?.[String(dia)] ?? []

/** Cuántos módulos tiene un turno en toda la semana. */
export const modulosPorSemana = (grilla: GrillaModulos | null | undefined, turno: Turno): number =>
  DIAS_SEMANA.reduce((suma, d) => suma + modulosDelDia(grilla, turno, d.n).length, 0)

/** Los turnos en los que cursa un curso; sin turno cargado, ninguno. */
export function turnosDelCurso(turno: string | null | undefined): Turno[] {
  if (turno === 'doble') return ['manana', 'tarde']
  return turno === 'manana' || turno === 'tarde' ? [turno] : []
}

/** Módulos que tiene un curso en la semana: los de su turno, o la suma de los dos si hace doble turno. */
export const modulosSemanalesDelCurso = (turno: string | null | undefined, grilla: GrillaModulos | null | undefined): number =>
  turnosDelCurso(turno).reduce((suma, t) => suma + modulosPorSemana(grilla, t), 0)

export type EstadoHoras = 'sin_datos' | 'coincide' | 'faltan' | 'sobran'

/**
 * Compara los módulos del curso en la semana con las horas de sus materias. Como un curso no puede tener huecos, tienen
 * que coincidir: "faltan" es que quedan módulos sin materia y "sobran", que las materias suman más de lo que hay.
 */
export function controlHoras(modulos: number, horas: number): { estado: EstadoHoras; diferencia: number } {
  if (modulos <= 0) return { estado: 'sin_datos', diferencia: 0 }
  const diferencia = modulos - horas
  if (diferencia === 0) return { estado: 'coincide', diferencia: 0 }
  return { estado: diferencia > 0 ? 'faltan' : 'sobran', diferencia: Math.abs(diferencia) }
}
