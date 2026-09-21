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

/** Los días en los que puede haber clase; el número es la clave con la que se guarda cada día. */
export const DIAS_SEMANA = [
  { n: 1, label: 'Lunes' },
  { n: 2, label: 'Martes' },
  { n: 3, label: 'Miércoles' },
  { n: 4, label: 'Jueves' },
  { n: 5, label: 'Viernes' },
  { n: 6, label: 'Sábado' },
] as const

const DIAS_HABITUALES = [1, 2, 3, 4, 5]

export interface Modulo {
  /** Hora de inicio, "HH:MM". */
  inicio: string
  fin: string
}

/**
 * Los espacios para módulos de cada turno y cada día (la clave es el número de día, "1" a "6"). Son la capacidad del
 * turno: cuántos usa cada curso en cada día lo decide el horario. Los recreos son los huecos entre un módulo y otro.
 */
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

/** Un módulo tal como se edita: cuánto dura y cuánto recreo hay antes (en el primero no hay recreo). */
export interface ModuloEditable {
  recreoAntes: number
  duracion: number
}

/** Un día tal como se edita: a qué hora empieza y sus módulos en orden. */
export interface DiaEditable {
  inicio: string
  modulos: ModuloEditable[]
}

/** Las horas de cada módulo de un día, a partir de la hora de inicio y de cuánto dura cada módulo y cada recreo. */
export function modulosDesdeDia(dia: DiaEditable): Modulo[] {
  if (!FORMATO_HORA.test(dia.inicio)) return []
  const modulos: Modulo[] = []
  let desde = aMinutos(dia.inicio)
  dia.modulos.forEach((m, i) => {
    if (!(m.duracion > 0)) return
    if (i > 0) desde += Math.max(0, m.recreoAntes)
    modulos.push({ inicio: aHora(desde), fin: aHora(desde + m.duracion) })
    desde += m.duracion
  })
  return modulos
}

/** Vuelve a los parámetros de edición de un día ya armado; un día sin módulos usa la hora de inicio por defecto. */
export function diaDesdeModulos(modulos: Modulo[] | undefined, inicioPorDefecto: string): DiaEditable {
  if (!modulos || modulos.length === 0) return { inicio: inicioPorDefecto, modulos: [] }
  return {
    inicio: modulos[0].inicio,
    modulos: modulos.map((m, i) => ({
      duracion: aMinutos(m.fin) - aMinutos(m.inicio),
      recreoAntes: i === 0 ? 0 : Math.max(0, aMinutos(m.inicio) - aMinutos(modulos[i - 1].fin)),
    })),
  }
}

export const modulosDelDia = (grilla: GrillaModulos | null | undefined, turno: Turno, dia: number): Modulo[] =>
  grilla?.[turno]?.[String(dia)] ?? []

/** Cuántos módulos tiene un turno en toda la semana. */
export const modulosPorSemana = (grilla: GrillaModulos | null | undefined, turno: Turno): number =>
  DIAS_SEMANA.reduce((suma, d) => suma + modulosDelDia(grilla, turno, d.n).length, 0)

/**
 * Los días que tienen algún módulo en alguno de los turnos, para mostrar solo esas columnas (el sábado aparece solo si
 * hay clase). Sin ningún módulo cargado, de lunes a viernes.
 */
export function diasConClase(grilla: GrillaModulos | null | undefined, turnos: Turno[]): number[] {
  const dias = DIAS_SEMANA.filter((d) => turnos.some((t) => modulosDelDia(grilla, t, d.n).length > 0)).map((d) => d.n)
  return dias.length > 0 ? dias : DIAS_HABITUALES
}

/** Los turnos en los que cursa un curso; sin turno cargado, ninguno. */
export function turnosDelCurso(turno: string | null | undefined): Turno[] {
  if (turno === 'doble') return ['manana', 'tarde']
  return turno === 'manana' || turno === 'tarde' ? [turno] : []
}

/** Espacios para módulos que tiene un curso en la semana: los de su turno, o la suma de los dos si hace doble turno. */
export const modulosSemanalesDelCurso = (turno: string | null | undefined, grilla: GrillaModulos | null | undefined): number =>
  turnosDelCurso(turno).reduce((suma, t) => suma + modulosPorSemana(grilla, t), 0)

export type EstadoHoras = 'sin_datos' | 'entran' | 'no_entran'

/**
 * Compara las horas de las materias de un curso con los espacios que tiene en la semana. Que sobren espacios no es un
 * problema (los días pueden ser más cortos: el horario decide cuántos usa cada uno); que falten sí, porque las
 * materias no entran. `diferencia` es cuántos espacios quedan libres o cuántos faltan.
 */
export function controlHoras(espacios: number, horas: number): { estado: EstadoHoras; diferencia: number } {
  if (espacios <= 0) return { estado: 'sin_datos', diferencia: 0 }
  return horas <= espacios
    ? { estado: 'entran', diferencia: espacios - horas }
    : { estado: 'no_entran', diferencia: horas - espacios }
}
