import { describe, expect, it } from 'vitest'
import {
  controlHoras,
  generarModulos,
  modulosDelDia,
  modulosPorSemana,
  modulosSemanalesDelCurso,
  parametrosDeModulos,
  turnosDelCurso,
  type GrillaModulos,
} from './grilla'

describe('generarModulos', () => {
  it('arma módulos de una hora seguidos a partir de la hora de inicio', () => {
    expect(generarModulos('07:30', 4)).toEqual([
      { inicio: '07:30', fin: '08:30' },
      { inicio: '08:30', fin: '09:30' },
      { inicio: '09:30', fin: '10:30' },
      { inicio: '10:30', fin: '11:30' },
    ])
  })

  it('admite otra duración y un descanso entre módulos (recreo)', () => {
    expect(generarModulos('08:00', 3, 40, 10)).toEqual([
      { inicio: '08:00', fin: '08:40' },
      { inicio: '08:50', fin: '09:30' },
      { inicio: '09:40', fin: '10:20' },
    ])
  })

  it('pasa correctamente por el cambio de hora', () => {
    expect(generarModulos('12:30', 2)).toEqual([
      { inicio: '12:30', fin: '13:30' },
      { inicio: '13:30', fin: '14:30' },
    ])
  })

  it('con datos inválidos no arma nada', () => {
    expect(generarModulos('', 4)).toEqual([])
    expect(generarModulos('mañana', 4)).toEqual([])
    expect(generarModulos('07:30', 0)).toEqual([])
    expect(generarModulos('07:30', 3, 0)).toEqual([])
  })
})

describe('parametrosDeModulos', () => {
  it('recupera cantidad, hora de inicio, duración y descanso de lo que se armó', () => {
    const modulos = generarModulos('08:00', 3, 40, 10)
    expect(parametrosDeModulos(modulos, '07:30')).toEqual({ cantidad: 3, inicio: '08:00', duracion: 40, descanso: 10 })
  })

  it('un día sin módulos usa la hora de inicio por defecto', () => {
    expect(parametrosDeModulos(undefined, '13:00')).toEqual({ cantidad: 0, inicio: '13:00', duracion: 60, descanso: 0 })
    expect(parametrosDeModulos([], '07:30').inicio).toBe('07:30')
  })

  it('con un solo módulo no hay descanso', () => {
    expect(parametrosDeModulos(generarModulos('09:00', 1), '07:30').descanso).toBe(0)
  })
})

describe('módulos por día y por semana', () => {
  // Mañana con 4 módulos de lunes a miércoles y 5 jueves y viernes; tarde solo lunes y martes
  const grilla: GrillaModulos = {
    manana: {
      '1': generarModulos('07:30', 4),
      '2': generarModulos('07:30', 4),
      '3': generarModulos('07:30', 4),
      '4': generarModulos('07:30', 5),
      '5': generarModulos('07:30', 5),
    },
    tarde: { '1': generarModulos('13:00', 3), '2': generarModulos('13:00', 3) },
  }

  it('cada día puede tener una cantidad distinta de módulos', () => {
    expect(modulosDelDia(grilla, 'manana', 3)).toHaveLength(4)
    expect(modulosDelDia(grilla, 'manana', 4)).toHaveLength(5)
    expect(modulosDelDia(grilla, 'tarde', 5)).toEqual([])
  })

  it('suma los módulos de la semana de un turno', () => {
    expect(modulosPorSemana(grilla, 'manana')).toBe(22)
    expect(modulosPorSemana(grilla, 'tarde')).toBe(6)
  })

  it('sin grilla cargada no hay módulos', () => {
    expect(modulosPorSemana(null, 'manana')).toBe(0)
    expect(modulosDelDia(undefined, 'tarde', 1)).toEqual([])
  })

  it('un curso de doble turno suma los módulos de los dos turnos', () => {
    expect(modulosSemanalesDelCurso('manana', grilla)).toBe(22)
    expect(modulosSemanalesDelCurso('tarde', grilla)).toBe(6)
    expect(modulosSemanalesDelCurso('doble', grilla)).toBe(28)
  })

  it('un curso sin turno no tiene módulos', () => {
    expect(modulosSemanalesDelCurso(null, grilla)).toBe(0)
    expect(modulosSemanalesDelCurso('vespertino', grilla)).toBe(0)
  })
})

describe('turnosDelCurso', () => {
  it('un turno, los dos o ninguno', () => {
    expect(turnosDelCurso('manana')).toEqual(['manana'])
    expect(turnosDelCurso('tarde')).toEqual(['tarde'])
    expect(turnosDelCurso('doble')).toEqual(['manana', 'tarde'])
    expect(turnosDelCurso(undefined)).toEqual([])
  })
})

describe('controlHoras', () => {
  it('coincide cuando las materias suman justo los módulos del curso', () => {
    expect(controlHoras(25, 25)).toEqual({ estado: 'coincide', diferencia: 0 })
  })

  it('faltan horas cuando quedan módulos sin materia, y sobran cuando las materias pasan lo que hay', () => {
    expect(controlHoras(25, 24)).toEqual({ estado: 'faltan', diferencia: 1 })
    expect(controlHoras(25, 27.5)).toEqual({ estado: 'sobran', diferencia: 2.5 })
  })

  it('sin módulos cargados no se puede controlar', () => {
    expect(controlHoras(0, 10)).toEqual({ estado: 'sin_datos', diferencia: 0 })
  })
})
