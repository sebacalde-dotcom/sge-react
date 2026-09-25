import { describe, test, expect } from 'vitest'
import {
  calcularAsistenciaPorMateria,
  materiasEnRiesgo,
  type ModuloHorario,
  type FaltaDiaria,
} from './asistenciaPorMateria'
import type { CalendarioCiclo } from '@/lib/calendario'

const MAT = 'mat-1'
const LEN = 'len-1'
const HIS = 'his-1'

// Semana tipo: Matemática lun+mié+vie (3 módulos), Lengua mar+jue (2 módulos), Historia lun+jue (2 módulos)
const horario: ModuloHorario[] = [
  { materia_id: MAT, dia: 1, turno: 'manana' }, // lunes
  { materia_id: HIS, dia: 1, turno: 'manana' }, // lunes
  { materia_id: LEN, dia: 2, turno: 'manana' }, // martes
  { materia_id: MAT, dia: 3, turno: 'manana' }, // miércoles
  { materia_id: LEN, dia: 4, turno: 'manana' }, // jueves
  { materia_id: HIS, dia: 4, turno: 'manana' }, // jueves
  { materia_id: MAT, dia: 5, turno: 'manana' }, // viernes
]

const calendario: CalendarioCiclo = {
  inicio: '2026-03-01',
  fin: '2026-12-15',
  dias_especiales: null,
}

describe('calcularAsistenciaPorMateria', () => {
  test('sin faltas → 100% en todas las materias', () => {
    // Una semana: 2–6 marzo 2026 (lun a vie)
    const resultado = calcularAsistenciaPorMateria(
      horario, [], calendario,
      '2026-03-02', '2026-03-06', ['manana'],
    )
    expect(resultado).toHaveLength(3)
    for (const r of resultado) {
      expect(r.porcentaje).toBe(100)
      expect(r.modulos_perdidos).toBe(0)
    }
    expect(resultado.find((r) => r.materia_id === MAT)!.modulos_totales).toBe(3)
    expect(resultado.find((r) => r.materia_id === LEN)!.modulos_totales).toBe(2)
    expect(resultado.find((r) => r.materia_id === HIS)!.modulos_totales).toBe(2)
  })

  test('falta un lunes → pierde Matemática e Historia de ese día', () => {
    const faltas: FaltaDiaria[] = [
      { fecha: '2026-03-02', turno: 'unico', valor: 1, justificada: false },
    ]
    const resultado = calcularAsistenciaPorMateria(
      horario, faltas, calendario,
      '2026-03-02', '2026-03-06', ['manana'],
    )
    const mat = resultado.find((r) => r.materia_id === MAT)!
    expect(mat.modulos_totales).toBe(3)
    expect(mat.modulos_perdidos).toBe(1)
    expect(mat.porcentaje).toBeCloseTo(66.67, 1)

    const his = resultado.find((r) => r.materia_id === HIS)!
    expect(his.modulos_perdidos).toBe(1)
    expect(his.porcentaje).toBe(50)

    const len = resultado.find((r) => r.materia_id === LEN)!
    expect(len.modulos_perdidos).toBe(0)
    expect(len.porcentaje).toBe(100)
  })

  test('fines de semana no cuentan', () => {
    // Incluir sábado y domingo (7 y 8 de marzo 2026)
    const resultado = calcularAsistenciaPorMateria(
      horario, [], calendario,
      '2026-03-02', '2026-03-08', ['manana'],
    )
    // Mismos módulos que lun-vie
    expect(resultado.find((r) => r.materia_id === MAT)!.modulos_totales).toBe(3)
  })

  test('feriado no cuenta como día cursable', () => {
    const calConFeriado: CalendarioCiclo = {
      ...calendario,
      dias_especiales: {
        '2026-03-02': { tipo: 'feriado', descripcion: 'Día de prueba' },
      },
    }
    const resultado = calcularAsistenciaPorMateria(
      horario, [], calConFeriado,
      '2026-03-02', '2026-03-06', ['manana'],
    )
    // Lunes no cuenta: Mate tiene 2 módulos (mié+vie) en vez de 3
    expect(resultado.find((r) => r.materia_id === MAT)!.modulos_totales).toBe(2)
    // Historia solo tenía lun+jue, con feriado el lunes queda 1
    expect(resultado.find((r) => r.materia_id === HIS)!.modulos_totales).toBe(1)
  })

  test('doble turno: falta solo en un turno no afecta el otro', () => {
    const horarioDT: ModuloHorario[] = [
      { materia_id: MAT, dia: 1, turno: 'manana' },
      { materia_id: LEN, dia: 1, turno: 'tarde' },
    ]
    const faltas: FaltaDiaria[] = [
      { fecha: '2026-03-02', turno: 'manana', valor: 0.5, justificada: false },
    ]
    const resultado = calcularAsistenciaPorMateria(
      horarioDT, faltas, calendario,
      '2026-03-02', '2026-03-02', ['manana', 'tarde'],
    )
    expect(resultado.find((r) => r.materia_id === MAT)!.modulos_perdidos).toBe(1)
    expect(resultado.find((r) => r.materia_id === LEN)!.modulos_perdidos).toBe(0)
  })

  test('dos semanas con faltas acumuladas', () => {
    const faltas: FaltaDiaria[] = [
      { fecha: '2026-03-02', turno: 'unico', valor: 1, justificada: false }, // lunes sem 1
      { fecha: '2026-03-09', turno: 'unico', valor: 1, justificada: false }, // lunes sem 2
      { fecha: '2026-03-10', turno: 'unico', valor: 1, justificada: false }, // martes sem 2
    ]
    const resultado = calcularAsistenciaPorMateria(
      horario, faltas, calendario,
      '2026-03-02', '2026-03-13', ['manana'],
    )
    const mat = resultado.find((r) => r.materia_id === MAT)!
    expect(mat.modulos_totales).toBe(6) // 3 por semana × 2
    expect(mat.modulos_perdidos).toBe(2) // 2 lunes
    expect(mat.porcentaje).toBeCloseTo(66.67, 1)

    const len = resultado.find((r) => r.materia_id === LEN)!
    expect(len.modulos_totales).toBe(4) // 2 por semana × 2
    expect(len.modulos_perdidos).toBe(1) // 1 martes
    expect(len.porcentaje).toBe(75)
  })

  test('horario vacío devuelve array vacío', () => {
    const resultado = calcularAsistenciaPorMateria(
      [], [], calendario, '2026-03-02', '2026-03-06', ['manana'],
    )
    expect(resultado).toEqual([])
  })

  test('resultado ordenado por porcentaje ascendente', () => {
    const faltas: FaltaDiaria[] = [
      { fecha: '2026-03-02', turno: 'unico', valor: 1, justificada: false }, // lunes: pierde Mat+His
      { fecha: '2026-03-03', turno: 'unico', valor: 1, justificada: false }, // martes: pierde Len
      { fecha: '2026-03-04', turno: 'unico', valor: 1, justificada: false }, // miércoles: pierde Mat
      { fecha: '2026-03-05', turno: 'unico', valor: 1, justificada: false }, // jueves: pierde Len+His
    ]
    const resultado = calcularAsistenciaPorMateria(
      horario, faltas, calendario,
      '2026-03-02', '2026-03-06', ['manana'],
    )
    // His: 2 totales, 2 perdidos = 0%
    // Len: 2 totales, 2 perdidos = 0%
    // Mat: 3 totales, 2 perdidos = 33.33%
    expect(resultado[0].porcentaje).toBeLessThanOrEqual(resultado[1].porcentaje)
    expect(resultado[1].porcentaje).toBeLessThanOrEqual(resultado[2].porcentaje)
  })
})

