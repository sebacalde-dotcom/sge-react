import { DIAS_SEMANA, modulosDelDia, turnosDelCurso, type GrillaModulos, type Turno } from './grilla'

/** Un módulo de un curso en el que se dicta una materia. */
export interface Colocacion {
  curso_id: string
  materia_id: string
  dia: number
  turno: Turno
  modulo: number
}

/** Una colocación con el docente de su materia, para poder detectar superposiciones entre cursos. */
export interface ColocacionConDocente extends Colocacion {
  personal_id: string | null
}

export interface MateriaParaHorario {
  id: string
  curso_id: string
  nombre: string
  horas_semanales: number | null
  personal_id: string | null
}

/** Identifica un módulo dentro de un curso: turno, día (1 a 5) y número de módulo (desde 1). */
export const claveCelda = (turno: Turno, dia: number, modulo: number): string => `${turno}:${dia}:${modulo}`

export function desdeClave(clave: string): { turno: Turno; dia: number; modulo: number } {
  const [turno, dia, modulo] = clave.split(':')
  return { turno: turno as Turno, dia: Number(dia), modulo: Number(modulo) }
}

export const nombreDia = (dia: number): string => DIAS_SEMANA.find((d) => d.n === dia)?.label ?? `día ${dia}`

export interface CeldaDelCurso {
  turno: Turno
  dia: number
  modulo: number
  inicio: string
  fin: string
}

/** Todos los módulos en los que un curso tiene clase: los de su turno (o los dos) en cada día. */
export function celdasDelCurso(turnoCurso: string | null | undefined, grilla: GrillaModulos | null | undefined): CeldaDelCurso[] {
  const celdas: CeldaDelCurso[] = []
  for (const turno of turnosDelCurso(turnoCurso)) {
    for (const d of DIAS_SEMANA) {
      modulosDelDia(grilla, turno, d.n).forEach((m, i) => celdas.push({ turno, dia: d.n, modulo: i + 1, inicio: m.inicio, fin: m.fin }))
    }
  }
  return celdas
}

export type TipoProblema =
  | 'superposicion'
  | 'horas_de_mas'
  | 'sin_docente'
  | 'hueco'
  | 'fuera_de_grilla'
  | 'horas_de_menos'
  | 'sin_horas_cargadas'

/** Los errores y avisos se muestran; lo pendiente es lo que falta completar y se resume. */
export type Gravedad = 'error' | 'aviso' | 'pendiente'

export interface Problema {
  tipo: TipoProblema
  gravedad: Gravedad
  mensaje: string
  /** Los módulos (claves) donde se ve el problema. */
  celdas: string[]
}

export type EstadoMateria = 'completa' | 'faltan' | 'sobran' | 'sin_horas'

export interface ResumenMateria {
  materia_id: string
  colocadas: number
  requeridas: number | null
  estado: EstadoMateria
}

export interface EntradaValidacion {
  turnoCurso: string | null | undefined
  grilla: GrillaModulos | null | undefined
  /** Lo que hay cargado en el curso: módulo (clave) → materia. Puede tener módulos que ya no existen en la grilla. */
  borrador: Record<string, string>
  materias: MateriaParaHorario[]
  /** El horario ya guardado de los demás cursos. */
  otras: (ColocacionConDocente & { curso_nombre: string })[]
  nombreDocente: (personalId: string) => string
}

export interface ResultadoValidacion {
  problemas: Problema[]
  /** Por módulo (clave), los problemas que lo afectan. */
  porCelda: Record<string, Problema[]>
  materias: ResumenMateria[]
  /** Módulos del curso que todavía no tienen materia. */
  sinCompletar: number
}

/**
 * Controla el horario de un curso mientras se arma: un docente no puede estar en dos cursos a la misma hora, una
 * materia no puede pasar de sus horas semanales, y el curso no debe tener horas libres entre clases. Lo que todavía
 * falta completar se cuenta aparte, porque mientras se carga siempre falta algo.
 */
