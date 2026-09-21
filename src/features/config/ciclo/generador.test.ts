import { describe, expect, it } from 'vitest'
import { generarModulos, type GrillaModulos, type Turno } from './grilla'
import type { Franja } from './disponibilidad'
import {
  generarHorario,
  type CeldaExistente,
  type CursoGenerador,
  type EntradaGenerador,
  type MateriaGenerador,
  type ResultadoGenerador,
} from './generador'

const dias = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1))

/** Mañana: 5 días con `manana` módulos desde las 8; tarde: lunes y jueves con `tarde` módulos desde las 14:30. */
function armarGrilla(manana = 5, tarde = 0): GrillaModulos {
  const grilla: GrillaModulos = { manana: {}, tarde: {} }
  for (const d of dias(5)) grilla.manana![d] = generarModulos('08:00', manana)
  if (tarde > 0) for (const d of ['1', '4']) grilla.tarde![d] = generarModulos('14:30', tarde)
  return grilla
}

const curso = (id: string, turno = 'manana'): CursoGenerador => ({ id, nombre: id.toUpperCase(), turno })

let contador = 0
const materia = (curso_id: string, nombre: string, horas: number, personal_id: string | null, extra: Partial<MateriaGenerador> = {}): MateriaGenerador => ({
  id: `m${++contador}`,
  curso_id,
  nombre,
  horas_semanales: horas,
  personal_id,
  turno: null,
  bloque_doble: false,
  ...extra,
})

function entrada(parcial: Partial<EntradaGenerador> & Pick<EntradaGenerador, 'cursos' | 'materias'>): EntradaGenerador {
  return {
    grilla: armarGrilla(),
    disponibilidad: () => [],
    nombreDocente: (id) => `Docente ${id}`,
    reglas: {},
    existente: [],
    cursosAArmar: parcial.cursos.map((c) => c.id),
    modo: 'completar',
    ...parcial,
  }
}

/** Todo lo que un horario bien armado tiene que cumplir. */
function verificar(res: ResultadoGenerador, e: EntradaGenerador) {
  const materiaPorId = new Map(e.materias.map((m) => [m.id, m]))
  // Cada materia con sus horas
  for (const m of e.materias.filter((x) => e.cursosAArmar.includes(x.curso_id))) {
    expect(res.asignaciones.filter((a) => a.materia_id === m.id), `horas de ${m.nombre}`).toHaveLength(m.horas_semanales ?? 0)
  }
  // Un solo módulo por espacio de cada curso y sin huecos: los días se llenan desde el primer módulo
  const porCurso = new Map<string, number[]>()
  for (const a of res.asignaciones) {
    const clave = `${a.curso_id}|${a.turno}|${a.dia}`
    porCurso.set(clave, [...(porCurso.get(clave) ?? []), a.modulo])
  }
  for (const [clave, modulos] of porCurso) {
    expect([...modulos].sort((a, b) => a - b), clave).toEqual(modulos.map((_, i) => i + 1))
  }
  // Ningún docente en dos lugares a la vez ni fuera de su disponibilidad
  const ocupados = new Set<string>()
  const cargar = (c: CeldaExistente | { curso_id: string; materia_id: string; dia: number; turno: Turno; modulo: number }) => {
    const docente = materiaPorId.get(c.materia_id)?.personal_id
    if (!docente) return
    const clave = `${docente}|${c.turno}|${c.dia}|${c.modulo}`
    expect(ocupados.has(clave), `superposición ${clave}`).toBe(false)
    ocupados.add(clave)
  }
  for (const a of res.asignaciones) cargar(a)
  for (const x of e.existente.filter((c) => !e.cursosAArmar.includes(c.curso_id))) cargar(x)
}

