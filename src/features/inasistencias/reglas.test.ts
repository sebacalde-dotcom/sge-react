import { describe, expect, it } from 'vitest'
import { descripcionRegla } from './reglas'

describe('descripcionRegla', () => {
  it('sin opciones dice la cantidad y el período', () => {
    expect(descripcionRegla({ limite: 10, periodo: 'bimestre' })).toBe('10 inasistencias en el bimestre')
    expect(descripcionRegla({ limite: 28, periodo: 'ciclo' })).toBe('28 inasistencias en el ciclo lectivo')
  })

  it('"supera" dice "más de" y "solo injustificadas" lo aclara', () => {
    expect(descripcionRegla({ limite: 5, periodo: 'bimestre', comparacion: 'supera', cuenta: 'injustificadas' })).toBe(
      'más de 5 inasistencias injustificadas en el bimestre',
    )
    expect(descripcionRegla({ limite: 10, periodo: 'mes', comparacion: 'alcanza', cuenta: 'todas' })).toBe(
      '10 inasistencias en el mes',
    )
  })

  it('las fracciones se muestran sin ceros de más', () => {
    expect(descripcionRegla({ limite: 2.5, periodo: 'mes' })).toBe('2.5 inasistencias en el mes')
  })
})
