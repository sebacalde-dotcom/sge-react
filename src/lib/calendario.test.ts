import { describe, expect, it } from 'vitest'
import { diaInfo, toISODate, type CalendarioCiclo } from './calendario'

// 2026-09-19 es sábado, 09-20 domingo y 09-21 lunes
const calendario: CalendarioCiclo = {
  inicio: '2026-03-02',
  fin: '2026-12-18',
  dias_especiales: {
    '2026-09-21': { tipo: 'feriado', descripcion: 'Feriado puente' },
    '2026-09-22': { tipo: 'asueto', descripcion: '' },
    '2026-09-19': { tipo: 'cursable', descripcion: 'Recuperatorio' },
    '2026-02-14': { tipo: 'cursable', descripcion: 'Antes del ciclo' },
  },
}

describe('toISODate', () => {
  it('completa con ceros el mes y el día', () => {
    expect(toISODate(2026, 3, 5)).toBe('2026-03-05')
    expect(toISODate(2026, 12, 31)).toBe('2026-12-31')
  })
})

describe('diaInfo', () => {
  it('un día hábil común es cursable', () => {
    expect(diaInfo(calendario, 2026, 9, 23)).toEqual({ cursable: true, especial: null, motivo: null })
  })

  it('sábados y domingos no son cursables', () => {
    expect(diaInfo(calendario, 2026, 9, 26)).toMatchObject({ cursable: false, motivo: 'Fin de semana' })
    expect(diaInfo(calendario, 2026, 9, 20)).toMatchObject({ cursable: false, motivo: 'Fin de semana' })
  })

  it('un feriado en día hábil no es cursable y muestra el motivo', () => {
    const info = diaInfo(calendario, 2026, 9, 21)
    expect(info.cursable).toBe(false)
    expect(info.motivo).toBe('Feriado: Feriado puente')
  })

  it('un día especial sin descripción muestra solo el tipo', () => {
    expect(diaInfo(calendario, 2026, 9, 22).motivo).toBe('Asueto')
  })

  it('un día cursable extra habilita un sábado', () => {
    const info = diaInfo(calendario, 2026, 9, 19)
    expect(info.cursable).toBe(true)
    expect(info.motivo).toBe('Día cursable (extra): Recuperatorio')
  })

  it('fuera de las fechas del ciclo nunca es cursable, ni siquiera con un día cursable extra', () => {
    expect(diaInfo(calendario, 2026, 2, 14)).toMatchObject({ cursable: false, motivo: 'Fuera del ciclo lectivo' })
    expect(diaInfo(calendario, 2026, 12, 21)).toMatchObject({ cursable: false, motivo: 'Fuera del ciclo lectivo' })
  })

  it('los límites del ciclo (primer y último día) sí están dentro', () => {
    expect(diaInfo(calendario, 2026, 3, 2).cursable).toBe(true) // lunes
    expect(diaInfo(calendario, 2026, 12, 18).cursable).toBe(true) // viernes
  })

  it('sin calendario cargado solo se distingue el fin de semana', () => {
    expect(diaInfo(null, 2026, 9, 23).cursable).toBe(true)
    expect(diaInfo(null, 2026, 9, 20).cursable).toBe(false)
  })
})
