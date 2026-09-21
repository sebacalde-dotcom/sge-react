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
  personal_id: string | null
  /** En qué turno se dicta. Sin dato, el del curso; en un curso de doble turno hay que indicarlo. */
  turno: Turno | null
  /** Se dicta en bloques de dos módulos seguidos. */
  bloque_doble: boolean
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
  disponibilidad: (personalId: string) => Franja[]
  nombreDocente: (personalId: string) => string
  reglas: ReglasHorario
  /** El horario que ya está guardado, de todos los cursos. */
  existente: CeldaExistente[]
  /** Los cursos cuyo horario se arma. El de los demás se respeta tal como está. */
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
  docente: number
  /** Se dicta de a dos módulos seguidos. */
  bloque: boolean
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

/**
 * Arma el horario de los cursos con una búsqueda por recocido simulado: empieza con las materias repartidas al azar y va
 * intercambiando módulos y moviendo días más largos o más cortos hasta que no queden superposiciones de docentes ni
 * módulos fuera de su disponibilidad, cuidando además las reglas del director. Los días de un curso siempre se llenan
 * desde el primer módulo, así que nunca quedan huecos.
 */
export class GeneradorHorario {
  private readonly entrada: EntradaGenerador
  private readonly azar: () => number
  private readonly problemas: ProblemaGenerador[] = []
  private readonly materias: MateriaInterna[] = []
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
    return this.terminado ? 1 : Math.min(0.99, this.iteracion / this.maxIteraciones)
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

    for (const turno of TURNOS) {
      for (const d of DIAS_SEMANA) this.capacidadSlot.set(claveSlot(TURNO_INDICE[turno], d.n, 0), modulosDelDia(grilla, turno, d.n).length)
    }

    const aArmar = new Set(entrada.cursosAArmar)
    const cursos = entrada.cursos.filter((c) => aArmar.has(c.id))

