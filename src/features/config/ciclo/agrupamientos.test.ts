import { describe, expect, it } from 'vitest'
import {
  agrupamientosSinCoincidir,
  docentesDeMateria,
  docentesDelAgrupamiento,
  grupoDelAlumno,
  indicePorMateria,
  unidadDeMateria,
  validarAgrupamiento,
  vigenteEn,
  type Agrupamiento,
  type MateriaDeAgrupamiento,
} from './agrupamientos'

const ingles: Agrupamiento = {
  id: 'ag1',
  nombre: 'Inglés',
  materias: ['i1', 'i2', 'i3'],
  grupos: [
    { id: 'a1', nombre: 'A1', personal_id: 'p1' },
    { id: 'a2', nombre: 'A2', personal_id: 'p2' },
  ],
}

const curso = (id: string) => `Curso ${id}`
const docente = (id: string) => `Docente ${id}`
const materia = (id: string, curso_id: string, horas: number | null = 3, turno: 'manana' | 'tarde' | null = 'tarde'): MateriaDeAgrupamiento => ({
  id,
  curso_id,
  nombre: 'Inglés',
  horas_semanales: horas,
  turno,
})

describe('docentes de una materia', () => {
  const porMateria = indicePorMateria([ingles])

  it('una materia de un agrupamiento la dictan los docentes de sus grupos', () => {
    expect(docentesDeMateria({ id: 'i1', personal_id: 'otro' }, porMateria)).toEqual(['p1', 'p2'])
    expect(docentesDelAgrupamiento(ingles)).toEqual(['p1', 'p2'])
  })

  it('una materia común la dicta su docente, si lo tiene', () => {
    expect(docentesDeMateria({ id: 'm9', personal_id: 'p7' }, porMateria)).toEqual(['p7'])
    expect(docentesDeMateria({ id: 'm9', personal_id: null }, porMateria)).toEqual([])
  })

  it('no repite un docente que está en dos grupos', () => {
    const repetido: Agrupamiento = { ...ingles, grupos: [ingles.grupos[0], { id: 'a3', nombre: 'A3', personal_id: 'p1' }] }
    expect(docentesDelAgrupamiento(repetido)).toEqual(['p1'])
  })

  it('las materias de un agrupamiento forman una sola clase y las demás son de su curso', () => {
    expect(unidadDeMateria({ id: 'i1', curso_id: 'c1' }, porMateria)).toBe('ag:ag1')
    expect(unidadDeMateria({ id: 'i3', curso_id: 'c3' }, porMateria)).toBe('ag:ag1')
    expect(unidadDeMateria({ id: 'm9', curso_id: 'c1' }, porMateria)).toBe('curso:c1')
  })
})

describe('validarAgrupamiento', () => {
  const materias = [materia('i1', 'c1'), materia('i2', 'c2'), materia('i3', 'c3')]

  it('un agrupamiento bien armado no tiene problemas', () => {
    expect(validarAgrupamiento(ingles, materias, curso, docente)).toEqual([])
  })

  it('avisa si no tiene materias ni grupos', () => {
    const vacio: Agrupamiento = { id: 'x', nombre: 'Vacío', materias: [], grupos: [] }
    const mensajes = validarAgrupamiento(vacio, [], curso, docente).map((p) => p.mensaje)
    expect(mensajes).toContain('Todavía no tiene materias.')
    expect(mensajes).toContain('Todavía no tiene grupos.')
  })

  it('las materias se dictan a la vez: tienen que tener las mismas horas', () => {
    const distintas = [materia('i1', 'c1', 3), materia('i2', 'c2', 4), materia('i3', 'c3', 3)]
    const problemas = validarAgrupamiento(ingles, distintas, curso, docente)
    expect(problemas).toHaveLength(1)
    expect(problemas[0].gravedad).toBe('error')
    expect(problemas[0].mensaje).toContain('mismas horas')
    expect(problemas[0].mensaje).toContain('Curso c2: 4')
  })

  it('las materias tienen que ser del mismo turno', () => {
    const problemas = validarAgrupamiento(ingles, [materia('i1', 'c1'), materia('i2', 'c2', 3, 'manana'), materia('i3', 'c3')], curso, docente)
    expect(problemas.some((p) => p.gravedad === 'error' && p.mensaje.includes('turnos distintos'))).toBe(true)
  })

  it('una sola materia por curso', () => {
    const problemas = validarAgrupamiento(ingles, [materia('i1', 'c1'), materia('i2', 'c1'), materia('i3', 'c3')], curso, docente)
    expect(problemas.some((p) => p.gravedad === 'error' && p.mensaje.includes('una por curso'))).toBe(true)
  })

  it('un docente no puede estar en dos grupos que se dictan a la vez', () => {
    const repetido: Agrupamiento = { ...ingles, grupos: [ingles.grupos[0], { id: 'a2', nombre: 'A2', personal_id: 'p1' }] }
    const problemas = validarAgrupamiento(repetido, materias, curso, docente)
    expect(problemas).toEqual([{ gravedad: 'error', mensaje: 'Docente p1 está en los grupos A1 y A2, que se dictan a la vez.' }])
  })

  it('avisa de los grupos sin docente', () => {
    const sinDocente: Agrupamiento = { ...ingles, grupos: [ingles.grupos[0], { id: 'a2', nombre: 'A2', personal_id: null }] }
    const problemas = validarAgrupamiento(sinDocente, materias, curso, docente)
    expect(problemas).toEqual([{ gravedad: 'aviso', mensaje: 'El grupo A2 no tiene docente: no se pueden controlar sus superposiciones.' }])
  })

  it('una sola materia de un curso dividida en grupos es válida', () => {
    const arte: Agrupamiento = {
      id: 'ag2',
      nombre: 'Arte',
      materias: ['ar1'],
      grupos: [
        { id: 'g1', nombre: 'Música', personal_id: 'p3' },
        { id: 'g2', nombre: 'Dibujo', personal_id: 'p4' },
      ],
    }
    expect(validarAgrupamiento(arte, [materia('ar1', 'c4', 2, 'manana')], curso, docente)).toEqual([])
  })
})

