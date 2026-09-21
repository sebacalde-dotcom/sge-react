import { puedeDarClase, type Franja } from './disponibilidad'
import { DIAS_SEMANA, modulosDelDia, turnosDelCurso, type GrillaModulos, type Turno } from './grilla'
import { nombreDia } from './horario'

/** Las reglas que fija quien arma el horario. Lo que no se indica no se limita. */
export interface ReglasHorario {
  /** Módulos mínimos que tiene un curso en un día de ese turno (solo se exige en los días que tienen lugar para tantos). */
  minModulosPorDia?: Partial<Record<Turno, number>>
  /** Módulos máximos de un curso en un día de ese turno. Sin dato, todos los espacios del día. */
  maxModulosPorDia?: Partial<Record<Turno, number>>
  /** Módulos de una misma materia en un mismo día de un curso. Por defecto 2. */
  maxModulosMateriaPorDia?: number
  /** Evitar que un docente quede con módulos libres entre sus clases de un mismo día. Por defecto sí. */
  docentesSinHuecos?: boolean
}

export const MAX_MATERIA_POR_DIA_DEFECTO = 2

export interface MateriaGenerador {
  id: string
  curso_id: string
  nombre: string
  horas_semanales: number | null
  /** Su docente. Si la materia está en un agrupamiento, la dictan los docentes de los grupos y este dato no se usa. */
  personal_id: string | null
  /** En qué turno se dicta. Sin dato, el del curso; en un curso de doble turno hay que indicarlo. */
  turno: Turno | null
  /** Se dicta en bloques de dos módulos seguidos. */
  bloque_doble: boolean
}

/**
 * Materias que se dictan a la vez y se dividen en grupos (Inglés por niveles en varios cursos, o Arte dividido en Música
 * y Dibujo en uno solo). Van en los mismos módulos en todos sus cursos y ocupan a los docentes de todos los grupos.
 */
export interface AgrupamientoGenerador {
  id: string
  nombre: string
  /** Las materias (una por curso) que lo forman. */
  materias: string[]
  /** Los docentes de los grupos: todos están ocupados cuando se dicta. */
  docentes: string[]
}

export interface CursoGenerador {
  id: string
  nombre: string
  turno: string | null
}

export interface CeldaExistente {
  curso_id: string
  materia_id: string
  dia: number
  turno: Turno
  modulo: number
  fijo: boolean
}

export interface EntradaGenerador {
  grilla: GrillaModulos | null | undefined
  cursos: CursoGenerador[]
  materias: MateriaGenerador[]
  agrupamientos?: AgrupamientoGenerador[]
  disponibilidad: (personalId: string) => Franja[]
  nombreDocente: (personalId: string) => string
  reglas: ReglasHorario
  /** El horario que ya está guardado, de todos los cursos. */
  existente: CeldaExistente[]
  /** Los cursos cuyo horario se arma; se suman los que comparten un agrupamiento con ellos. El de los demás se respeta tal como está. */
  cursosAArmar: string[]
  /** "completar" respeta todo lo cargado; "rearmar" respeta solo lo fijo. */
  modo: 'completar' | 'rearmar'
}

export interface AsignacionGenerada {
  curso_id: string
  materia_id: string
  dia: number
  turno: Turno
  modulo: number
  fijo: boolean
}

export interface ProblemaGenerador {
  gravedad: 'error' | 'aviso'
  mensaje: string
}

export interface ResultadoGenerador {
  /** No quedó ninguna superposición ni horario fuera de disponibilidad, y los datos permitían armarlo. */
  exito: boolean
  /** El horario completo de los cursos armados (lo fijado más lo generado). Vacío si no se pudo intentar. */
  asignaciones: AsignacionGenerada[]
  cursosArmados: string[]
  problemas: ProblemaGenerador[]
  iteraciones: number
}

export interface OpcionesGenerador {
  semilla?: number
  maxIteraciones?: number
}

// Cuánto pesa cada incumplimiento: lo duro no puede quedar, lo medio es una regla del director, lo suave es preferencia.
const PESO_DURO = 100
const PESO_MEDIO = 20
const PESO_SUAVE = 2
const PESO_TENUE = 0.5

// Si al terminar la búsqueda queda algún incumplimiento, se retoma desde el mejor horario con algo de temperatura
const MAX_RECALENTAMIENTOS = 3
const AVANCE_AL_RECALENTAR = 0.3

const TURNOS: Turno[] = ['manana', 'tarde']
const TURNO_INDICE: Record<Turno, number> = { manana: 0, tarde: 1 }
const NOMBRE_TURNO: Record<Turno, string> = { manana: 'la mañana', tarde: 'la tarde' }
const claveSlot = (turno: number, dia: number, modulo: number) => turno * 10000 + dia * 100 + modulo
const diaEnTexto = (dia: number) => nombreDia(dia).toLowerCase()
const turnoDeSlot = (slot: number) => Math.floor(slot / 10000)
const diaDeSlot = (slot: number) => Math.floor((slot % 10000) / 100)

