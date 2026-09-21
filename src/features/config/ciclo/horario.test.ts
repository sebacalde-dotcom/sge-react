import { describe, expect, it } from 'vitest'
import { generarModulos, type GrillaModulos } from './grilla'
import {
  celdasDelCurso,
  claveCelda,
  desdeClave,
  superposicionesDeDocentes,
  validarHorarioCurso,
  type ColocacionConDocente,
  type MateriaParaHorario,
} from './horario'

// Mañana con 3 módulos de lunes a viernes
const grilla: GrillaModulos = {
  manana: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [String(d), generarModulos('07:30', 3)])),
  tarde: { '1': generarModulos('13:00', 2) },
}

const mat = (id: string, nombre: string, horas: number | null, personal_id: string | null): MateriaParaHorario => ({
  id,
  curso_id: 'A',
  nombre,
  horas_semanales: horas,
  personal_id,
})
const matematica = mat('mate', 'Matemática', 5, 'ana')
const lengua = mat('leng', 'Lengua', 4, 'beto')
const sinDocente = mat('taller', 'Taller', 2, null)

const nombreDocente = (id: string) => ({ ana: 'Ana Ruiz', beto: 'Beto Paz' })[id] ?? id
const valida = (extra: Partial<Parameters<typeof validarHorarioCurso>[0]>) =>
  validarHorarioCurso({
    turnoCurso: 'manana',
    grilla,
    borrador: {},
    materias: [matematica, lengua, sinDocente],
    otras: [],
    nombreDocente,
    ...extra,
  })

describe('claves de módulos', () => {
  it('se arman y se desarman', () => {
    expect(claveCelda('manana', 3, 2)).toBe('manana:3:2')
    expect(desdeClave('tarde:5:1')).toEqual({ turno: 'tarde', dia: 5, modulo: 1 })
  })
})

describe('celdasDelCurso', () => {
  it('un curso de mañana tiene los módulos de la mañana de cada día', () => {
    expect(celdasDelCurso('manana', grilla)).toHaveLength(15)
    expect(celdasDelCurso('manana', grilla)[0]).toEqual({ turno: 'manana', dia: 1, modulo: 1, inicio: '07:30', fin: '08:30' })
  })

  it('un curso de doble turno suma los módulos de los dos turnos', () => {
    expect(celdasDelCurso('doble', grilla)).toHaveLength(17)
  })

  it('un curso sin turno no tiene módulos', () => {
    expect(celdasDelCurso(null, grilla)).toEqual([])
  })
})

describe('validarHorarioCurso: superposición de docentes', () => {
  it('avisa si el docente ya da clase en otro curso a la misma hora', () => {
    const r = valida({
      borrador: { [claveCelda('manana', 2, 1)]: 'mate' },
      otras: [{ curso_id: 'B', curso_nombre: '2° B', materia_id: 'x', personal_id: 'ana', dia: 2, turno: 'manana', modulo: 1 }],
    })
    const superposicion = r.problemas.find((p) => p.tipo === 'superposicion')!
    expect(superposicion.gravedad).toBe('error')
    expect(superposicion.mensaje).toBe('Ana Ruiz también da clase en 2° B el Martes, módulo 1')
    expect(r.porCelda[claveCelda('manana', 2, 1)]).toContain(superposicion)
  })

  it('el mismo módulo de otro turno u otro día no es una superposición', () => {
    const r = valida({
      borrador: { [claveCelda('manana', 2, 1)]: 'mate' },
      otras: [
        { curso_id: 'B', curso_nombre: '2° B', materia_id: 'x', personal_id: 'ana', dia: 2, turno: 'tarde', modulo: 1 },
        { curso_id: 'B', curso_nombre: '2° B', materia_id: 'x', personal_id: 'ana', dia: 3, turno: 'manana', modulo: 1 },
        { curso_id: 'B', curso_nombre: '2° B', materia_id: 'x', personal_id: 'beto', dia: 2, turno: 'manana', modulo: 1 },
      ],
    })
    expect(r.problemas.filter((p) => p.tipo === 'superposicion')).toEqual([])
  })
})