export function validarHorarioCurso(entrada: EntradaValidacion): ResultadoValidacion {
  const { turnoCurso, grilla, borrador, materias, otras, nombreDocente } = entrada
  const celdas = celdasDelCurso(turnoCurso, grilla)
  const existentes = new Set(celdas.map((c) => claveCelda(c.turno, c.dia, c.modulo)))
  const materiaPorId = new Map(materias.map((m) => [m.id, m]))
  const problemas: Problema[] = []

  // Módulos cargados que ya no están en la grilla (por ejemplo, si se sacó un módulo de ese día)
  const fuera = Object.keys(borrador).filter((c) => !existentes.has(c))
  if (fuera.length > 0) {
    problemas.push({
      tipo: 'fuera_de_grilla',
      gravedad: 'aviso',
      mensaje: `${fuera.length} ${fuera.length === 1 ? 'módulo cargado ya no existe' : 'módulos cargados ya no existen'} en la grilla y se van a quitar al guardar`,
      celdas: [],
    })
  }

  const cargadas = Object.entries(borrador).filter(([clave, materiaId]) => existentes.has(clave) && materiaPorId.has(materiaId))
  const clavesPorMateria = new Map<string, string[]>()
  for (const [clave, materiaId] of cargadas) clavesPorMateria.set(materiaId, [...(clavesPorMateria.get(materiaId) ?? []), clave])

  // Un docente en dos cursos a la misma hora
  const otrasPorDocente = new Map<string, (typeof otras)[number][]>()
  for (const o of otras) {
    if (!o.personal_id) continue
    const clave = `${o.personal_id}|${claveCelda(o.turno, o.dia, o.modulo)}`
    otrasPorDocente.set(clave, [...(otrasPorDocente.get(clave) ?? []), o])
  }
  for (const [clave, materiaId] of cargadas) {
    const personalId = materiaPorId.get(materiaId)!.personal_id
    if (!personalId) continue
    const choques = otrasPorDocente.get(`${personalId}|${clave}`)
    if (!choques) continue
    const { dia, modulo } = desdeClave(clave)
    problemas.push({
      tipo: 'superposicion',
      gravedad: 'error',
      mensaje: `${nombreDocente(personalId)} también da clase en ${choques.map((c) => c.curso_nombre).join(' y ')} el ${nombreDia(dia)}, módulo ${modulo}`,
      celdas: [clave],
    })
  }

  // Materias con docente sin asignar: no se pueden controlar sus superposiciones
  for (const [materiaId, claves] of clavesPorMateria) {
    const materia = materiaPorId.get(materiaId)!
    if (!materia.personal_id) {
      problemas.push({
        tipo: 'sin_docente',
        gravedad: 'aviso',
        mensaje: `${materia.nombre} no tiene docente asignado: no se pueden controlar sus superposiciones`,
        celdas: claves,
      })
    }
  }

  // Horas de cada materia
  const resumenes: ResumenMateria[] = materias.map((m) => {
    const colocadas = clavesPorMateria.get(m.id)?.length ?? 0
    const requeridas = m.horas_semanales
    const estado: EstadoMateria = requeridas == null ? 'sin_horas' : colocadas === requeridas ? 'completa' : colocadas < requeridas ? 'faltan' : 'sobran'
    return { materia_id: m.id, colocadas, requeridas, estado }
  })
  for (const r of resumenes) {
    const materia = materiaPorId.get(r.materia_id)!
    if (r.estado === 'sobran') {
      problemas.push({
        tipo: 'horas_de_mas',
        gravedad: 'error',
        mensaje: `${materia.nombre} tiene ${r.colocadas} módulos y solo ${r.requeridas} de horas semanales`,
        celdas: clavesPorMateria.get(r.materia_id) ?? [],
      })
    } else if (r.estado === 'faltan') {
      problemas.push({
        tipo: 'horas_de_menos',
        gravedad: 'pendiente',
        mensaje: `Faltan ${r.requeridas! - r.colocadas} módulos de ${materia.nombre}`,
        celdas: [],
      })
    } else if (r.estado === 'sin_horas' && r.colocadas > 0) {
      problemas.push({
        tipo: 'sin_horas_cargadas',
        gravedad: 'pendiente',
        mensaje: `${materia.nombre} no tiene horas semanales cargadas: no se puede controlar cuántos módulos le tocan`,
        celdas: [],
      })
    }
  }

  // Huecos: un módulo libre con clases después, el mismo día
  const llenas = new Set(cargadas.map(([clave]) => clave))
  for (const turno of turnosDelCurso(turnoCurso)) {
    for (const d of DIAS_SEMANA) {
      const total = modulosDelDia(grilla, turno, d.n).length
      let ultimaLlena = 0
      for (let m = 1; m <= total; m++) if (llenas.has(claveCelda(turno, d.n, m))) ultimaLlena = m
      const vacias: string[] = []
      for (let m = 1; m < ultimaLlena; m++) if (!llenas.has(claveCelda(turno, d.n, m))) vacias.push(claveCelda(turno, d.n, m))
      if (vacias.length > 0) {
        problemas.push({
          tipo: 'hueco',
          gravedad: 'aviso',
          mensaje: `El ${nombreDia(d.n)} (${turno === 'manana' ? 'mañana' : 'tarde'}) tiene ${vacias.length === 1 ? 'un módulo libre' : `${vacias.length} módulos libres`} entre clases`,
          celdas: vacias,
        })
      }
    }
  }

  const porCelda: Record<string, Problema[]> = {}
  for (const p of problemas) for (const c of p.celdas) porCelda[c] = [...(porCelda[c] ?? []), p]

  return { problemas, porCelda, materias: resumenes, sinCompletar: celdas.length - llenas.size }
}

export interface SuperposicionDocente {
  personal_id: string
  turno: Turno
  dia: number
  modulo: number
  colocaciones: ColocacionConDocente[]
}

/** Los docentes que están en más de un curso en el mismo módulo, en todo el horario de la escuela. */
export function superposicionesDeDocentes(colocaciones: ColocacionConDocente[]): SuperposicionDocente[] {
  const grupos = new Map<string, ColocacionConDocente[]>()
  for (const c of colocaciones) {
    if (!c.personal_id) continue
    const clave = `${c.personal_id}|${claveCelda(c.turno, c.dia, c.modulo)}`
    grupos.set(clave, [...(grupos.get(clave) ?? []), c])
  }
  return [...grupos.values()]
    .filter((g) => new Set(g.map((c) => c.curso_id)).size > 1)
    .map((g) => ({ personal_id: g[0].personal_id!, turno: g[0].turno, dia: g[0].dia, modulo: g[0].modulo, colocaciones: g }))
}