/** Números pseudoaleatorios repetibles: con la misma semilla se obtiene el mismo horario. */
function crearAzar(semilla: number) {
  let s = semilla >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Los tramos de módulos seguidos de una misma materia en un día. */
function tramos(dia: number[]): { m: number; n: number }[] {
  const resultado: { m: number; n: number }[] = []
  for (const m of dia) {
    const ultimo = resultado[resultado.length - 1]
    if (ultimo && ultimo.m === m) ultimo.n++
    else resultado.push({ m, n: 1 })
  }
  return resultado
}

interface MateriaInterna {
  id: string
  nombre: string
  /** Los docentes que están ocupados cuando se dicta (los de sus grupos si es de un agrupamiento). */
  docentes: number[]
  /** Se dicta de a dos módulos seguidos. */
  bloque: boolean
  /** Ocupa a sus docentes en la búsqueda. En un agrupamiento en varios cursos lo hace una sola de sus materias. */
  carga: boolean
  /** Es de un agrupamiento en varios cursos: se mueve junto con las de los otros cursos. */
  acoplada: boolean
  /** Índice de su agrupamiento, o -1. */
  agrup: number
}

interface AgrupInterno {
  nombre: string
  docentes: number[]
  /** Sus materias (una por curso). */
  materias: number[]
  /** El curso y turno en que está cada una: qué bloque, y qué materia de él. */
  bloques: { bi: number; m: number }[]
}

interface BloqueInterno {
  cursoId: string
  cursoNombre: string
  turno: Turno
  dias: number[]
  minimo: number[]
  maximo: number[]
  largo: number[]
  /** Por día, la materia (índice) de cada módulo desde el primero: los días no tienen huecos. */
  celdas: number[][]
  /** Los módulos que se respetan tal cual y la búsqueda no mueve. */
  fija: boolean[][]
  /** Lo que se guarda como "fijo" en cada módulo respetado. */
  fijoGuardado: boolean[][]
}

interface Foto {
  celdas: number[][][]
  fija: boolean[][][]
  fijoGuardado: boolean[][][]
  largo: number[][]
}

interface DocenteDia {
  docente: number
  turno: number
  dia: number
}

interface Fijada {
  dia: number
  modulo: number
  materia: number
  fijo: boolean
}

/** Un curso y turno mientras se prepara: sus materias, lo fijado y cuántos módulos tiene cada día. */
interface Preparado {
  curso: CursoGenerador
  turno: Turno
  etiqueta: string
  dias: number[]
  capacidad: number[]
  /** Sus materias (índice interno) con las horas semanales que declaran. */
  materias: { idx: number; horas: number; nombre: string }[]
  fijadas: Fijada[]
  /** Módulos de un agrupamiento que se reservan para que coincidan con los de los otros cursos. */
  reservas: { dia: number; modulo: number; materia: number }[]
  horasPorMateria: Map<number, number>
  fijadasPorMateria: Map<number, number>
  largo: number[]
  minimo: number[]
  maximo: number[]
}

/**
 * Arma el horario de los cursos con una búsqueda por recocido simulado: empieza con las materias repartidas al azar y va
 * intercambiando módulos y moviendo días más largos o más cortos hasta que no queden superposiciones de docentes ni
 * módulos fuera de su disponibilidad, cuidando además las reglas del director. Los días de un curso siempre se llenan
 * desde el primer módulo, así que nunca quedan huecos. Las materias de un agrupamiento que reúne varios cursos se dictan
 * a la vez: se ubican en los mismos módulos y se mueven todas juntas.
 */
export class GeneradorHorario {
  private readonly entrada: EntradaGenerador
  private readonly azar: () => number
  private readonly problemas: ProblemaGenerador[] = []
  private readonly materias: MateriaInterna[] = []
  private readonly agrups: AgrupInterno[] = []
  private acopladas: number[] = []
  private readonly bloques: BloqueInterno[] = []
  private readonly docentesNombre: string[] = []
  /** Por docente, los espacios en los que puede dar clase; null si no cargó disponibilidad (puede siempre). */
  private readonly permitido: (Set<number> | null)[] = []
  private readonly capacidadSlot = new Map<number, number>()
  private readonly ocupacion = new Map<number, Map<number, number>>()
  private readonly obstaculos: { slot: number; docente: number; cursoNombre: string }[] = []
  private readonly maxMateria: number
  private readonly sinHuecos: boolean
  private readonly cursosArmados: string[] = []
  private readonly maxIteraciones: number
  private readonly imposible: boolean

  private iteracion = 0
  private recalentamientos = 0
  private costo = 0
  private mejorCosto = Infinity
  private mejorFoto: Foto | null = null
  private iteracionSinProblemas = -1
  private conflictivas: { b: number; d: number; p: number }[] = []
  private terminado = false

  constructor(entrada: EntradaGenerador, opciones: OpcionesGenerador = {}) {
    this.entrada = entrada
    this.azar = crearAzar(opciones.semilla ?? 1)
    this.maxIteraciones = opciones.maxIteraciones ?? 300_000
    this.maxMateria = Math.max(1, entrada.reglas.maxModulosMateriaPorDia ?? MAX_MATERIA_POR_DIA_DEFECTO)
    this.sinHuecos = entrada.reglas.docentesSinHuecos ?? true
    this.imposible = this.preparar()
    if (this.imposible || this.bloques.length === 0) {
      this.terminado = true
      return
    }
    this.armarEstadoInicial()
    this.costo = this.costoCompleto()
    this.guardarMejor()
  }

  get progreso(): number {
    if (this.terminado) return 1
    const tramo = 1 - AVANCE_AL_RECALENTAR
    const recorrido = this.recalentamientos * tramo + this.iteracion / this.maxIteraciones
    return Math.min(0.99, recorrido / (1 + MAX_RECALENTAMIENTOS * tramo))
  }

  // ── Preparación: bloques, materias, disponibilidad y controles previos ─────────────────────────────

  /** Deja todo listo para buscar. Devuelve true si los datos hacen imposible armar el horario. */
  private preparar(): boolean {
    const { entrada } = this
    const { grilla, reglas } = entrada
    let fatal = false
    const error = (mensaje: string) => {
      this.problemas.push({ gravedad: 'error', mensaje })
      fatal = true
    }
    const aviso = (mensaje: string) => this.problemas.push({ gravedad: 'aviso', mensaje })

    const agrupamientos = entrada.agrupamientos ?? []
    const agrupDeMateria = new Map<string, AgrupamientoGenerador>()
    for (const a of agrupamientos) for (const id of a.materias) agrupDeMateria.set(id, a)

    // Docentes y en qué espacios de la grilla pueden dar clase
    const indiceDocente = new Map<string, number>()
    const docenteDe = (personalId: string | null): number => {
      if (!personalId) return -1
      let i = indiceDocente.get(personalId)
      if (i === undefined) {
        i = this.docentesNombre.length
        indiceDocente.set(personalId, i)
        this.docentesNombre.push(entrada.nombreDocente(personalId))
        const franjas = entrada.disponibilidad(personalId)
        if (franjas.length === 0) this.permitido.push(null)
        else {
          const permitidos = new Set<number>()
          for (const turno of TURNOS) {
            for (const d of DIAS_SEMANA) {
              modulosDelDia(grilla, turno, d.n).forEach((_, k) => {
                if (puedeDarClase(franjas, grilla, turno, d.n, k + 1)) permitidos.add(claveSlot(TURNO_INDICE[turno], d.n, k + 1))
              })
            }
          }
          this.permitido.push(permitidos)
        }
      }
      return i
    }
    const docentesDe = (personalIds: string[]) => [...new Set(personalIds.map(docenteDe).filter((d) => d >= 0))]

    for (const turno of TURNOS) {
      for (const d of DIAS_SEMANA) this.capacidadSlot.set(claveSlot(TURNO_INDICE[turno], d.n, 0), modulosDelDia(grilla, turno, d.n).length)
    }

    const materiaPorId = new Map(entrada.materias.map((m) => [m.id, m]))
    const nombreCurso = new Map(entrada.cursos.map((c) => [c.id, c.nombre]))

    // Los cursos que comparten un agrupamiento se arman juntos: sus materias van en los mismos módulos
    const aArmar = new Set(entrada.cursosAArmar)
    for (let cambio = true; cambio; ) {
      cambio = false
      for (const a of agrupamientos) {
        const cursosDelAgrupamiento = a.materias.map((id) => materiaPorId.get(id)?.curso_id).filter((c): c is string => !!c)
        if (!cursosDelAgrupamiento.some((c) => aArmar.has(c))) continue
        const nuevos = [...new Set(cursosDelAgrupamiento)].filter((c) => !aArmar.has(c))
        if (nuevos.length === 0) continue
        nuevos.forEach((c) => aArmar.add(c))
        aviso(`Se arma también ${nuevos.map((c) => nombreCurso.get(c) ?? 'otro curso').join(' y ')} porque ${nuevos.length === 1 ? 'comparte' : 'comparten'} ${a.nombre} con los demás.`)
        cambio = true
      }
    }
    const cursos = entrada.cursos.filter((c) => aArmar.has(c.id))

    // Lo que ocupan los cursos que no se arman: son obstáculos fijos para los docentes
    const clasesVistas = new Set<string>()
    for (const c of entrada.existente) {
      if (aArmar.has(c.curso_id)) continue
      const materia = materiaPorId.get(c.materia_id)
      if (!materia) continue
      const agrupamiento = agrupDeMateria.get(materia.id)
      const slot = claveSlot(TURNO_INDICE[c.turno], c.dia, c.modulo)
      if (agrupamiento) {
        // Las materias de un agrupamiento son una sola clase: se cuenta una vez
        const clave = `${agrupamiento.id}|${slot}`
        if (clasesVistas.has(clave)) continue
        clasesVistas.add(clave)
      }
      const docentes = agrupamiento ? docentesDe(agrupamiento.docentes) : docentesDe(materia.personal_id ? [materia.personal_id] : [])
      for (const docente of docentes) {
        this.ocupar(slot, docente, 1)
        this.obstaculos.push({ slot, docente, cursoNombre: nombreCurso.get(c.curso_id) ?? 'otro curso' })
      }
    }

    // Un bloque por curso y turno, con las materias que se dictan en ese turno
    const armables = new Map<string, { curso: CursoGenerador; turno: Turno; materias: { m: MateriaGenerador; horas: number }[] }>()
    for (const curso of cursos) {
      const turnos = turnosDelCurso(curso.turno)
      if (turnos.length === 0) {
        error(`El curso ${curso.nombre} no tiene turno: definilo en Ciclo Lectivo → Horario.`)
        continue
      }
      for (const m of entrada.materias.filter((x) => x.curso_id === curso.id)) {
        const horas = m.horas_semanales
        if (horas == null || horas <= 0) {
          aviso(`${m.nombre} (${curso.nombre}) no tiene horas semanales cargadas: no se ubica.`)
          continue
        }
        if (!Number.isInteger(horas)) {
          aviso(`${m.nombre} (${curso.nombre}) tiene ${horas} horas semanales: tiene que ser un número entero de módulos. No se ubica.`)
          continue
        }
        const turno = m.turno ?? (turnos.length === 1 ? turnos[0] : null)
        if (!turno) {
          error(`${m.nombre} (${curso.nombre}): el curso hace doble turno, indicá en qué turno se dicta la materia.`)
          continue
        }
        if (!turnos.includes(turno)) {
          error(`${m.nombre} (${curso.nombre}) se dicta a ${NOMBRE_TURNO[turno]}, pero el curso no cursa en ese turno.`)
          continue
        }
        const clave = `${curso.id}|${turno}`
        const bloque = armables.get(clave) ?? { curso, turno, materias: [] }
        bloque.materias.push({ m, horas })
        armables.set(clave, bloque)
      }
    }

    // Lo ya cargado que se respeta: todo en "completar"; solo lo fijo en "rearmar"
    const respetadas = entrada.existente.filter((c) => aArmar.has(c.curso_id) && (entrada.modo === 'completar' || c.fijo))
    let descartadas = 0

    // ── Paso 1: las materias de cada curso y turno, y lo que ya está fijado ─────────────────────────
    const preparados: Preparado[] = []
    const prepDeMateria = new Map<number, Preparado>()
    const indiceAgrup = new Map<string, number>()
    for (const { curso, turno, materias } of armables.values()) {
      const dias: number[] = DIAS_SEMANA.filter((d) => modulosDelDia(grilla, turno, d.n).length > 0).map((d) => d.n)
      const etiqueta = `${curso.nombre} (${turno === 'manana' ? 'mañana' : 'tarde'})`
      if (dias.length === 0) {
        error(`No hay espacios cargados para ${NOMBRE_TURNO[turno]}: cargalos en Ciclo Lectivo → Horario.`)
        continue
      }
      const prep: Preparado = {
        curso,
        turno,
        etiqueta,
        dias,
        capacidad: dias.map((d) => modulosDelDia(grilla, turno, d).length),
        materias: [],
        fijadas: [],
        reservas: [],
        horasPorMateria: new Map(),
        fijadasPorMateria: new Map(),
        largo: [],
        minimo: [],
        maximo: [],
      }
      const indiceMateria = new Map<string, number>()
      for (const { m, horas } of materias) {
        let bloque = m.bloque_doble
        if (bloque && horas % 2 === 1) {
          aviso(`${m.nombre} (${curso.nombre}) tiene ${horas} módulos, un número impar: no se puede dictar en bloques de dos y se ubica módulo a módulo.`)
          bloque = false
        }
        if (bloque && this.maxMateria < 2) {
          aviso(`${m.nombre} (${curso.nombre}) va en bloques de dos módulos pero el máximo de una materia por día es ${this.maxMateria}: no se arma en bloque.`)
          bloque = false
        }
        const agrupamiento = agrupDeMateria.get(m.id)
        let agrup = -1
        if (agrupamiento) {
          agrup = indiceAgrup.get(agrupamiento.id) ?? this.agrups.length
          if (agrup === this.agrups.length) {
            indiceAgrup.set(agrupamiento.id, agrup)
            this.agrups.push({ nombre: agrupamiento.nombre, docentes: docentesDe(agrupamiento.docentes), materias: [], bloques: [] })
          }
        }
        const idx = this.materias.length
        this.materias.push({
          id: m.id,
          nombre: m.nombre,
          docentes: agrup >= 0 ? this.agrups[agrup].docentes : docentesDe(m.personal_id ? [m.personal_id] : []),
          bloque,
          carga: true,
          acoplada: false,
          agrup,
        })
        if (agrup >= 0) this.agrups[agrup].materias.push(idx)
        indiceMateria.set(m.id, idx)
        prep.materias.push({ idx, horas, nombre: m.nombre })
        prepDeMateria.set(idx, prep)
      }

      // Los módulos ya cargados que se conservan
      for (const c of respetadas.filter((x) => x.curso_id === curso.id && x.turno === turno)) {
        const materia = indiceMateria.get(c.materia_id)
        const i = dias.indexOf(c.dia)
        if (materia === undefined || i < 0 || c.modulo > prep.capacidad[i] || prep.fijadas.some((f) => f.dia === c.dia && f.modulo === c.modulo)) {
          descartadas++
          continue
        }
        prep.fijadas.push({ dia: c.dia, modulo: c.modulo, materia, fijo: c.fijo })
      }
      preparados.push(prep)
    }
    if (descartadas > 0) {
      aviso(`${descartadas} ${descartadas === 1 ? 'módulo cargado ya no es válido' : 'módulos cargados ya no son válidos'} (materia o espacio que no existen) y se quitan.`)
    }

    // Una sola materia de cada agrupamiento ocupa a los docentes; las de varios cursos se mueven juntas
    for (const ag of this.agrups) {
      ag.materias.sort((a, b) => a - b)
      ag.materias.forEach((m, k) => {
        this.materias[m].carga = k === 0
        this.materias[m].acoplada = ag.materias.length > 1
      })
    }
    this.acopladas = this.agrups.map((_, i) => i).filter((i) => this.agrups[i].materias.length > 1)

    // ── Paso 2: los agrupamientos en varios cursos se dictan a la vez, así que lo fijado en uno vale para todos ─
    const horasDeclaradas = new Map<number, number>()
    for (const p of preparados) for (const m of p.materias) horasDeclaradas.set(m.idx, m.horas)
    const unionFijada = new Map<number, Map<string, { dia: number; modulo: number }>>()
    for (const a of this.acopladas) {
      const ag = this.agrups[a]
      const miembros = ag.materias.map((m) => ({ m, prep: prepDeMateria.get(m)! }))
      const horas = horasDeclaradas.get(ag.materias[0])!
      if (miembros.some((x) => horasDeclaradas.get(x.m) !== horas)) {
        const detalle = miembros.map((x) => `${x.prep.curso.nombre}: ${horasDeclaradas.get(x.m)}`).join(', ')
        error(`${ag.nombre} se dicta a la vez en todos los cursos y sus materias tienen horas semanales distintas (${detalle}).`)
        continue
      }
      if (new Set(miembros.map((x) => x.prep.turno)).size > 1) {
        error(`${ag.nombre} se dicta a la vez en todos los cursos, pero sus materias son de turnos distintos.`)
        continue
      }
      const union = new Map<string, { dia: number; modulo: number }>()
      for (const { m, prep } of miembros) {
        for (const f of prep.fijadas) if (f.materia === m) union.set(`${f.dia}:${f.modulo}`, { dia: f.dia, modulo: f.modulo })
      }
      for (const { dia, modulo } of union.values()) {
        for (const { m, prep } of miembros) {
          const ya = prep.fijadas.find((f) => f.dia === dia && f.modulo === modulo)
          if (ya) {
            if (ya.materia !== m) {
              error(`${ag.nombre} está fijado el ${diaEnTexto(dia)}, módulo ${modulo} en otro curso, pero ${prep.curso.nombre} tiene otra materia fijada en ese módulo.`)
            }
            continue
          }
          const i = prep.dias.indexOf(dia)
          if (i < 0 || modulo > prep.capacidad[i]) {
            error(`${ag.nombre} está fijado el ${diaEnTexto(dia)}, módulo ${modulo} en otro curso, pero ${prep.curso.nombre} no tiene ese módulo.`)
            continue
          }
          prep.fijadas.push({ dia, modulo, materia: m, fijo: false })
        }
      }
      if (union.size > horas) error(`${ag.nombre} tiene ${union.size} módulos fijados y sus horas semanales son ${horas}.`)
      unionFijada.set(a, union)
    }

    // ── Paso 3: cuántos módulos tiene cada curso por día y cuántos hay que ubicar de cada materia ─────
    for (const prep of preparados) {
      const { curso, dias, capacidad, etiqueta } = prep
      for (const f of prep.fijadas) prep.fijadasPorMateria.set(f.materia, (prep.fijadasPorMateria.get(f.materia) ?? 0) + 1)
      for (const { idx, horas, nombre } of prep.materias) {
        const fijadasDeLaMateria = prep.fijadasPorMateria.get(idx) ?? 0
        if (fijadasDeLaMateria > horas && this.materias[idx].agrup < 0) {
          this.problemas.push({ gravedad: 'aviso', mensaje: `${nombre} (${curso.nombre}) tiene fijados ${fijadasDeLaMateria} módulos y sus horas semanales son ${horas}.` })
        }
        prep.horasPorMateria.set(idx, Math.max(horas, fijadasDeLaMateria))
        if (horas > this.maxMateria * dias.length) {
          error(`${nombre} (${curso.nombre}) tiene ${horas} módulos y con un máximo de ${this.maxMateria} por día no entran en los ${dias.length} días de clase.`)
        }
      }

      const total = [...prep.horasPorMateria.values()].reduce((suma, h) => suma + h, 0)
      const minimo = reglas.minModulosPorDia?.[prep.turno] ?? 0
      const maximoRegla = reglas.maxModulosPorDia?.[prep.turno] ?? Infinity
      prep.minimo = dias.map((d, i) => Math.max(capacidad[i] >= minimo ? minimo : 0, ...prep.fijadas.filter((f) => f.dia === d).map((f) => f.modulo)))
      prep.maximo = capacidad.map((c, i) => Math.max(Math.min(c, maximoRegla), prep.minimo[i]))
      const sumaInferior = prep.minimo.reduce((a, b) => a + b, 0)
      const sumaSuperior = prep.maximo.reduce((a, b) => a + b, 0)

      if (total > sumaSuperior) {
        error(
          `${etiqueta}: las materias suman ${total} módulos y solo hay ${sumaSuperior} espacios${
            maximoRegla < Infinity ? ` con el máximo de ${maximoRegla} módulos por día` : ''
          }.`,
        )
        continue
      }
      if (total < sumaInferior) {
        error(`${etiqueta}: las materias suman ${total} módulos y con lo mínimo por día y lo ya fijado hacen falta al menos ${sumaInferior}.`)
        continue
      }

      // Cada día parte de su mínimo y el resto se reparte parejo entre los días que tienen lugar
      prep.largo = [...prep.minimo]
      let faltan = total - sumaInferior
      while (faltan > 0) {
        const orden = dias.map((_, i) => i).sort((a, b) => prep.largo[a] - prep.largo[b] || capacidad[b] - capacidad[a])
        for (const i of orden) {
          if (faltan > 0 && prep.largo[i] < prep.maximo[i]) {
            prep.largo[i]++
            faltan--
          }
        }
      }
    }

    // Un docente no puede dar más módulos de los espacios en los que puede, descontando lo que ya ocupa afuera
    const necesidad = new Map<string, number>()
    for (const prep of preparados) {
      for (const { idx } of prep.materias) {
        const materia = this.materias[idx]
        if (!materia.carga) continue
        for (const docente of materia.docentes) {
          const clave = `${docente}|${TURNO_INDICE[prep.turno]}`
          necesidad.set(clave, (necesidad.get(clave) ?? 0) + (prep.horasPorMateria.get(idx) ?? 0))
        }
      }
    }
    for (const [clave, necesarios] of necesidad) {
      const [docente, turnoIndice] = clave.split('|').map(Number)
      const turno = TURNOS[turnoIndice]
      const permitido = this.permitido[docente]
      let disponibles = 0
      for (const d of DIAS_SEMANA) {
        for (let k = 1; k <= modulosDelDia(grilla, turno, d.n).length; k++) {
          const slot = claveSlot(turnoIndice, d.n, k)
          const ocupadoAfuera = this.obstaculos.some((o) => o.slot === slot && o.docente === docente)
          if (!ocupadoAfuera && (!permitido || permitido.has(slot))) disponibles++
        }
      }
      if (necesarios > disponibles) {
        error(`${this.docentesNombre[docente]} tiene que dar ${necesarios} módulos a ${NOMBRE_TURNO[turno]} pero solo puede en ${disponibles} espacios.`)
      }
    }
    if (fatal) return true

    // ── Paso 4: los módulos de cada agrupamiento en varios cursos: los mismos en todos ────────────────
    const provisorios: { slot: number; docente: number }[] = []
    for (const a of this.acopladas) {
      const ag = this.agrups[a]
      const miembros = ag.materias.map((m) => ({ m, prep: prepDeMateria.get(m)! }))
      const horas = horasDeclaradas.get(ag.materias[0])!
      const union = unionFijada.get(a)!
      const turnoIndice = TURNO_INDICE[miembros[0].prep.turno]
      const dias = miembros[0].prep.dias
      const cuentaDia = dias.map((d) => [...union.values()].filter((f) => f.dia === d).length)
      const largoMinimo = dias.map((_, i) => Math.min(...miembros.map((x) => x.prep.largo[i])))
      const esLibre = (i: number, modulo: number) =>
        miembros.every(
          ({ prep }) => !prep.fijadas.some((f) => f.dia === dias[i] && f.modulo === modulo) && !prep.reservas.some((r) => r.dia === dias[i] && r.modulo === modulo),
        )
      const candidatos: { i: number; modulo: number }[] = []
      dias.forEach((_, i) => {
        for (let modulo = 1; modulo <= largoMinimo[i]; modulo++) if (esLibre(i, modulo)) candidatos.push({ i, modulo })
      })
      // Se prefieren los espacios en los que los docentes pueden y no están ocupados, y repartir en distintos días
      const problemasDelEspacio = (i: number, modulo: number) => {
        const slot = claveSlot(turnoIndice, dias[i], modulo)
        return ag.docentes.filter((d) => (this.permitido[d] && !this.permitido[d]!.has(slot)) || this.ocupacion.get(slot)?.has(d)).length
      }
      const elegidos: { i: number; modulo: number }[] = []
      const enBloque = this.materias[ag.materias[0]].bloque
      let restan = horas - union.size
      while (restan > 0) {
        const pares = enBloque && restan >= 2
        const opciones = candidatos
          .filter((c) => !elegidos.includes(c) && (!pares || candidatos.some((s) => s.i === c.i && s.modulo === c.modulo + 1 && !elegidos.includes(s))))
          .map((c) => ({
            c,
            clave: [cuentaDia[c.i], problemasDelEspacio(c.i, c.modulo) + (pares ? problemasDelEspacio(c.i, c.modulo + 1) : 0), this.azar()],
          }))
          .sort((x, y) => x.clave[0] - y.clave[0] || x.clave[1] - y.clave[1] || x.clave[2] - y.clave[2])
        if (opciones.length === 0) break
        const { c } = opciones[0]
        const tomar = pares ? [c, candidatos.find((s) => s.i === c.i && s.modulo === c.modulo + 1)!] : [c]
        for (const t of tomar) {
          elegidos.push(t)
          cuentaDia[t.i]++
        }
        restan -= tomar.length
      }
      if (restan > 0) {
        error(`${ag.nombre}: no hay ${horas - union.size} módulos en los que coincidan ${miembros.map((x) => x.prep.curso.nombre).join(', ')}.`)
        continue
      }
      for (const { m, prep } of miembros) for (const e of elegidos) prep.reservas.push({ dia: dias[e.i], modulo: e.modulo, materia: m })
      // Para que los agrupamientos siguientes eviten a estos docentes
      for (const e of elegidos) {
        const slot = claveSlot(turnoIndice, dias[e.i], e.modulo)
        for (const docente of ag.docentes) {
          this.ocupar(slot, docente, 1)
          provisorios.push({ slot, docente })
        }
      }
    }
    for (const { slot, docente } of provisorios) this.ocupar(slot, docente, -1)
    if (fatal) return true

    // ── Paso 5: se arman los bloques ──────────────────────────────────────────────────────────────────
    for (const prep of preparados) {
      const { curso, turno, dias, largo } = prep
      const pendientes: number[] = []
      for (const [idx, horas] of prep.horasPorMateria) {
        const ubicadas = (prep.fijadasPorMateria.get(idx) ?? 0) + prep.reservas.filter((r) => r.materia === idx).length
        for (let k = 0; k < horas - ubicadas; k++) pendientes.push(idx)
      }
      for (let i = pendientes.length - 1; i > 0; i--) {
        const j = Math.floor(this.azar() * (i + 1))
        ;[pendientes[i], pendientes[j]] = [pendientes[j], pendientes[i]]
      }
      const celdas = dias.map(() => [] as number[])
      const fija = dias.map(() => [] as boolean[])
      const fijoGuardado = dias.map(() => [] as boolean[])
      dias.forEach((d, i) => {
        for (let p = 0; p < largo[i]; p++) {
          const fijada = prep.fijadas.find((f) => f.dia === d && f.modulo === p + 1)
          const reserva = prep.reservas.find((r) => r.dia === d && r.modulo === p + 1)
          celdas[i].push(fijada ? fijada.materia : reserva ? reserva.materia : pendientes.pop()!)
          fija[i].push(!!fijada)
          fijoGuardado[i].push(fijada?.fijo ?? false)
        }
      })
      const bi = this.bloques.length
      this.bloques.push({
        cursoId: curso.id,
        cursoNombre: curso.nombre,
        turno,
        dias,
        minimo: prep.minimo,
        maximo: prep.maximo,
        largo,
        celdas,
        fija,
        fijoGuardado,
      })
      for (const { idx } of prep.materias) if (this.materias[idx].agrup >= 0) this.agrups[this.materias[idx].agrup].bloques.push({ bi, m: idx })
      if (!this.cursosArmados.includes(curso.id)) this.cursosArmados.push(curso.id)
    }
    return false
  }

  // ── Estado y costos ─────────────────────────────────────────────────────────────────────────────────

  private ocupar(slot: number, docente: number, delta: number) {
    if (docente < 0) return
    let m = this.ocupacion.get(slot)
    if (!m) {
      m = new Map()
      this.ocupacion.set(slot, m)
    }
    const n = (m.get(docente) ?? 0) + delta
    if (n <= 0) m.delete(docente)
    else m.set(docente, n)
  }

  /** Suma o quita a los docentes de una materia de un espacio (solo si la materia los ocupa). */
  private cargar(slot: number, materia: number, delta: number) {
    const m = this.materias[materia]
    if (!m.carga) return
    for (const docente of m.docentes) this.ocupar(slot, docente, delta)
  }

  private docentesDelDia(materias: number[], turno: number, dias: number[]): DocenteDia[] {
    const lista: DocenteDia[] = []
    for (const m of materias) for (const docente of this.materias[m].docentes) for (const dia of dias) lista.push({ docente, turno, dia })
    return lista
  }

  private armarEstadoInicial() {
    for (const b of this.bloques) {
      const turno = TURNO_INDICE[b.turno]
      b.celdas.forEach((dia, i) => dia.forEach((m, p) => this.cargar(claveSlot(turno, b.dias[i], p + 1), m, 1)))
    }
  }

  /** Superposiciones y horarios fuera de disponibilidad en un espacio. */
  private costoSlot(slot: number): number {
    const m = this.ocupacion.get(slot)
    if (!m) return 0
    let costo = 0
    for (const [docente, n] of m) {
      if (n > 1) costo += (n - 1) * PESO_DURO
      const permitido = this.permitido[docente]
      if (permitido && !permitido.has(slot)) costo += n * PESO_DURO
    }
    return costo
  }

  /** Módulos libres de un docente entre su primera y su última clase de un día. */
  private huecos(docente: number, turno: number, dia: number): number {
    const capacidad = this.capacidadSlot.get(claveSlot(turno, dia, 0)) ?? 0
    let primero = -1
    let ultimo = -1
    let ocupadas = 0
    for (let m = 1; m <= capacidad; m++) {
      if (this.ocupacion.get(claveSlot(turno, dia, m))?.has(docente)) {
        if (primero < 0) primero = m
        ultimo = m
        ocupadas++
      }
    }
    return primero < 0 ? 0 : ultimo - primero + 1 - ocupadas
  }

  private costoHuecos(docente: number, turno: number, dia: number): number {
    if (!this.sinHuecos || docente < 0) return 0
    return this.huecos(docente, turno, dia) * PESO_SUAVE
  }

  /** Reglas del director en un día de un curso: máximo de una materia, bloques dobles y (con `soloMedio` falso) preferencias. */
  private costoDia(b: BloqueInterno, i: number, soloMedio = false): number {
    const dia = b.celdas[i]
    let costo = 0
    const cuenta = new Map<number, number>()
    for (const m of dia) cuenta.set(m, (cuenta.get(m) ?? 0) + 1)
    for (const [m, n] of cuenta) {
      if (n > this.maxMateria) costo += (n - this.maxMateria) * PESO_MEDIO
      else if (n > 1 && !soloMedio && !this.materias[m].bloque) costo += (n - 1) * PESO_TENUE
    }
    for (const t of tramos(dia)) if (this.materias[t.m].bloque && t.n % 2 === 1) costo += PESO_MEDIO
    return costo
  }

  /** Preferencia por que los días de un curso tengan una cantidad parecida de módulos. */
  private costoLargos(b: BloqueInterno): number {
    const promedio = b.largo.reduce((a, c) => a + c, 0) / Math.max(1, b.dias.length)
    return b.largo.reduce((costo, largo) => costo + (largo - promedio) ** 2 * PESO_TENUE, 0)
  }

  private costoCompleto(): number {
    let costo = 0
    for (const b of this.bloques) {
      costo += this.costoLargos(b)
      b.dias.forEach((_, i) => (costo += this.costoDia(b, i)))
    }
    const docentesDia = new Map<string, DocenteDia>()
    for (const [slot, m] of this.ocupacion) {
      costo += this.costoSlot(slot)
      for (const docente of m.keys()) {
        const x = { docente, turno: turnoDeSlot(slot), dia: diaDeSlot(slot) }
        docentesDia.set(`${x.docente}|${x.turno}|${x.dia}`, x)
      }
    }
    for (const x of docentesDia.values()) costo += this.costoHuecos(x.docente, x.turno, x.dia)
    return costo
  }

  /** El costo de lo que un movimiento puede cambiar: los días tocados del curso, los espacios y los días de los docentes. */
  private costoLocal(b: BloqueInterno, dias: number[], slots: number[], docentesDia: DocenteDia[], conLargos: boolean): number {
    let costo = conLargos ? this.costoLargos(b) : 0
    for (const i of new Set(dias)) costo += this.costoDia(b, i)
    for (const s of new Set(slots)) costo += this.costoSlot(s)
    const vistos = new Set<string>()
    for (const x of docentesDia) {
      const clave = `${x.docente}|${x.turno}|${x.dia}`
      if (vistos.has(clave)) continue
      vistos.add(clave)
      costo += this.costoHuecos(x.docente, x.turno, x.dia)
    }
    return costo
  }

  private tomarFoto(): Foto {
    return {
      celdas: this.bloques.map((b) => b.celdas.map((d) => [...d])),
      fija: this.bloques.map((b) => b.fija.map((d) => [...d])),
      fijoGuardado: this.bloques.map((b) => b.fijoGuardado.map((d) => [...d])),
      largo: this.bloques.map((b) => [...b.largo]),
    }
  }

  private guardarMejor() {
    this.mejorCosto = this.costo
    this.mejorFoto = this.tomarFoto()
  }

  private restaurar(foto: Foto) {
    this.ocupacion.clear()
    for (const o of this.obstaculos) this.ocupar(o.slot, o.docente, 1)
    this.bloques.forEach((b, i) => {
      b.celdas = foto.celdas[i].map((d) => [...d])
      b.fija = foto.fija[i].map((d) => [...d])
      b.fijoGuardado = foto.fijoGuardado[i].map((d) => [...d])
      b.largo = [...foto.largo[i]]
    })
    this.armarEstadoInicial()
    this.costo = this.costoCompleto()
  }

  /** Lo que todavía se incumple de verdad (sin contar preferencias), para saber cuándo ya se puede terminar. */
  private incumplimientos(): number {
    let total = 0
    for (const slot of this.ocupacion.keys()) total += this.costoSlot(slot)
    for (const b of this.bloques) b.dias.forEach((_, i) => (total += this.costoDia(b, i, true)))
    return total
  }

  /** Los módulos que hoy están en conflicto y conviene mover primero. */
  private buscarConflictivas() {
    this.conflictivas = []
    this.bloques.forEach((b, bi) => {
      const turno = TURNO_INDICE[b.turno]
      b.celdas.forEach((dia, d) =>
        dia.forEach((m, p) => {
          if (b.fija[d][p]) return
          const slot = claveSlot(turno, b.dias[d], p + 1)
          const permitido = (docente: number) => this.permitido[docente]
          const enConflicto = this.materias[m].docentes.some(
            (docente) => (this.ocupacion.get(slot)?.get(docente) ?? 0) > 1 || (permitido(docente) && !permitido(docente)!.has(slot)),
          )
          if (enConflicto) this.conflictivas.push({ b: bi, d, p })
        }),
      )
    })
  }

  // ── Búsqueda ────────────────────────────────────────────────────────────────────────────────────────

  /** Cambia de lugar dos módulos de un curso. Con `origen`, uno de los dos es ese módulo. */
  private intentarIntercambio(b: BloqueInterno, temperatura: number, origen?: { d: number; p: number }): void {
    const turno = TURNO_INDICE[b.turno]
    const d1 = origen?.d ?? Math.floor(this.azar() * b.dias.length)
    const d2 = Math.floor(this.azar() * b.dias.length)
    if (b.celdas[d1].length === 0 || b.celdas[d2].length === 0) return
    const p1 = origen?.p ?? Math.floor(this.azar() * b.celdas[d1].length)
    const p2 = Math.floor(this.azar() * b.celdas[d2].length)
    // Un módulo en conflicto anotado antes puede haber cambiado de lugar
    if (p1 >= b.celdas[d1].length || b.fija[d1][p1] || b.fija[d2][p2]) return
    const m1 = b.celdas[d1][p1]
    const m2 = b.celdas[d2][p2]
    // Las materias de un agrupamiento en varios cursos solo se mueven todas juntas
    if (m1 === m2 || this.materias[m1].acoplada || this.materias[m2].acoplada) return
    const s1 = claveSlot(turno, b.dias[d1], p1 + 1)
    const s2 = claveSlot(turno, b.dias[d2], p2 + 1)
    const dias = [d1, d2]
    const slots = [s1, s2]
    const docentesDia = this.docentesDelDia([m1, m2], turno, [b.dias[d1], b.dias[d2]])
    const antes = this.costoLocal(b, dias, slots, docentesDia, false)
    b.celdas[d1][p1] = m2
    b.celdas[d2][p2] = m1
    this.cargar(s1, m1, -1)
    this.cargar(s2, m2, -1)
    this.cargar(s1, m2, 1)
    this.cargar(s2, m1, 1)
    const delta = this.costoLocal(b, dias, slots, docentesDia, false) - antes
    if (delta <= 0 || this.azar() < Math.exp(-delta / temperatura)) {
      this.costo += delta
      return
    }
    b.celdas[d1][p1] = m1
    b.celdas[d2][p2] = m2
    this.cargar(s1, m2, -1)
    this.cargar(s2, m1, -1)
    this.cargar(s1, m1, 1)
    this.cargar(s2, m2, 1)
  }

  /** Pasa el último módulo de un día al final de otro: uno queda más corto y el otro más largo. */
  private intentarTraslado(b: BloqueInterno, temperatura: number): void {
    const turno = TURNO_INDICE[b.turno]
    const i = Math.floor(this.azar() * b.dias.length)
    const j = Math.floor(this.azar() * b.dias.length)
    if (i === j || b.largo[i] <= b.minimo[i] || b.largo[j] >= b.maximo[j]) return
    const ultimo = b.celdas[i].length - 1
    if (b.fija[i][ultimo]) return
    const m = b.celdas[i][ultimo]
    if (this.materias[m].acoplada) return
    const origen = claveSlot(turno, b.dias[i], ultimo + 1)
    const destino = claveSlot(turno, b.dias[j], b.celdas[j].length + 1)
    const dias = [i, j]
    const slots = [origen, destino]
    const docentesDia = this.docentesDelDia([m], turno, [b.dias[i], b.dias[j]])
    const antes = this.costoLocal(b, dias, slots, docentesDia, true)
    const eraFijoGuardado = b.fijoGuardado[i].pop()!
    b.celdas[i].pop()
    b.fija[i].pop()
    b.largo[i]--
    b.celdas[j].push(m)
    b.fija[j].push(false)
    b.fijoGuardado[j].push(false)
    b.largo[j]++
    this.cargar(origen, m, -1)
    this.cargar(destino, m, 1)
    const delta = this.costoLocal(b, dias, slots, docentesDia, true) - antes
    if (delta <= 0 || this.azar() < Math.exp(-delta / temperatura)) {
      this.costo += delta
      return
    }
    b.celdas[j].pop()
    b.fija[j].pop()
    b.fijoGuardado[j].pop()
    b.largo[j]--
    b.celdas[i].push(m)
    b.fija[i].push(false)
    b.fijoGuardado[i].push(eraFijoGuardado)
    b.largo[i]++
    this.cargar(destino, m, -1)
    this.cargar(origen, m, 1)
  }

  /**
   * Mueve una clase de un agrupamiento en varios cursos a otro módulo: en todos los cursos a la vez, cambiándola de lugar
   * con lo que haya en el módulo de destino. Así las materias nunca dejan de coincidir.
   */
  private intentarMoverAgrupamiento(a: number, temperatura: number, origen?: { d: number; p: number }): void {
    const refs = this.agrups[a].bloques
    const { bi: primero, m: mPrimero } = refs[0]
    const b0 = this.bloques[primero]
    const turno = TURNO_INDICE[b0.turno]
    let d1: number
    let p1: number
    if (origen) {
      d1 = origen.d
      p1 = origen.p
    } else {
      const posiciones: { d: number; p: number }[] = []
      b0.celdas.forEach((dia, d) => dia.forEach((m, p) => m === mPrimero && !b0.fija[d][p] && posiciones.push({ d, p })))
      if (posiciones.length === 0) return
      ;({ d: d1, p: p1 } = posiciones[Math.floor(this.azar() * posiciones.length)])
    }
    const d2 = Math.floor(this.azar() * b0.dias.length)
    if (b0.celdas[d2].length === 0) return
    const p2 = Math.floor(this.azar() * b0.celdas[d2].length)
    if (d1 === d2 && p1 === p2) return
    // Tiene que poderse en todos los cursos: la clase en el origen, y en el destino algo que se pueda mover
    for (const { bi, m } of refs) {
      const b = this.bloques[bi]
      if (p1 >= b.celdas[d1].length || b.celdas[d1][p1] !== m || b.fija[d1][p1]) return
      if (p2 >= b.celdas[d2].length || b.fija[d2][p2] || this.materias[b.celdas[d2][p2]].acoplada) return
    }
    const s1 = claveSlot(turno, b0.dias[d1], p1 + 1)
    const s2 = claveSlot(turno, b0.dias[d2], p2 + 1)
    const tocadas = refs.flatMap(({ bi, m }) => [m, this.bloques[bi].celdas[d2][p2]])
    const docentesDia = this.docentesDelDia(tocadas, turno, [b0.dias[d1], b0.dias[d2]])
    const dias = [d1, d2]
    const costoDe = () => refs.reduce((suma, { bi }, k) => suma + this.costoLocal(this.bloques[bi], dias, k === 0 ? [s1, s2] : [], k === 0 ? docentesDia : [], false), 0)
    const antes = costoDe()
    const desplazadas = refs.map(({ bi }) => this.bloques[bi].celdas[d2][p2])
    const intercambiar = (haciaAdelante: boolean) => {
      refs.forEach(({ bi, m }, k) => {
        const b = this.bloques[bi]
        const otra = desplazadas[k]
        // haciaAdelante: la clase va de s1 a s2 y lo que había en s2 va a s1; al deshacer, al revés
        const enS1 = haciaAdelante ? m : otra
        const enS2 = haciaAdelante ? otra : m
        this.cargar(s1, enS1, -1)
        this.cargar(s2, enS2, -1)
        b.celdas[d1][p1] = haciaAdelante ? otra : m
        b.celdas[d2][p2] = haciaAdelante ? m : otra
        this.cargar(s1, b.celdas[d1][p1], 1)
        this.cargar(s2, b.celdas[d2][p2], 1)
      })
    }
    intercambiar(true)
    const delta = costoDe() - antes
    if (delta <= 0 || this.azar() < Math.exp(-delta / temperatura)) {
      this.costo += delta
      return
    }
    intercambiar(false)
  }

  /** Avanza la búsqueda durante unos milisegundos. Devuelve true cuando terminó. */
  avanzar(milisegundos: number): boolean {
    if (this.terminado) return true
    const limite = Date.now() + milisegundos
    const total = this.bloques.reduce((suma, b) => suma + b.celdas.reduce((s, d) => s + d.length, 0), 0)
    while (!this.terminado && Date.now() < limite) {
      for (let k = 0; k < 400; k++) {
        const avance = this.iteracion / this.maxIteraciones
        const temperatura = 25 * Math.pow(0.2 / 25, avance)
        if (this.iteracion % 250 === 0) this.buscarConflictivas()
        const bi = Math.floor(this.azar() * this.bloques.length)
        if (this.conflictivas.length > 0 && this.azar() < 0.5) {
          const c = this.conflictivas[Math.floor(this.azar() * this.conflictivas.length)]
          const b = this.bloques[c.b]
          const materia = b.celdas[c.d]?.[c.p]
          if (materia !== undefined && this.materias[materia].acoplada) this.intentarMoverAgrupamiento(this.materias[materia].agrup, temperatura, { d: c.d, p: c.p })
          else this.intentarIntercambio(b, temperatura, { d: c.d, p: c.p })
        } else {
          const r = this.azar()
          if (this.acopladas.length > 0 && r < 0.15) {
            this.intentarMoverAgrupamiento(this.acopladas[Math.floor(this.azar() * this.acopladas.length)], temperatura)
          } else if (r < 0.85) this.intentarIntercambio(this.bloques[bi], temperatura)
          else this.intentarTraslado(this.bloques[bi], temperatura)
        }
        this.iteracion++
        if (this.costo < this.mejorCosto - 1e-9) this.guardarMejor()
      }
      if (this.incumplimientos() === 0) {
        if (this.iteracionSinProblemas < 0) this.iteracionSinProblemas = this.iteracion
        // Ya está bien: se sigue un rato más para pulir las preferencias y se termina
        if (this.iteracion - this.iteracionSinProblemas > Math.max(20_000, total * 400)) this.terminado = true
      }
      if (this.iteracion >= this.maxIteraciones) {
        if (this.mejorFoto) this.restaurar(this.mejorFoto)
        if (this.incumplimientos() > 0 && this.recalentamientos < MAX_RECALENTAMIENTOS) {
          this.recalentamientos++
          this.iteracion = Math.floor(this.maxIteraciones * AVANCE_AL_RECALENTAR)
        } else this.terminado = true
      }
    }
    return this.terminado
  }

  // ── Resultado ───────────────────────────────────────────────────────────────────────────────────────

  resultado(): ResultadoGenerador {
    if (this.imposible) {
      return { exito: false, asignaciones: [], cursosArmados: [], problemas: this.problemas, iteraciones: 0 }
    }
    if (this.bloques.length === 0) {
      return { exito: true, asignaciones: [], cursosArmados: [], problemas: this.problemas, iteraciones: 0 }
    }
    if (this.mejorFoto) this.restaurar(this.mejorFoto)
    const problemas = [...this.problemas, ...this.analizarFinal()]
    const asignaciones: AsignacionGenerada[] = []
    for (const b of this.bloques) {
      b.celdas.forEach((dia, i) =>
        dia.forEach((m, p) =>
          asignaciones.push({
            curso_id: b.cursoId,
            materia_id: this.materias[m].id,
            dia: b.dias[i],
            turno: b.turno,
            modulo: p + 1,
            fijo: b.fija[i][p] ? b.fijoGuardado[i][p] : false,
          }),
        ),
      )
    }
    return {
      exito: !problemas.some((p) => p.gravedad === 'error'),
      asignaciones,
      cursosArmados: this.cursosArmados,
      problemas,
      iteraciones: this.iteracion,
    }
  }

  /** Lo que quedó sin cumplir en el mejor horario encontrado, explicado para quien lo arma. */
  private analizarFinal(): ProblemaGenerador[] {
    const problemas: ProblemaGenerador[] = []
    const ocupantes = new Map<string, string[]>()
    const agregar = (slot: number, docente: number, quien: string) => {
      const clave = `${slot}|${docente}`
      ocupantes.set(clave, [...(ocupantes.get(clave) ?? []), quien])
    }
    for (const o of this.obstaculos) agregar(o.slot, o.docente, o.cursoNombre)
    for (const b of this.bloques) {
      const turno = TURNO_INDICE[b.turno]
      b.celdas.forEach((dia, i) =>
        dia.forEach((m, p) => {
          const materia = this.materias[m]
          if (!materia.carga) return
          const quien = materia.agrup >= 0 ? this.agrups[materia.agrup].nombre : b.cursoNombre
          for (const docente of materia.docentes) agregar(claveSlot(turno, b.dias[i], p + 1), docente, quien)
        }),
      )
    }
    const donde = (slot: number) => `el ${diaEnTexto(diaDeSlot(slot))}, módulo ${slot % 100}`
    for (const [clave, quienes] of ocupantes) {
      const [slot, docente] = clave.split('|').map(Number)
      if (quienes.length > 1) problemas.push({ gravedad: 'error', mensaje: `${this.docentesNombre[docente]} queda en ${quienes.join(' y ')} ${donde(slot)}.` })
      const permitido = this.permitido[docente]
      if (permitido && !permitido.has(slot)) {
        problemas.push({ gravedad: 'error', mensaje: `${this.docentesNombre[docente]} queda ${donde(slot)} (${quienes.join(', ')}) fuera de su disponibilidad.` })
      }
    }
    for (const b of this.bloques) {
      b.celdas.forEach((dia, i) => {
        const cuenta = new Map<number, number>()
        for (const m of dia) cuenta.set(m, (cuenta.get(m) ?? 0) + 1)
        for (const [m, n] of cuenta) {
          if (n > this.maxMateria) {
            problemas.push({ gravedad: 'aviso', mensaje: `${this.materias[m].nombre} (${b.cursoNombre}) tiene ${n} módulos el ${diaEnTexto(b.dias[i])} y el máximo es ${this.maxMateria}.` })
          }
        }
        const sueltas = new Set(tramos(dia).filter((t) => this.materias[t.m].bloque && t.n % 2 === 1).map((t) => t.m))
        for (const m of sueltas) {
          problemas.push({ gravedad: 'aviso', mensaje: `${this.materias[m].nombre} (${b.cursoNombre}) queda con un módulo suelto el ${diaEnTexto(b.dias[i])}: se dicta en bloques de dos.` })
        }
      })
    }
    if (this.sinHuecos) {
      const libresPorDocente = new Map<number, number>()
      const vistos = new Set<string>()
      for (const [slot, m] of this.ocupacion) {
        for (const docente of m.keys()) {
          const turno = turnoDeSlot(slot)
          const dia = diaDeSlot(slot)
          const clave = `${docente}|${turno}|${dia}`
          if (vistos.has(clave)) continue
          vistos.add(clave)
          const libres = this.huecos(docente, turno, dia)
          if (libres > 0) libresPorDocente.set(docente, (libresPorDocente.get(docente) ?? 0) + libres)
        }
      }
      for (const [docente, libres] of libresPorDocente) {
        problemas.push({ gravedad: 'aviso', mensaje: `${this.docentesNombre[docente]} queda con ${libres} ${libres === 1 ? 'módulo libre' : 'módulos libres'} entre sus clases.` })
      }
    }
    return problemas
  }
}

const MAX_INTENTOS = 3

const cantidadDeErrores = (r: ResultadoGenerador) => r.problemas.filter((p) => p.gravedad === 'error').length

/**
 * Prueba con otra semilla si la búsqueda no logra un horario sin superposiciones: una mala partida no significa que sea
 * imposible. Se queda con el mejor resultado de los intentos.
 */
export class GeneradorConIntentos {
  private readonly entrada: EntradaGenerador
  private readonly opciones: OpcionesGenerador
  private actual: GeneradorHorario
  private intento = 0
  private mejor: ResultadoGenerador | null = null
  private iteraciones = 0
  private terminado = false

  constructor(entrada: EntradaGenerador, opciones: OpcionesGenerador = {}) {
    this.entrada = entrada
    this.opciones = opciones
    this.actual = new GeneradorHorario(entrada, opciones)
  }

  get progreso(): number {
    return this.terminado ? 1 : Math.min(0.99, (this.intento + this.actual.progreso) / MAX_INTENTOS)
  }

  /** Avanza durante unos milisegundos. Devuelve true cuando terminó. */
  avanzar(milisegundos: number): boolean {
    if (this.terminado) return true
    if (!this.actual.avanzar(milisegundos)) return false
    const resultado = this.actual.resultado()
    this.iteraciones += resultado.iteraciones
    if (!this.mejor || cantidadDeErrores(resultado) < cantidadDeErrores(this.mejor)) this.mejor = resultado
    // Sin nada que intentar (datos imposibles) o ya resuelto: no tiene sentido repetir
    const sinIntento = resultado.asignaciones.length === 0
    if (resultado.exito || sinIntento || this.intento + 1 >= MAX_INTENTOS) this.terminado = true
    else {
      this.intento++
      this.actual = new GeneradorHorario(this.entrada, { ...this.opciones, semilla: (this.opciones.semilla ?? 1) + 7919 * this.intento })
    }
    return this.terminado
  }

  resultado(): ResultadoGenerador {
    return { ...(this.mejor ?? this.actual.resultado()), iteraciones: this.iteraciones }
  }
}

/** Arma el horario de una sola vez (sin dejar respirar a la pantalla): para pruebas y casos chicos. */
export function generarHorario(entrada: EntradaGenerador, opciones: OpcionesGenerador = {}): ResultadoGenerador {
  const generador = new GeneradorConIntentos(entrada, opciones)
  while (!generador.avanzar(1000)) {
    // sigue hasta terminar
  }
  return generador.resultado()
}