describe('validarHorarioCurso: horas de cada materia', () => {
  const celdasMate = (n: number) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [claveCelda('manana', (i % 5) + 1, i < 5 ? 1 : 2), 'mate']))

  it('una materia con todas sus horas está completa', () => {
    const r = valida({ borrador: celdasMate(5) })
    expect(r.materias.find((m) => m.materia_id === 'mate')).toEqual({ materia_id: 'mate', colocadas: 5, requeridas: 5, estado: 'completa' })
  })

  it('faltan módulos es algo pendiente, no un error', () => {
    const r = valida({ borrador: celdasMate(3) })
    const faltan = r.problemas.find((p) => p.tipo === 'horas_de_menos' && p.mensaje.includes('Matemática'))!
    expect(faltan.gravedad).toBe('pendiente')
    expect(faltan.mensaje).toBe('Faltan 2 módulos de Matemática')
  })

  it('pasarse de las horas es un error y marca los módulos de la materia', () => {
    const r = valida({ borrador: celdasMate(6) })
    const demas = r.problemas.find((p) => p.tipo === 'horas_de_mas')!
    expect(demas.gravedad).toBe('error')
    expect(demas.celdas).toHaveLength(6)
    expect(r.materias.find((m) => m.materia_id === 'mate')?.estado).toBe('sobran')
  })

  it('una materia sin horas semanales cargadas no se puede controlar', () => {
    const r = valida({ materias: [mat('x', 'Historia', null, 'ana')], borrador: { [claveCelda('manana', 1, 1)]: 'x' } })
    expect(r.materias[0].estado).toBe('sin_horas')
    expect(r.problemas.map((p) => p.tipo)).toContain('sin_horas_cargadas')
  })
})

describe('validarHorarioCurso: huecos y módulos sin completar', () => {
  it('un módulo libre entre clases es un hueco', () => {
    const r = valida({ borrador: { [claveCelda('manana', 1, 1)]: 'mate', [claveCelda('manana', 1, 3)]: 'leng' } })
    const hueco = r.problemas.find((p) => p.tipo === 'hueco')!
    expect(hueco.gravedad).toBe('aviso')
    expect(hueco.celdas).toEqual([claveCelda('manana', 1, 2)])
    expect(hueco.mensaje).toBe('El Lunes (mañana) tiene un módulo libre entre clases')
  })

  it('los módulos libres al final del día no son huecos, pero cuentan como sin completar', () => {
    const r = valida({ borrador: { [claveCelda('manana', 1, 1)]: 'mate' } })
    expect(r.problemas.find((p) => p.tipo === 'hueco')).toBeUndefined()
    expect(r.sinCompletar).toBe(14)
  })

  it('con todos los módulos cargados no queda nada por completar', () => {
    const todos = Object.fromEntries(celdasDelCurso('manana', grilla).map((c) => [claveCelda(c.turno, c.dia, c.modulo), 'mate']))
    expect(valida({ borrador: todos }).sinCompletar).toBe(0)
  })
})

describe('validarHorarioCurso: otros avisos', () => {
  it('una materia colocada sin docente avisa que no se pueden controlar sus superposiciones', () => {
    const r = valida({ borrador: { [claveCelda('manana', 1, 1)]: 'taller' } })
    const aviso = r.problemas.find((p) => p.tipo === 'sin_docente')!
    expect(aviso.gravedad).toBe('aviso')
    expect(aviso.mensaje).toContain('Taller')
  })

  it('un módulo que ya no está en la grilla se avisa y no cuenta', () => {
    const r = valida({ borrador: { [claveCelda('manana', 1, 9)]: 'mate' } })
    expect(r.problemas.find((p) => p.tipo === 'fuera_de_grilla')?.mensaje).toContain('1 módulo cargado ya no existe')
    expect(r.materias.find((m) => m.materia_id === 'mate')?.colocadas).toBe(0)
  })

  it('ignora una materia que ya no existe en el curso', () => {
    const r = valida({ borrador: { [claveCelda('manana', 1, 1)]: 'borrada' } })
    expect(r.sinCompletar).toBe(15)
  })

  it('un horario vacío no tiene errores ni avisos, solo lo pendiente', () => {
    const r = valida({})
    expect(r.problemas.filter((p) => p.gravedad !== 'pendiente')).toEqual([])
  })
})

describe('superposicionesDeDocentes', () => {
  const c = (curso_id: string, personal_id: string | null, dia: number, modulo: number): ColocacionConDocente => ({
    curso_id,
    materia_id: 'x',
    personal_id,
    dia,
    turno: 'manana',
    modulo,
  })

  it('detecta al docente que está en dos cursos en el mismo módulo', () => {
    const s = superposicionesDeDocentes([c('A', 'ana', 1, 1), c('B', 'ana', 1, 1), c('C', 'beto', 1, 1)])
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ personal_id: 'ana', dia: 1, modulo: 1 })
    expect(s[0].colocaciones).toHaveLength(2)
  })

  it('no hay superposición si es en módulos distintos o los docentes no están asignados', () => {
    expect(superposicionesDeDocentes([c('A', 'ana', 1, 1), c('B', 'ana', 1, 2), c('A', null, 2, 1), c('B', null, 2, 1)])).toEqual([])
  })

  it('un docente dando dos módulos seguidos en el mismo curso no es una superposición', () => {
    expect(superposicionesDeDocentes([c('A', 'ana', 1, 1), c('A', 'ana', 1, 2)])).toEqual([])
  })
})
