import { describe, expect, it } from 'vitest'
import { cuentaFalta, faltasQueCuentan, superaLimite, valorDeTipo } from './conteo'

describe('superaLimite', () => {
  it('"alcanza" se cumple al llegar al límite y es lo que se asume si no se aclara', () => {
    expect(superaLimite(10, 10, 'alcanza')).toBe(true)
    expect(superaLimite(10, 10)).toBe(true)
    expect(superaLimite(9.75, 10, 'alcanza')).toBe(false)
  })

  it('"supera" se cumple recién al pasar el límite, incluso por un cuarto de falta', () => {
    expect(superaLimite(5, 5, 'supera')).toBe(false)
    expect(superaLimite(5.25, 5, 'supera')).toBe(true)
    expect(superaLimite(6, 5, 'supera')).toBe(true)
  })
})

describe('cuentaFalta y faltasQueCuentan', () => {
  const faltas = [
    { fecha: '2026-03-02', justificada: false },
    { fecha: '2026-03-03', justificada: true },
    { fecha: '2026-03-04' }, // sin dato de justificación: cuenta como injustificada
  ]

  it('por defecto (o con "todas") cuentan todas, también las justificadas', () => {
    expect(faltasQueCuentan(faltas)).toHaveLength(3)
    expect(faltasQueCuentan(faltas, 'todas')).toHaveLength(3)
  })

  it('con "solo injustificadas" no suman las justificadas', () => {
    expect(faltasQueCuentan(faltas, 'injustificadas').map((f) => f.fecha)).toEqual(['2026-03-02', '2026-03-04'])
  })

  it('cuentaFalta responde para una sola falta', () => {
    expect(cuentaFalta(true, 'injustificadas')).toBe(false)
    expect(cuentaFalta(false, 'injustificadas')).toBe(true)
    expect(cuentaFalta(true, 'todas')).toBe(true)
    expect(cuentaFalta(true)).toBe(true)
  })
})

describe('valorDeTipo', () => {
  const ausente = { valor: 1, valor_doble_turno: 0.5 }
  const tarde = { valor: 0.25 }

  it('en turno simple vale el valor del tipo', () => {
    expect(valorDeTipo(ausente, false)).toBe(1)
  })

  it('en doble turno vale el valor de doble turno: dos turnos ausentes suman un día', () => {
    expect(valorDeTipo(ausente, true)).toBe(0.5)
    expect(valorDeTipo(ausente, true) * 2).toBe(valorDeTipo(ausente, false))
  })

  it('sin valor de doble turno vale lo mismo en los dos casos', () => {
    expect(valorDeTipo(tarde, true)).toBe(0.25)
    expect(valorDeTipo(tarde, false)).toBe(0.25)
  })

  it('un tipo que ya no existe vale 1, o lo que se indique', () => {
    expect(valorDeTipo(undefined, false)).toBe(1)
    expect(valorDeTipo(undefined, true, 0.5)).toBe(0.5)
  })
})
