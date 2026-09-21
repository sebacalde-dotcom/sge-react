import { claveCelda, nombreDia } from './horario'
import type { Turno } from './grilla'

/** Un grupo de un agrupamiento: por ejemplo el nivel A1 de Inglés, o Música dentro de Arte. */
export interface Grupo {
  id: string
  nombre: string
  personal_id: string | null
}

/**
 * Las materias que se dictan a la vez y se dividen en grupos. Puede juntar materias de cursos distintos (Inglés de 1°,
 * 2° y 3° dividido por niveles) o ser una sola materia de un curso (Arte dividido en Música y Dibujo). Los grupos de un
 * agrupamiento se dictan a la vez, cada uno con su docente.
 */
export interface Agrupamiento {
  id: string
  nombre: string
  /** Las materias (una por curso) que lo forman. */
  materias: string[]
  grupos: Grupo[]
}

/** El período en que un alumno está en un grupo. `hasta` vacío = sigue en él. Fechas "AAAA-MM-DD". */
export interface Membresia {
  grupo_id: string
  persona_id: string
  desde: string
  hasta: string | null
}

export const indicePorMateria = (agrupamientos: Agrupamiento[]): Map<string, Agrupamiento> => {
  const mapa = new Map<string, Agrupamiento>()
  for (const a of agrupamientos) for (const m of a.materias) mapa.set(m, a)
  return mapa
}

/** Los docentes de los grupos, sin repetir. Se dictan a la vez, así que están ocupados todos juntos. */
export const docentesDelAgrupamiento = (a: Agrupamiento): string[] => [...new Set(a.grupos.map((g) => g.personal_id).filter((d): d is string => !!d))]

/** Quién dicta una materia: los docentes de sus grupos si está en un agrupamiento, o su docente. */
export function docentesDeMateria(materia: { id: string; personal_id: string | null }, porMateria: Map<string, Agrupamiento>): string[] {
  const agrupamiento = porMateria.get(materia.id)
  if (agrupamiento) return docentesDelAgrupamiento(agrupamiento)
  return materia.personal_id ? [materia.personal_id] : []
}

/**
 * Qué se dicta a la vez: las materias de un mismo agrupamiento comparten la clase (un docente puede estar en las clases
 * de un agrupamiento en varios cursos sin que sea una superposición), y las demás son de un curso.
 */
export const unidadDeMateria = (materia: { id: string; curso_id: string }, porMateria: Map<string, Agrupamiento>): string => {
  const agrupamiento = porMateria.get(materia.id)
  return agrupamiento ? `ag:${agrupamiento.id}` : `curso:${materia.curso_id}`
}

export interface MateriaDeAgrupamiento {
  id: string
  curso_id: string
  nombre: string
  horas_semanales: number | null
  /** El turno en que se dicta, ya resuelto (el de la materia o el del curso); null si no se puede saber. */
  turno: Turno | null
}

export interface ProblemaAgrupamiento {
  gravedad: 'error' | 'aviso'
  mensaje: string
}

/** Controla que un agrupamiento se pueda dictar a la vez: mismas horas, mismo turno, un docente por grupo. */
export function validarAgrupamiento(
  agrupamiento: Agrupamiento,
  materias: MateriaDeAgrupamiento[],
  nombreCurso: (cursoId: string) => string,
  nombreDocente: (personalId: string) => string,
): ProblemaAgrupamiento[] {
  const problemas: ProblemaAgrupamiento[] = []
  const suyas = materias.filter((m) => agrupamiento.materias.includes(m.id))

  if (suyas.length === 0) problemas.push({ gravedad: 'aviso', mensaje: 'Todavía no tiene materias.' })

  const porCurso = new Map<string, number>()
  for (const m of suyas) porCurso.set(m.curso_id, (porCurso.get(m.curso_id) ?? 0) + 1)
  for (const [cursoId, n] of porCurso) {
    if (n > 1) problemas.push({ gravedad: 'error', mensaje: `${nombreCurso(cursoId)} tiene ${n} materias en este agrupamiento: tiene que ser una por curso.` })
  }

  if (suyas.length > 1) {
    const horas = new Set(suyas.map((m) => m.horas_semanales))
    if (horas.size > 1) {
      const detalle = suyas.map((m) => `${nombreCurso(m.curso_id)}: ${m.horas_semanales ?? 'sin horas'}`).join(', ')
      problemas.push({ gravedad: 'error', mensaje: `Las materias se dictan a la vez y tienen que tener las mismas horas semanales (${detalle}).` })
    }
    const turnos = new Set(suyas.map((m) => m.turno))
    if (turnos.size > 1) problemas.push({ gravedad: 'error', mensaje: 'Las materias se dictan en turnos distintos: tienen que ser del mismo turno para dictarse a la vez.' })
  }

  if (agrupamiento.grupos.length === 0) problemas.push({ gravedad: 'aviso', mensaje: 'Todavía no tiene grupos.' })
  for (const g of agrupamiento.grupos) {
    if (!g.personal_id) problemas.push({ gravedad: 'aviso', mensaje: `El grupo ${g.nombre} no tiene docente: no se pueden controlar sus superposiciones.` })
  }
  const gruposPorDocente = new Map<string, string[]>()
  for (const g of agrupamiento.grupos) {
    if (g.personal_id) gruposPorDocente.set(g.personal_id, [...(gruposPorDocente.get(g.personal_id) ?? []), g.nombre])
  }
  for (const [docente, grupos] of gruposPorDocente) {
    if (grupos.length > 1) {
      problemas.push({ gravedad: 'error', mensaje: `${nombreDocente(docente)} está en los grupos ${grupos.join(' y ')}, que se dictan a la vez.` })
    }
  }
  return problemas
}

