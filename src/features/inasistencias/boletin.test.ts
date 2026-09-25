import { describe, expect, test } from 'vitest'
import { cuatrimestresDelCiclo, extracto, resumenPorCuatrimestre, type FaltaBoletin } from './boletin'
import type { FechasCiclo } from './notificaciones/periodos'

const ciclo: FechasCiclo = {
  anio: 2026,
  inicio: '2026-03-02',
  fin: '2026-12-18',
  c1_desde: '2026-03-02',
  c1_hasta: '2026-07-10',
  c2_desde: '2026-07-27',
  c2_hasta: '2026-12-04',
}

const f = (fecha: string, valor: number, justificada = false, turno = 'unico', tipo = 'Ausente'): FaltaBoletin => ({
  fecha,
  turno,
  tipo,
  valor,
  justificada,
})

const faltas = [
  f('2026-04-10', 1),
  f('2026-03-15', 1, true),
  f('2026-05-02', 0.25, false, 'unico', 'Llegada tarde'),
  f('2026-08-03', 1),
  f('2026-09-01', 1, true),
]

describe('cuatrimestresDelCiclo', () => {
  test('usa las fechas cargadas en el ciclo', () => {
    expect(cuatrimestresDelCiclo(ciclo)).toEqual([
      { numero: 1, nombre: '1° cuatrimestre', desde: '2026-03-02', hasta: '2026-07-10' },
      { numero: 2, nombre: '2° cuatrimestre', desde: '2026-07-27', hasta: '2026-12-04' },
    ])
  })

  test('sin fechas, bloques de 4 meses desde el inicio y hasta el fin del ciclo', () => {
    const c = cuatrimestresDelCiclo({ ...ciclo, c1_desde: null, c1_hasta: null, c2_desde: null, c2_hasta: null })
    expect(c.map((x) => [x.desde, x.hasta])).toEqual([
      ['2026-03-01', '2026-06-30'],
      ['2026-07-01', '2026-10-31'],
    ])
  })
})

describe('resumenPorCuatrimestre', () => {
  test('justificadas, injustificadas, total y acumulado de cada cuatrimestre', () => {
    const r = resumenPorCuatrimestre(faltas, ciclo)
    expect(r.map(({ justificadas, injustificadas, total, acumulado }) => ({ justificadas, injustificadas, total, acumulado }))).toEqual([
      { justificadas: 1, injustificadas: 1.25, total: 2.25, acumulado: 2.25 },
      { justificadas: 1, injustificadas: 1, total: 2, acumulado: 4.25 },
    ])
  })

  test('una falta del receso de invierno va al 2° cuatrimestre', () => {
    const r = resumenPorCuatrimestre([f('2026-07-20', 1)], ciclo)
    expect(r[1].total).toBe(1)
  })
})

describe('extracto', () => {
  test('ordena por fecha y acumula como un resumen de cuenta', () => {
    const e = extracto(faltas, ciclo)
    expect(e.movimientos.map((m) => [m.fecha, m.acumulado])).toEqual([
      ['2026-03-15', 1],
      ['2026-04-10', 2],
      ['2026-05-02', 2.25],
      ['2026-08-03', 3.25],
      ['2026-09-01', 4.25],
    ])
    expect(e.anterior).toBe(0)
    expect(e.total).toBe(4.25)
  })

  test('con un cuatrimestre elegido arranca desde el saldo anterior', () => {
    const e = extracto(faltas, ciclo, 'todas', 2)
    expect(e.anterior).toBe(2.25)
    expect(e.movimientos.map((m) => m.acumulado)).toEqual([3.25, 4.25])
  })

  test('el filtro de justificación también se aplica al acumulado', () => {
    const e = extracto(faltas, ciclo, 'injustificadas')
    expect(e.movimientos.map((m) => m.acumulado)).toEqual([1, 1.25, 2.25])
    const j = extracto(faltas, ciclo, 'justificadas', 2)
    expect(j.anterior).toBe(1)
    expect(j.movimientos.map((m) => m.acumulado)).toEqual([2])
  })

  test('en doble turno, mañana antes que tarde el mismo día', () => {
    const e = extracto([f('2026-04-10', 0.5, false, 'tarde'), f('2026-04-10', 0.5, false, 'manana')], ciclo)
    expect(e.movimientos.map((m) => m.turno)).toEqual(['manana', 'tarde'])
  })
})