    // Lo que ocupan los cursos que no se arman: son obstáculos fijos para los docentes
    const materiaPorId = new Map(entrada.materias.map((m) => [m.id, m]))
    const nombreCurso = new Map(entrada.cursos.map((c) => [c.id, c.nombre]))
    for (const c of entrada.existente) {
      if (aArmar.has(c.curso_id)) continue
      const docente = docenteDe(materiaPorId.get(c.materia_id)?.personal_id ?? null)
      if (docente < 0) continue
      const slot = claveSlot(TURNO_INDICE[c.turno], c.dia, c.modulo)
      this.ocupar(slot, docente, 1)
      this.obstaculos.push({ slot, docente, cursoNombre: nombreCurso.get(c.curso_id) ?? 'otro curso' })
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

    for (const { curso, turno, materias } of armables.values()) {
      const dias: number[] = DIAS_SEMANA.filter((d) => modulosDelDia(grilla, turno, d.n).length > 0).map((d) => d.n)
      const etiqueta = `${curso.nombre} (${turno === 'manana' ? 'mañana' : 'tarde'})`
      if (dias.length === 0) {
        error(`No hay espacios cargados para ${NOMBRE_TURNO[turno]}: cargalos en Ciclo Lectivo → Horario.`)
        continue
      }
      const capacidad = dias.map((d) => modulosDelDia(grilla, turno, d).length)

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
        indiceMateria.set(m.id, this.materias.length)
        this.materias.push({ id: m.id, nombre: m.nombre, docente: docenteDe(m.personal_id), bloque })
      }

      // Los módulos ya cargados que se conservan
      const fijadas: { dia: number; modulo: number; materia: number; fijo: boolean }[] = []
      const fijadasPorMateria = new Map<number, number>()
      for (const c of respetadas.filter((x) => x.curso_id === curso.id && x.turno === turno)) {
        const materia = indiceMateria.get(c.materia_id)
        const i = dias.indexOf(c.dia)
        if (materia === undefined || i < 0 || c.modulo > capacidad[i] || fijadas.some((f) => f.dia === c.dia && f.modulo === c.modulo)) {
          descartadas++
          continue
        }
        fijadas.push({ dia: c.dia, modulo: c.modulo, materia, fijo: c.fijo })
        fijadasPorMateria.set(materia, (fijadasPorMateria.get(materia) ?? 0) + 1)
      }

      // Cuántos módulos hay que ubicar de cada materia (si se fijaron de más, se respeta lo fijado)
      const horasPorMateria = new Map<number, number>()
      for (const { m, horas } of materias) {
        const i = indiceMateria.get(m.id)!
        const fijadasDeLaMateria = fijadasPorMateria.get(i) ?? 0
        if (fijadasDeLaMateria > horas) aviso(`${m.nombre} (${curso.nombre}) tiene fijados ${fijadasDeLaMateria} módulos y sus horas semanales son ${horas}.`)
        horasPorMateria.set(i, Math.max(horas, fijadasDeLaMateria))
        if (horas > this.maxMateria * dias.length) {
          error(`${m.nombre} (${curso.nombre}) tiene ${horas} módulos y con un máximo de ${this.maxMateria} por día no entran en los ${dias.length} días de clase.`)
        }
      }

      const total = [...horasPorMateria.values()].reduce((suma, h) => suma + h, 0)
      const minimo = reglas.minModulosPorDia?.[turno] ?? 0
      const maximoRegla = reglas.maxModulosPorDia?.[turno] ?? Infinity
      const inferior = dias.map((d, i) =>
        Math.max(capacidad[i] >= minimo ? minimo : 0, ...fijadas.filter((f) => f.dia === d).map((f) => f.modulo)),
      )
      const superior = capacidad.map((c, i) => Math.max(Math.min(c, maximoRegla), inferior[i]))
      const sumaInferior = inferior.reduce((a, b) => a + b, 0)
      const sumaSuperior = superior.reduce((a, b) => a + b, 0)

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
      const largo = [...inferior]
      let faltan = total - sumaInferior
      while (faltan > 0) {
        const orden = dias.map((_, i) => i).sort((a, b) => largo[a] - largo[b] || capacidad[b] - capacidad[a])
        for (const i of orden) {
          if (faltan > 0 && largo[i] < superior[i]) {
            largo[i]++
            faltan--
          }
        }
      }

      // Los módulos que faltan ubicar, mezclados
      const pendientes: number[] = []
      for (const [i, horas] of horasPorMateria) {
        for (let k = 0; k < horas - (fijadasPorMateria.get(i) ?? 0); k++) pendientes.push(i)
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
          const fijada = fijadas.find((f) => f.dia === d && f.modulo === p + 1)
          celdas[i].push(fijada ? fijada.materia : pendientes.pop()!)
          fija[i].push(!!fijada)
          fijoGuardado[i].push(fijada?.fijo ?? false)
        }
      })
      this.bloques.push({ cursoId: curso.id, cursoNombre: curso.nombre, turno, dias, minimo: inferior, maximo: superior, largo, celdas, fija, fijoGuardado })
      if (!this.cursosArmados.includes(curso.id)) this.cursosArmados.push(curso.id)
    }
    if (descartadas > 0) {
      aviso(`${descartadas} ${descartadas === 1 ? 'módulo cargado ya no es válido' : 'módulos cargados ya no son válidos'} (materia o espacio que no existen) y se quitan.`)
    }

    // Un docente no puede dar más módulos de los espacios en los que puede, descontando lo que ya ocupa afuera
    const necesidad = new Map<string, number>()
    for (const b of this.bloques) {
      for (const dia of b.celdas) {
        for (const m of dia) {
          const docente = this.materias[m].docente
          if (docente < 0) continue
          const clave = `${docente}|${TURNO_INDICE[b.turno]}`
          necesidad.set(clave, (necesidad.get(clave) ?? 0) + 1)
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
    return fatal
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

  private armarEstadoInicial() {
    for (const b of this.bloques) {
      const turno = TURNO_INDICE[b.turno]
      b.celdas.forEach((dia, i) => dia.forEach((m, p) => this.ocupar(claveSlot(turno, b.dias[i], p + 1), this.materias[m].docente, 1)))
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
          const docente = this.materias[m].docente
          if (docente < 0) return
          const slot = claveSlot(turno, b.dias[d], p + 1)
          const permitido = this.permitido[docente]
          if ((this.ocupacion.get(slot)?.get(docente) ?? 0) > 1 || (permitido && !permitido.has(slot))) this.conflictivas.push({ b: bi, d, p })
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
    if (m1 === m2) return
    const s1 = claveSlot(turno, b.dias[d1], p1 + 1)
    const s2 = claveSlot(turno, b.dias[d2], p2 + 1)
    const dm1 = this.materias[m1].docente
    const dm2 = this.materias[m2].docente
    const dias = [d1, d2]
    const slots = [s1, s2]
    const docentesDia: DocenteDia[] = [
      { docente: dm1, turno, dia: b.dias[d1] },
      { docente: dm1, turno, dia: b.dias[d2] },
      { docente: dm2, turno, dia: b.dias[d1] },
      { docente: dm2, turno, dia: b.dias[d2] },
    ]
    const antes = this.costoLocal(b, dias, slots, docentesDia, false)
    b.celdas[d1][p1] = m2
    b.celdas[d2][p2] = m1
    this.ocupar(s1, dm1, -1)
    this.ocupar(s2, dm2, -1)
    this.ocupar(s1, dm2, 1)
    this.ocupar(s2, dm1, 1)
    const delta = this.costoLocal(b, dias, slots, docentesDia, false) - antes
    if (delta <= 0 || this.azar() < Math.exp(-delta / temperatura)) {
      this.costo += delta
      return
    }
    b.celdas[d1][p1] = m1
    b.celdas[d2][p2] = m2
    this.ocupar(s1, dm2, -1)
    this.ocupar(s2, dm1, -1)
    this.ocupar(s1, dm1, 1)
    this.ocupar(s2, dm2, 1)
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
    const docente = this.materias[m].docente
    const origen = claveSlot(turno, b.dias[i], ultimo + 1)
    const destino = claveSlot(turno, b.dias[j], b.celdas[j].length + 1)
    const dias = [i, j]
    const slots = [origen, destino]
    const docentesDia: DocenteDia[] = [
      { docente, turno, dia: b.dias[i] },
      { docente, turno, dia: b.dias[j] },
    ]
    const antes = this.costoLocal(b, dias, slots, docentesDia, true)
    const eraFijoGuardado = b.fijoGuardado[i].pop()!
    b.celdas[i].pop()
    b.fija[i].pop()
    b.largo[i]--
    b.celdas[j].push(m)
    b.fija[j].push(false)
    b.fijoGuardado[j].push(false)
    b.largo[j]++
    this.ocupar(origen, docente, -1)
    this.ocupar(destino, docente, 1)
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
    this.ocupar(destino, docente, -1)
    this.ocupar(origen, docente, 1)
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
          this.intentarIntercambio(this.bloques[c.b], temperatura, { d: c.d, p: c.p })
        } else if (this.azar() < 0.85) this.intentarIntercambio(this.bloques[bi], temperatura)
        else this.intentarTraslado(this.bloques[bi], temperatura)
        this.iteracion++
        if (this.costo < this.mejorCosto - 1e-9) this.guardarMejor()
      }
      if (this.incumplimientos() === 0) {
        if (this.iteracionSinProblemas < 0) this.iteracionSinProblemas = this.iteracion
        // Ya está bien: se sigue un rato más para pulir las preferencias y se termina
        if (this.iteracion - this.iteracionSinProblemas > Math.max(20_000, total * 400)) this.terminado = true
      }
      if (this.iteracion >= this.maxIteraciones) this.terminado = true
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
    const agregar = (slot: number, docente: number, curso: string) => {
      const clave = `${slot}|${docente}`
      ocupantes.set(clave, [...(ocupantes.get(clave) ?? []), curso])
    }
    for (const o of this.obstaculos) agregar(o.slot, o.docente, o.cursoNombre)
    for (const b of this.bloques) {
      const turno = TURNO_INDICE[b.turno]
      b.celdas.forEach((dia, i) => dia.forEach((m, p) => agregar(claveSlot(turno, b.dias[i], p + 1), this.materias[m].docente, b.cursoNombre)))
    }
    const donde = (slot: number) => `el ${diaEnTexto(diaDeSlot(slot))}, módulo ${slot % 100}`
    for (const [clave, cursos] of ocupantes) {
      const [slot, docente] = clave.split('|').map(Number)
      if (docente < 0) continue
      if (cursos.length > 1) problemas.push({ gravedad: 'error', mensaje: `${this.docentesNombre[docente]} queda en ${cursos.join(' y ')} ${donde(slot)}.` })
      const permitido = this.permitido[docente]
      if (permitido && !permitido.has(slot)) {
        problemas.push({ gravedad: 'error', mensaje: `${this.docentesNombre[docente]} queda ${donde(slot)} (${cursos.join(', ')}) fuera de su disponibilidad.` })
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

/** Arma el horario de una sola vez (sin dejar respirar a la pantalla): para pruebas y casos chicos. */
export function generarHorario(entrada: EntradaGenerador, opciones: OpcionesGenerador = {}): ResultadoGenerador {
  const generador = new GeneradorHorario(entrada, opciones)
  while (!generador.avanzar(1000)) {
    // sigue hasta terminar
  }
  return generador.resultado()
}