/** ¿El alumno está en el grupo en esa fecha? */
export const vigenteEn = (m: Pick<Membresia, 'desde' | 'hasta'>, fecha: string): boolean => m.desde <= fecha && (m.hasta === null || m.hasta >= fecha)

/** El grupo en el que está un alumno en una fecha, o null. */
export function grupoDelAlumno(membresias: Membresia[], personaId: string, fecha: string): string | null {
  return membresias.find((m) => m.persona_id === personaId && vigenteEn(m, fecha))?.grupo_id ?? null
}

export interface ColocacionDeMateria {
  materia_id: string
  turno: Turno
  dia: number
  modulo: number
}

/**
 * Las materias de un agrupamiento se dictan a la vez: tienen que estar en los mismos módulos en todos los cursos. Devuelve
 * un mensaje por agrupamiento que no coincide.
 */
export function agrupamientosSinCoincidir(
  agrupamientos: Agrupamiento[],
  colocaciones: ColocacionDeMateria[],
  etiquetaMateria: (materiaId: string) => string,
): { agrupamiento_id: string; materias: string[]; mensaje: string }[] {
  const resultado: { agrupamiento_id: string; materias: string[]; mensaje: string }[] = []
  for (const a of agrupamientos) {
    if (a.materias.length < 2) continue
    const lugares = new Map<string, Set<string>>() // módulo → materias que lo tienen
    const cargadas = new Set<string>()
    for (const c of colocaciones) {
      if (!a.materias.includes(c.materia_id)) continue
      cargadas.add(c.materia_id)
      const clave = claveCelda(c.turno, c.dia, c.modulo)
      lugares.set(clave, (lugares.get(clave) ?? new Set()).add(c.materia_id))
    }
    // Si todavía no se cargó nada en ninguna, no hay nada que comparar
    if (cargadas.size === 0) continue
    const diferencias: string[] = []
    const faltantes = new Set<string>()
    for (const [clave, materias] of [...lugares].sort()) {
      if (materias.size === a.materias.length) continue
      const [, dia, modulo] = clave.split(':')
      const sin = a.materias.filter((m) => !materias.has(m)).map(etiquetaMateria)
      sin.forEach((s) => faltantes.add(s))
      diferencias.push(`el ${nombreDia(Number(dia)).toLowerCase()}, módulo ${modulo}, falta en ${sin.join(' y ')}`)
    }
    // Un curso sin ningún módulo también es una diferencia
    for (const m of a.materias) if (!cargadas.has(m) && cargadas.size > 0) faltantes.add(etiquetaMateria(m))
    if (diferencias.length === 0 && faltantes.size === 0) continue
    const resumen = diferencias.length > 0 ? `${diferencias.slice(0, 3).join('; ')}${diferencias.length > 3 ? `; y ${diferencias.length - 3} más` : ''}` : `falta cargarla en ${[...faltantes].join(' y ')}`
    resultado.push({
      agrupamiento_id: a.id,
      materias: a.materias,
      mensaje: `${a.nombre} se dicta a la vez en todos los cursos y no coincide: ${resumen}.`,
    })
  }
  return resultado
}