describe('generarHorario', () => {
  it('arma el horario de un curso con todas sus horas y sin huecos', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Matemática', 5, 'd1'),
      materia('1a', 'Lengua', 5, 'd2'),
      materia('1a', 'Historia', 5, 'd3'),
      materia('1a', 'Biología', 5, 'd4'),
      materia('1a', 'Educación Física', 5, 'd5'),
    ]
    const e = entrada({ cursos, materias })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    expect(res.asignaciones).toHaveLength(25)
    verificar(res, e)
  })

  it('un docente que da clase en dos cursos no se superpone', () => {
    const cursos = [curso('1a'), curso('1b')]
    const materias = [
      materia('1a', 'Matemática', 8, 'd1'),
      materia('1a', 'Lengua', 8, 'd2'),
      materia('1a', 'Historia', 9, 'd3'),
      materia('1b', 'Matemática', 8, 'd1'),
      materia('1b', 'Lengua', 8, 'd4'),
      materia('1b', 'Historia', 9, 'd3'),
    ]
    const e = entrada({ cursos, materias })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    verificar(res, e)
  })

  it('respeta la disponibilidad horaria del docente', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Matemática', 3, 'd1'),
      materia('1a', 'Lengua', 5, 'd2'),
      materia('1a', 'Historia', 5, 'd3'),
      materia('1a', 'Biología', 5, 'd4'),
      materia('1a', 'Educación Física', 4, 'd5'),
      materia('1a', 'Inglés', 3, 'd6'),
    ]
    const franjas: Franja[] = [
      { dia: 2, desde: '08:00', hasta: '10:00' },
      { dia: 4, desde: '09:00', hasta: '10:00' },
    ]
    const e = entrada({ cursos, materias, disponibilidad: (id) => (id === 'd1' ? franjas : []) })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    const matematica = res.asignaciones.filter((a) => a.materia_id === materias[0].id)
    const lugares = matematica.map((a) => `${a.dia}:${a.modulo}`).sort()
    expect(lugares).toEqual(['2:1', '2:2', '4:2'])
  })

  it('explica cuando un docente no tiene lugar para todas sus horas', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Matemática', 6, 'd1'),
      materia('1a', 'Lengua', 7, 'd2'),
      materia('1a', 'Historia', 6, 'd3'),
      materia('1a', 'Biología', 6, 'd4'),
    ]
    const franjas: Franja[] = [{ dia: 1, desde: '08:00', hasta: '11:00' }]
    const e = entrada({ cursos, materias, disponibilidad: (id) => (id === 'd1' ? franjas : []) })
    const res = generarHorario(e)
    expect(res.exito).toBe(false)
    expect(res.asignaciones).toHaveLength(0)
    expect(res.problemas.some((p) => p.gravedad === 'error' && p.mensaje.includes('Docente d1') && p.mensaje.includes('6 módulos') && p.mensaje.includes('3 espacios'))).toBe(true)
  })

  it('explica cuando las materias no entran en los espacios del turno', () => {
    const cursos = [curso('1a')]
    const materias = ['Matemática', 'Lengua', 'Historia', 'Biología', 'Inglés'].map((n, i) => materia('1a', n, 6, `d${i}`))
    const res = generarHorario(entrada({ cursos, materias }))
    expect(res.exito).toBe(false)
    expect(res.problemas[0].mensaje).toContain('30 módulos')
    expect(res.problemas[0].mensaje).toContain('25 espacios')
  })

  it('explica cuando el máximo por día no deja lugar', () => {
    const cursos = [curso('1a')]
    const materias = ['Matemática', 'Lengua', 'Historia', 'Biología', 'Inglés'].map((n, i) => materia('1a', n, 5, `d${i}`))
    const res = generarHorario(entrada({ cursos, materias, grilla: armarGrilla(6), reglas: { maxModulosPorDia: { manana: 4 } } }))
    expect(res.exito).toBe(false)
    expect(res.problemas.some((p) => p.mensaje.includes('máximo de 4 módulos por día'))).toBe(true)
  })

  it('cumple el mínimo y el máximo de módulos por día del turno', () => {
    const cursos = [curso('1a'), curso('1b')]
    const materias = [
      materia('1a', 'Matemática', 6, 'd1'),
      materia('1a', 'Lengua', 6, 'd2'),
      materia('1a', 'Historia', 5, 'd3'),
      materia('1a', 'Biología', 5, 'd4'),
      materia('1b', 'Matemática', 6, 'd1'),
      materia('1b', 'Lengua', 6, 'd2'),
      materia('1b', 'Historia', 5, 'd3'),
      materia('1b', 'Biología', 5, 'd4'),
    ]
    const e = entrada({ cursos, materias, grilla: armarGrilla(6), reglas: { minModulosPorDia: { manana: 4 }, maxModulosPorDia: { manana: 5 } } })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    verificar(res, e)
    for (const c of ['1a', '1b']) {
      for (let d = 1; d <= 5; d++) {
        const n = res.asignaciones.filter((a) => a.curso_id === c && a.dia === d).length
        expect(n, `${c} día ${d}`).toBeGreaterThanOrEqual(4)
        expect(n, `${c} día ${d}`).toBeLessThanOrEqual(5)
      }
    }
  })

  it('no pone más módulos de una materia por día que el máximo', () => {
    const cursos = [curso('1a')]
    const materias = ['Matemática', 'Lengua', 'Historia', 'Biología', 'Inglés'].map((n, i) => materia('1a', n, 5, `d${i}`))
    const e = entrada({ cursos, materias, reglas: { maxModulosMateriaPorDia: 1 } })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    for (const m of materias) {
      for (let d = 1; d <= 5; d++) {
        expect(res.asignaciones.filter((a) => a.materia_id === m.id && a.dia === d).length).toBeLessThanOrEqual(1)
      }
    }
    expect(res.problemas.filter((p) => p.gravedad === 'error')).toHaveLength(0)
  })

  it('avisa si una materia no entra con el máximo por día', () => {
    const cursos = [curso('1a')]
    const materias = [materia('1a', 'Matemática', 7, 'd1')]
    const res = generarHorario(entrada({ cursos, materias, reglas: { maxModulosMateriaPorDia: 1 } }))
    expect(res.exito).toBe(false)
    expect(res.problemas.some((p) => p.mensaje.includes('no entran en los 5 días'))).toBe(true)
  })

  it('ubica las materias en bloque doble de a dos módulos seguidos', () => {
    const cursos = [curso('1a'), curso('1b')]
    const materias = [
      materia('1a', 'Taller', 4, 'd1', { bloque_doble: true }),
      materia('1a', 'Lengua', 7, 'd2'),
      materia('1a', 'Historia', 7, 'd3'),
      materia('1a', 'Biología', 7, 'd4'),
      materia('1b', 'Taller', 2, 'd1', { bloque_doble: true }),
      materia('1b', 'Lengua', 8, 'd5'),
      materia('1b', 'Historia', 8, 'd3'),
      materia('1b', 'Biología', 7, 'd6'),
    ]
    const e = entrada({ cursos, materias })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    verificar(res, e)
    for (const taller of [materias[0], materias[4]]) {
      const porDia = new Map<number, number[]>()
      for (const a of res.asignaciones.filter((x) => x.materia_id === taller.id)) porDia.set(a.dia, [...(porDia.get(a.dia) ?? []), a.modulo])
      for (const [dia, modulos] of porDia) {
        const ordenados = modulos.sort((a, b) => a - b)
        expect(ordenados.length % 2, `día ${dia}`).toBe(0)
        for (let i = 0; i < ordenados.length; i += 2) expect(ordenados[i + 1] - ordenados[i]).toBe(1)
      }
    }
    expect(res.problemas.filter((p) => p.mensaje.includes('suelto'))).toHaveLength(0)
  })

  it('una materia en bloque con horas impares se ubica módulo a módulo y avisa', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Taller', 3, 'd1', { bloque_doble: true }),
      materia('1a', 'Lengua', 8, 'd2'),
      materia('1a', 'Historia', 7, 'd3'),
      materia('1a', 'Biología', 7, 'd4'),
    ]
    const res = generarHorario(entrada({ cursos, materias }))
    expect(res.exito).toBe(true)
    expect(res.problemas.some((p) => p.gravedad === 'aviso' && p.mensaje.includes('número impar'))).toBe(true)
  })

  it('los cursos que no se arman ocupan a sus docentes', () => {
    const cursos = [curso('1a'), curso('1b')]
    const materias = [
      materia('1a', 'Matemática', 5, 'd1'),
      materia('1a', 'Lengua', 8, 'd2'),
      materia('1a', 'Historia', 6, 'd3'),
      materia('1a', 'Biología', 6, 'd4'),
      materia('1b', 'Matemática', 5, 'd1'),
    ]
    const ocupadoEnOtroCurso: CeldaExistente[] = [1, 2, 3, 4, 5].map((dia) => ({
      curso_id: '1b',
      materia_id: materias[4].id,
      dia,
      turno: 'manana',
      modulo: 1,
      fijo: true,
    }))
    const e = entrada({ cursos, materias, cursosAArmar: ['1a'], existente: ocupadoEnOtroCurso })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    expect(res.cursosArmados).toEqual(['1a'])
    verificar(res, e)
    expect(res.asignaciones.filter((a) => a.materia_id === materias[0].id).every((a) => a.modulo !== 1)).toBe(true)
  })

  it('en "completar" respeta todo lo cargado y en "rearmar" solo lo fijo', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Matemática', 5, 'd1'),
      materia('1a', 'Lengua', 7, 'd2'),
      materia('1a', 'Historia', 7, 'd3'),
      materia('1a', 'Biología', 6, 'd4'),
    ]
    const existente: CeldaExistente[] = [
      { curso_id: '1a', materia_id: materias[0].id, dia: 3, turno: 'manana', modulo: 2, fijo: true },
      { curso_id: '1a', materia_id: materias[0].id, dia: 5, turno: 'manana', modulo: 1, fijo: false },
    ]
    const completar = generarHorario(entrada({ cursos, materias, existente, modo: 'completar' }))
    expect(completar.exito).toBe(true)
    const matematica = (r: ResultadoGenerador) => r.asignaciones.filter((a) => a.materia_id === materias[0].id)
    expect(matematica(completar).find((a) => a.dia === 3 && a.modulo === 2)?.fijo).toBe(true)
    expect(matematica(completar).find((a) => a.dia === 5 && a.modulo === 1)?.fijo).toBe(false)
    expect(matematica(completar)).toHaveLength(5)

    // En "rearmar" lo no fijo se vuelve a ubicar, pero lo fijo sigue donde estaba (con o sin candado)
    for (const semilla of [1, 2, 3]) {
      const rearmar = generarHorario(entrada({ cursos, materias, existente, modo: 'rearmar' }), { semilla })
      expect(rearmar.exito).toBe(true)
      expect(matematica(rearmar).find((a) => a.dia === 3 && a.modulo === 2)?.fijo).toBe(true)
      expect(matematica(rearmar)).toHaveLength(5)
    }
  })

  it('una materia fijada de más se respeta y avisa', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Matemática', 1, 'd1'),
      materia('1a', 'Lengua', 8, 'd2'),
      materia('1a', 'Historia', 8, 'd3'),
      materia('1a', 'Biología', 7, 'd4'),
    ]
    const existente: CeldaExistente[] = [
      { curso_id: '1a', materia_id: materias[0].id, dia: 1, turno: 'manana', modulo: 1, fijo: true },
      { curso_id: '1a', materia_id: materias[0].id, dia: 2, turno: 'manana', modulo: 1, fijo: true },
    ]
    const res = generarHorario(entrada({ cursos, materias, existente }))
    expect(res.problemas.some((p) => p.gravedad === 'aviso' && p.mensaje.includes('fijados 2'))).toBe(true)
    expect(res.asignaciones.filter((a) => a.materia_id === materias[0].id)).toHaveLength(2)
  })

  it('un módulo fijado más abajo deja los de arriba llenos', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Matemática', 5, 'd1'),
      materia('1a', 'Lengua', 7, 'd2'),
      materia('1a', 'Historia', 7, 'd3'),
      materia('1a', 'Biología', 6, 'd4'),
    ]
    const existente: CeldaExistente[] = [{ curso_id: '1a', materia_id: materias[0].id, dia: 2, turno: 'manana', modulo: 5, fijo: true }]
    const e = entrada({ cursos, materias, existente })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    verificar(res, e)
    expect(res.asignaciones.filter((a) => a.dia === 2)).toHaveLength(5)
  })

  it('si lo fijado deja a un docente en dos lugares lo informa', () => {
    const cursos = [curso('1a'), curso('1b')]
    const materias = [materia('1a', 'Matemática', 3, 'd1'), materia('1b', 'Matemática', 3, 'd1')]
    const existente: CeldaExistente[] = [
      { curso_id: '1a', materia_id: materias[0].id, dia: 1, turno: 'manana', modulo: 1, fijo: true },
      { curso_id: '1b', materia_id: materias[1].id, dia: 1, turno: 'manana', modulo: 1, fijo: true },
    ]
    const res = generarHorario(entrada({ cursos, materias, existente }))
    expect(res.exito).toBe(false)
    expect(res.problemas.some((p) => p.gravedad === 'error' && p.mensaje.includes('Docente d1 queda en 1A y 1B el lunes, módulo 1'))).toBe(true)
  })

  it('cada materia va al turno que indica en un curso de doble turno', () => {
    const cursos = [curso('4a', 'doble')]
    const grilla = armarGrilla(4, 3)
    const materias = [
      materia('4a', 'Matemática', 10, 'd1', { turno: 'manana' }),
      materia('4a', 'Lengua', 10, 'd2', { turno: 'manana' }),
      materia('4a', 'Inglés', 3, 'd3', { turno: 'tarde' }),
      materia('4a', 'Educación Física', 3, 'd4', { turno: 'tarde' }),
    ]
    const e = entrada({ cursos, materias, grilla })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    verificar(res, e)
    for (const a of res.asignaciones) {
      const esperado = a.materia_id === materias[2].id || a.materia_id === materias[3].id ? 'tarde' : 'manana'
      expect(a.turno).toBe(esperado)
    }
  })

  it('pide indicar el turno de las materias de un curso de doble turno', () => {
    const cursos = [curso('4a', 'doble')]
    const res = generarHorario(entrada({ cursos, materias: [materia('4a', 'Matemática', 4, 'd1')], grilla: armarGrilla(4, 3) }))
    expect(res.exito).toBe(false)
    expect(res.problemas[0].mensaje).toContain('doble turno')
  })

  it('avisa de los cursos sin turno y de las materias sin horas', () => {
    const cursos = [{ id: 'x', nombre: 'X', turno: null }, curso('1a')]
    const materias = [
      ...['Matemática', 'Lengua', 'Historia', 'Biología', 'Inglés'].map((n, i) => materia('1a', n, 5, `d${i}`)),
      materia('1a', 'Música', 0, 'd9'),
      materia('1a', 'Arte', 1.5, 'd9'),
    ]
    const res = generarHorario(entrada({ cursos, materias }))
    expect(res.exito).toBe(false)
    expect(res.problemas.some((p) => p.mensaje.includes('X no tiene turno'))).toBe(true)
    expect(res.problemas.some((p) => p.gravedad === 'aviso' && p.mensaje.includes('Música'))).toBe(true)
    expect(res.problemas.some((p) => p.gravedad === 'aviso' && p.mensaje.includes('Arte'))).toBe(true)
  })

  it('con la misma semilla da el mismo horario', () => {
    const cursos = [curso('1a'), curso('1b')]
    const materias = [
      materia('1a', 'Matemática', 10, 'd1'),
      materia('1a', 'Lengua', 8, 'd2'),
      materia('1a', 'Historia', 7, 'd3'),
      materia('1b', 'Matemática', 10, 'd1'),
      materia('1b', 'Lengua', 8, 'd2'),
      materia('1b', 'Historia', 7, 'd4'),
    ]
    const uno = generarHorario(entrada({ cursos, materias }), { semilla: 7 })
    const dos = generarHorario(entrada({ cursos, materias }), { semilla: 7 })
    expect(dos.asignaciones).toEqual(uno.asignaciones)
  })

  it('una materia sin docente se ubica igual', () => {
    const cursos = [curso('1a')]
    const materias = [
      materia('1a', 'Tutoría', 5, null),
      materia('1a', 'Matemática', 8, 'd1'),
      materia('1a', 'Lengua', 6, 'd2'),
      materia('1a', 'Historia', 6, 'd3'),
    ]
    const e = entrada({ cursos, materias })
    const res = generarHorario(e)
    expect(res.exito).toBe(true)
    verificar(res, e)
  })

  it('no hay nada para armar si el curso no tiene materias', () => {
    const res = generarHorario(entrada({ cursos: [curso('1a')], materias: [] }))
    expect(res.exito).toBe(true)
    expect(res.asignaciones).toHaveLength(0)
  })

  it('un colegio entero: 6 cursos con docentes compartidos y disponibilidades', () => {
    const nombres = ['1A', '1B', '2A', '2B', '3A', '3B']
    const cursos = nombres.map((n) => curso(n.toLowerCase()))
    const asignaturas = ['Matemática', 'Lengua', 'Historia', 'Biología', 'Inglés']
    const materias: MateriaGenerador[] = []
    // Cada asignatura la dan dos docentes: uno los cursos A y otro los B
    for (const c of cursos) {
      asignaturas.forEach((a, i) => materias.push(materia(c.id, a, 5, `${c.id.endsWith('a') ? 'a' : 'b'}${i}`)))
    }
    // Tres docentes solo pueden algunos días
    const restringidas: Record<string, Franja[]> = {
      a0: [1, 2, 3, 4].map((dia) => ({ dia, desde: '08:00', hasta: '13:00' })),
      b2: [2, 3, 4, 5].map((dia) => ({ dia, desde: '08:00', hasta: '13:00' })),
      a4: [1, 3, 5].map((dia) => ({ dia, desde: '08:00', hasta: '13:00' })),
    }
    const e = entrada({ cursos, materias, disponibilidad: (id) => restringidas[id] ?? [] })
    const res = generarHorario(e, { semilla: 3 })
    expect(res.problemas.filter((p) => p.gravedad === 'error')).toEqual([])
    expect(res.exito).toBe(true)
    verificar(res, e)
    // Los docentes con disponibilidad reducida solo aparecen en sus días
    for (const [docente, franjas] of Object.entries(restringidas)) {
      const permitidos = new Set(franjas.map((f) => f.dia))
      const suyas = new Set(materias.filter((m) => m.personal_id === docente).map((m) => m.id))
      for (const a of res.asignaciones.filter((x) => suyas.has(x.materia_id))) expect(permitidos.has(a.dia), `${docente} día ${a.dia}`).toBe(true)
    }
  })
})

