import { describe, expect, it } from 'vitest'
import { etiquetaCurso, materiasParaAgregar, normalizarNombre, parsearMateriasEnLote, totalHoras } from './materias'

describe('normalizarNombre', () => {
  it('no distingue mayúsculas, acentos ni espacios de más', () => {
    expect(normalizarNombre('  Matemática ')).toBe('matematica')
    expect(normalizarNombre('EDUCACIÓN   FÍSICA')).toBe('educacion fisica')
    expect(normalizarNombre('Educacion Fisica')).toBe(normalizarNombre('educación física'))
  })
})

describe('parsearMateriasEnLote', () => {
  it('una materia por línea, sin horas', () => {
    expect(parsearMateriasEnLote('Matemática\nLengua\n')).toEqual([
      { nombre: 'Matemática', horas_semanales: null },
      { nombre: 'Lengua', horas_semanales: null },
    ])
  })

  it('lee las horas o módulos después de una coma, un punto y coma o un tabulador', () => {
    const texto = 'Matemática, 5\nFísica; 4\nLengua y Literatura\t6\nInglés,2 hs\nArte, 3 módulos'
    expect(parsearMateriasEnLote(texto)).toEqual([
      { nombre: 'Matemática', horas_semanales: 5 },
      { nombre: 'Física', horas_semanales: 4 },
      { nombre: 'Lengua y Literatura', horas_semanales: 6 },
      { nombre: 'Inglés', horas_semanales: 2 },
      { nombre: 'Arte', horas_semanales: 3 },
    ])
  })

  it('acepta decimales con coma o con punto', () => {
    expect(parsearMateriasEnLote('Taller; 2,5\nLaboratorio; 1.5').map((m) => m.horas_semanales)).toEqual([2.5, 1.5])
  })

  it('un número al final sin separador es parte del nombre', () => {
    expect(parsearMateriasEnLote('Matemática 1')).toEqual([{ nombre: 'Matemática 1', horas_semanales: null }])
  })

  it('una coma dentro del nombre no se confunde con las horas', () => {
    expect(parsearMateriasEnLote('Lengua, Literatura')).toEqual([{ nombre: 'Lengua, Literatura', horas_semanales: null }])
    expect(parsearMateriasEnLote('Lengua, Literatura, 4')).toEqual([{ nombre: 'Lengua, Literatura', horas_semanales: 4 }])
  })

  it('ignora las líneas vacías y los saltos de línea de Windows', () => {
    expect(parsearMateriasEnLote('\r\n  \r\nHistoria, 3\r\n\r\n')).toEqual([{ nombre: 'Historia', horas_semanales: 3 }])
    expect(parsearMateriasEnLote('')).toEqual([])
  })
})

describe('materiasParaAgregar', () => {
  const nuevas = [
    { nombre: 'Matemática', horas_semanales: 5 },
    { nombre: 'Lengua', horas_semanales: null },
    { nombre: 'matematica', horas_semanales: 4 },
  ]

  it('no agrega las que el curso ya tiene, aunque cambien los acentos o las mayúsculas', () => {
    const { agregar, repetidas } = materiasParaAgregar([{ nombre: 'MATEMATICA' }], nuevas)
    expect(agregar.map((m) => m.nombre)).toEqual(['Lengua'])
    expect(repetidas.map((m) => m.nombre)).toEqual(['Matemática', 'matematica'])
  })

  it('tampoco agrega dos veces la misma materia dentro de lo que se está cargando', () => {
    const { agregar, repetidas } = materiasParaAgregar([], nuevas)
    expect(agregar.map((m) => m.nombre)).toEqual(['Matemática', 'Lengua'])
    expect(repetidas.map((m) => m.nombre)).toEqual(['matematica'])
  })

  it('conserva los datos extra de cada materia (por ejemplo el docente al copiar)', () => {
    const { agregar } = materiasParaAgregar([], [{ nombre: 'Física', horas_semanales: 4, personal_id: 'abc' }])
    expect(agregar[0].personal_id).toBe('abc')
  })

  it('ignora los nombres vacíos', () => {
    expect(materiasParaAgregar([], [{ nombre: '  ', horas_semanales: null }])).toEqual({ agregar: [], repetidas: [] })
  })
})

describe('totalHoras', () => {
  it('suma las horas de las materias que las tienen', () => {
    expect(totalHoras([{ horas_semanales: 5 }, { horas_semanales: 2.5 }, { horas_semanales: null }, {}])).toBe(7.5)
    expect(totalHoras([])).toBe(0)
  })
})

describe('etiquetaCurso', () => {
  it('incluye la sección y la división cuando existen', () => {
    expect(etiquetaCurso({ nombre: '2° Año', division: 'B', secciones: { nombre: 'Ciclo Básico' } })).toBe('Ciclo Básico · 2° Año B')
    expect(etiquetaCurso({ nombre: '1° Año', division: null, secciones: null })).toBe('1° Año')
  })
})