describe('materiasEnRiesgo', () => {
  test('filtra materias bajo el 75%', () => {
    const faltas: FaltaDiaria[] = [
      { fecha: '2026-03-02', turno: 'unico', valor: 1, justificada: false },
      { fecha: '2026-03-09', turno: 'unico', valor: 1, justificada: false },
    ]
    const asistencia = calcularAsistenciaPorMateria(
      horario, faltas, calendario,
      '2026-03-02', '2026-03-13', ['manana'],
    )
    const enRiesgo = materiasEnRiesgo(asistencia, 75)
    // Mate: 6 totales, 2 perdidos = 66.67% → en riesgo
    // His: 4 totales, 2 perdidos = 50% → en riesgo
    // Len: 4 totales, 0 perdidos = 100% → OK
    expect(enRiesgo.some((r) => r.materia_id === MAT)).toBe(true)
    expect(enRiesgo.some((r) => r.materia_id === HIS)).toBe(true)
    expect(enRiesgo.some((r) => r.materia_id === LEN)).toBe(false)
  })

  test('umbral personalizado', () => {
    const asistencia = calcularAsistenciaPorMateria(
      horario, [], calendario,
      '2026-03-02', '2026-03-06', ['manana'],
    )
    expect(materiasEnRiesgo(asistencia, 100)).toEqual([])
    expect(materiasEnRiesgo(asistencia, 101)).toHaveLength(3)
  })
})