describe('generarHorario con agrupamientos', () => {
  /** Inglés en 1°, 2° y 3° dividido en dos niveles, a la tarde: lunes y jueves. */
  function colegioConIngles(extra: { horasIngles?: number[]; nombresCursos?: string[] } = {}) {
    const ids = extra.nombresCursos ?? ['1a', '2a', '3a']
    const grilla = armarGrilla(5, 4)
    const cursos = ids.map((id) => curso(id, 'doble'))
    const materias: MateriaGenerador[] = []
    ids.forEach((id, i) => {
      // Mañana: 5 materias de 5 módulos; tarde: Inglés y Educación Física
      ;['Matemática', 'Lengua', 'Historia', 'Biología', 'Geografía'].forEach((n, k) => materias.push(materia(id, n, 5, `m${i}${k}`, { turno: 'manana' })))
      materias.push(materia(id, 'Inglés', extra.horasIngles?.[i] ?? 2, null, { turno: 'tarde' }))
      materias.push(materia(id, 'Educación Física', 2, `ef${i}`, { turno: 'tarde' }))
    })
    const ingles = materias.filter((m) => m.nombre === 'Inglés')
    const agrupamientos = [{ id: 'ag-ingles', nombre: 'Inglés', materias: ingles.map((m) => m.id), docentes: ['prof-a1', 'prof-a2'] }]
    return { cursos, materias, agrupamientos, ingles, grilla }
  }

  const lugares = (res: ResultadoGenerador, materiaId: string) =>
    res.asignaciones
      .filter((a) => a.materia_id === materiaId)
      .map((a) => `${a.turno}:${a.dia}:${a.modulo}`)
      .sort()

  it('las materias de un agrupamiento van en los mismos módulos en todos los cursos', () => {
    const { cursos, materias, agrupamientos, ingles, grilla } = colegioConIngles()
    const e = entrada({ cursos, materias, agrupamientos, grilla })
    const res = generarHorario(e, { semilla: 5 })
    expect(res.problemas.filter((p) => p.gravedad === 'error')).toEqual([])
    expect(res.exito).toBe(true)
    const [uno, dos, tres] = ingles.map((m) => lugares(res, m.id))
    expect(uno).toHaveLength(2)
    expect(dos).toEqual(uno)
    expect(tres).toEqual(uno)
  })

  it('los docentes de los grupos no chocan con sus otras clases', () => {
    const { cursos, materias, agrupamientos, grilla } = colegioConIngles()
    // El profesor del grupo A1 también da Educación Física en 1° a la tarde: no puede coincidir con Inglés
    const ef1 = materias.find((m) => m.curso_id === '1a' && m.nombre === 'Educación Física')!
    ef1.personal_id = 'prof-a1'
    const e = entrada({ cursos, materias, agrupamientos, grilla })
    const res = generarHorario(e, { semilla: 2 })
    expect(res.exito).toBe(true)
    const ingles = new Set(materias.filter((m) => m.nombre === 'Inglés').flatMap((m) => lugares(res, m.id)))
    for (const lugar of lugares(res, ef1.id)) expect(ingles.has(lugar), `Educación Física en ${lugar}`).toBe(false)
  })

  it('un docente de un grupo respeta su disponibilidad en todos los cursos', () => {
    const { cursos, materias, agrupamientos, ingles, grilla } = colegioConIngles()
    // Solo puede los jueves a la tarde: el Inglés de todos los cursos tiene que estar ahí
    const franjas: Franja[] = [{ dia: 4, desde: '14:30', hasta: '18:30' }]
    const e = entrada({ cursos, materias, agrupamientos, grilla, disponibilidad: (id) => (id === 'prof-a2' ? franjas : []) })
    const res = generarHorario(e, { semilla: 4 })
    expect(res.exito).toBe(true)
    for (const m of ingles) for (const lugar of lugares(res, m.id)) expect(lugar.startsWith('tarde:4:')).toBe(true)
  })

  it('lo fijado en un curso vale para todos los del agrupamiento', () => {
    const { cursos, materias, agrupamientos, ingles, grilla } = colegioConIngles()
    const existente: CeldaExistente[] = [{ curso_id: '2a', materia_id: ingles[1].id, dia: 4, turno: 'tarde', modulo: 2, fijo: true }]
    const res = generarHorario(entrada({ cursos, materias, agrupamientos, grilla, existente }), { semilla: 3 })
    expect(res.exito).toBe(true)
    for (const m of ingles) expect(lugares(res, m.id)).toContain('tarde:4:2')
    // Lo que se puso a mano queda fijo y lo derivado no
    const delFijo = res.asignaciones.filter((a) => a.materia_id === ingles[1].id && a.dia === 4 && a.modulo === 2)
    expect(delFijo[0].fijo).toBe(true)
    expect(res.asignaciones.find((a) => a.materia_id === ingles[0].id && a.dia === 4 && a.modulo === 2)?.fijo).toBe(false)
  })

  it('si se arma un solo curso se arman también los que comparten el agrupamiento', () => {
    const { cursos, materias, agrupamientos, ingles, grilla } = colegioConIngles()
    const res = generarHorario(entrada({ cursos, materias, agrupamientos, grilla, cursosAArmar: ['1a'] }), { semilla: 1 })
    expect(res.exito).toBe(true)
    expect([...res.cursosArmados].sort()).toEqual(['1a', '2a', '3a'])
    expect(res.problemas.some((p) => p.gravedad === 'aviso' && p.mensaje.includes('Se arma también 2A y 3A'))).toBe(true)
    expect(lugares(res, ingles[2].id)).toEqual(lugares(res, ingles[0].id))
  })

  it('explica que las materias de un agrupamiento tienen que tener las mismas horas', () => {
    const { cursos, materias, agrupamientos, grilla } = colegioConIngles({ horasIngles: [2, 3, 2] })
    const res = generarHorario(entrada({ cursos, materias, agrupamientos, grilla }))
    expect(res.exito).toBe(false)
    expect(res.asignaciones).toHaveLength(0)
    expect(res.problemas.some((p) => p.gravedad === 'error' && p.mensaje.includes('horas semanales distintas') && p.mensaje.includes('2A: 3'))).toBe(true)
  })

  it('explica cuando lo fijado en dos cursos del agrupamiento no coincide', () => {
    const { cursos, materias, agrupamientos, ingles, grilla } = colegioConIngles()
    const ef2 = materias.find((m) => m.curso_id === '2a' && m.nombre === 'Educación Física')!
    const existente: CeldaExistente[] = [
      { curso_id: '1a', materia_id: ingles[0].id, dia: 1, turno: 'tarde', modulo: 1, fijo: true },
      { curso_id: '2a', materia_id: ef2.id, dia: 1, turno: 'tarde', modulo: 1, fijo: true },
    ]
    const res = generarHorario(entrada({ cursos, materias, agrupamientos, grilla, existente }))
    expect(res.exito).toBe(false)
    expect(res.problemas.some((p) => p.gravedad === 'error' && p.mensaje.includes('tiene otra materia fijada'))).toBe(true)
  })

  it('una materia de un curso dividida en grupos ocupa a los docentes de todos los grupos', () => {
    const cursos = [curso('4a')]
    const materias = [
      materia('4a', 'Arte', 2, null),
      materia('4a', 'Matemática', 5, 'mat'),
      materia('4a', 'Lengua', 6, 'len'),
      materia('4a', 'Historia', 6, 'his'),
      materia('4a', 'Biología', 6, 'bio'),
    ]
    const agrupamientos = [{ id: 'ag-arte', nombre: 'Arte', materias: [materias[0].id], docentes: ['musica', 'dibujo'] }]
    // Los dos docentes de Arte solo pueden a primera hora: Arte tiene que caer ahí
    const primera: Franja[] = [1, 2, 3, 4, 5].map((dia) => ({ dia, desde: '08:00', hasta: '09:00' }))
    const e = entrada({ cursos, materias, agrupamientos, disponibilidad: (id) => (id === 'musica' || id === 'dibujo' ? primera : []) })
    const res = generarHorario(e, { semilla: 6 })
    expect(res.exito).toBe(true)
    expect(res.asignaciones.filter((a) => a.materia_id === materias[0].id).every((a) => a.modulo === 1)).toBe(true)
  })

  it('explica cuando un docente de un grupo no tiene lugar para el agrupamiento', () => {
    const { cursos, materias, agrupamientos, grilla } = colegioConIngles()
    const franjas: Franja[] = [{ dia: 1, desde: '14:30', hasta: '15:30' }]
    const res = generarHorario(entrada({ cursos, materias, agrupamientos, grilla, disponibilidad: (id) => (id === 'prof-a1' ? franjas : []) }))
    expect(res.exito).toBe(false)
    expect(res.problemas.some((p) => p.mensaje.includes('prof-a1') && p.mensaje.includes('2 módulos') && p.mensaje.includes('1 espacios'))).toBe(true)
  })

  it('un colegio con dos agrupamientos de Inglés (1° a 3° y 4° a 6°) a la tarde', () => {
    const ids = ['1a', '2a', '3a', '4a', '5a', '6a']
    const grilla = armarGrilla(5, 3)
    const cursos = ids.map((id) => curso(id, 'doble'))
    const materias: MateriaGenerador[] = []
    ids.forEach((id, i) => {
      ;['Matemática', 'Lengua', 'Historia', 'Biología', 'Geografía'].forEach((n, k) => materias.push(materia(id, n, 5, `d${k}-${i % 3}`, { turno: 'manana' })))
      materias.push(materia(id, 'Inglés', 3, null, { turno: 'tarde' }))
      materias.push(materia(id, 'Educación Física', 2, `ef${i}`, { turno: 'tarde' }))
    })
    const ingles = materias.filter((m) => m.nombre === 'Inglés')
    const agrupamientos = [
      { id: 'ag1', nombre: 'Inglés (1° a 3°)', materias: ingles.slice(0, 3).map((m) => m.id), docentes: ['i1', 'i2'] },
      { id: 'ag2', nombre: 'Inglés (4° a 6°)', materias: ingles.slice(3).map((m) => m.id), docentes: ['i3', 'i4'] },
    ]
    const e = entrada({ cursos, materias, agrupamientos, grilla })
    const res = generarHorario(e, { semilla: 8 })
    expect(res.problemas.filter((p) => p.gravedad === 'error')).toEqual([])
    expect(res.exito).toBe(true)
    verificar(res, e)
    for (const grupo of [ingles.slice(0, 3), ingles.slice(3)]) {
      const [primero, ...resto] = grupo.map((m) => lugares(res, m.id))
      for (const otro of resto) expect(otro).toEqual(primero)
    }
  })
})