describe('períodos de los alumnos en los grupos', () => {
  const membresias = [
    { grupo_id: 'a1', persona_id: 'alu1', desde: '2026-03-01', hasta: '2026-06-30' },
    { grupo_id: 'a2', persona_id: 'alu1', desde: '2026-07-01', hasta: null },
    { grupo_id: 'a1', persona_id: 'alu2', desde: '2026-03-01', hasta: null },
  ]

  it('vigenteEn incluye los dos extremos del período', () => {
    expect(vigenteEn(membresias[0], '2026-03-01')).toBe(true)
    expect(vigenteEn(membresias[0], '2026-06-30')).toBe(true)
    expect(vigenteEn(membresias[0], '2026-07-01')).toBe(false)
    expect(vigenteEn(membresias[0], '2026-02-28')).toBe(false)
    expect(vigenteEn(membresias[1], '2027-01-01')).toBe(true)
  })

  it('un alumno que cambió de nivel está en el grupo que corresponde a cada fecha', () => {
    expect(grupoDelAlumno(membresias, 'alu1', '2026-05-10')).toBe('a1')
    expect(grupoDelAlumno(membresias, 'alu1', '2026-09-10')).toBe('a2')
    expect(grupoDelAlumno(membresias, 'alu2', '2026-09-10')).toBe('a1')
  })

  it('un alumno sin grupo en esa fecha devuelve null', () => {
    expect(grupoDelAlumno(membresias, 'alu1', '2026-01-10')).toBeNull()
    expect(grupoDelAlumno(membresias, 'otro', '2026-05-10')).toBeNull()
  })
})

describe('agrupamientosSinCoincidir', () => {
  const etiqueta = (id: string) => ({ i1: '1°A', i2: '2°A', i3: '3°A' })[id] ?? id
  const c = (materia_id: string, dia: number, modulo: number) => ({ materia_id, turno: 'tarde' as const, dia, modulo })

  it('no dice nada si todas coinciden o si todavía no hay nada cargado', () => {
    const iguales = ['i1', 'i2', 'i3'].flatMap((m) => [c(m, 1, 1), c(m, 4, 1)])
    expect(agrupamientosSinCoincidir([ingles], iguales, etiqueta)).toEqual([])
    expect(agrupamientosSinCoincidir([ingles], [], etiqueta)).toEqual([])
  })

  it('avisa en qué módulos y en qué curso no coincide', () => {
    const colocaciones = [c('i1', 1, 1), c('i2', 1, 1), c('i3', 1, 2)]
    const [problema] = agrupamientosSinCoincidir([ingles], colocaciones, etiqueta)
    expect(problema.agrupamiento_id).toBe('ag1')
    expect(problema.mensaje).toContain('no coincide')
    expect(problema.mensaje).toContain('el lunes, módulo 1, falta en 3°A')
    expect(problema.mensaje).toContain('el lunes, módulo 2, falta en 1°A y 2°A')
  })

  it('un curso que todavía no cargó su horario también es una diferencia', () => {
    const [problema] = agrupamientosSinCoincidir([ingles], [c('i1', 1, 1), c('i2', 1, 1)], etiqueta)
    expect(problema.mensaje).toContain('falta en 3°A')
  })

  it('un agrupamiento de una sola materia no tiene con quién coincidir', () => {
    const solo: Agrupamiento = { ...ingles, id: 'ag9', materias: ['i1'] }
    expect(agrupamientosSinCoincidir([solo], [c('i1', 1, 1)], etiqueta)).toEqual([])
  })
})
