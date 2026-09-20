import { describe, expect, it } from 'vitest'
import {
  conteoDesdeDeRegla,
  evaluarRegularidad,
  mismaRegla,
  type FaltaSimple,
  type ReglaRegularidad,
  type ReincorporacionRegla,
} from './regularidad'

const f = (fecha: string, valor = 1): FaltaSimple => ({ fecha, valor })

/** `cantidad` faltas en días consecutivos desde el 1 del mes indicado ("2026-03"). */
const dias = (mes: string, cantidad: number, valor = 1): FaltaSimple[] =>
  Array.from({ length: cantidad }, (_, i) => f(`${mes}-${String(i + 1).padStart(2, '0')}`, valor))

const BIMESTRE_10: ReglaRegularidad = { limite: 10, periodo: 'bimestre' }
const CICLO_28: ReglaRegularidad = { limite: 28, periodo: 'ciclo' }

// Sin fechas de ciclo, los bimestres cuentan desde marzo: mar-abr, may-jun, jul-ago…
describe('evaluarRegularidad: cuándo un alumno pasa a No Regular', () => {
  it('sin inasistencias es Regular', () => {
    const estado = evaluarRegularidad([], [BIMESTRE_10], null, [], '2026-04-15')
    expect(estado.noRegular).toBe(false)
    expect(estado.noRegularDesde).toBeNull()
    expect(estado.progreso[0].total).toBe(0)
  })

  it('alcanzar el límite dentro de un período lo deja No Regular desde la falta que lo alcanza', () => {
    const estado = evaluarRegularidad(dias('2026-03', 10), [BIMESTRE_10], null, [], '2026-04-15')
    expect(estado.noRegular).toBe(true)
    expect(estado.noRegularDesde).toBe('2026-03-10')
    expect(estado.infracciones).toEqual([
      { regla: BIMESTRE_10, desde: '2026-03-01', hasta: '2026-04-30', total: 10, fecha: '2026-03-10', conteoDesde: null },
    ])
    expect(estado.progreso[0].total).toBe(10)
  })

  it('una falta menos que el límite sigue siendo Regular', () => {
    const estado = evaluarRegularidad(dias('2026-03', 9), [BIMESTRE_10], null, [], '2026-04-15')
    expect(estado.noRegular).toBe(false)
    expect(estado.progreso[0].total).toBe(9)
  })

  it('las faltas de períodos distintos no se suman entre sí', () => {
    const faltas = [...dias('2026-03', 5), ...dias('2026-05', 5)]
    const estado = evaluarRegularidad(faltas, [BIMESTRE_10], null, [], '2026-05-20')
    expect(estado.noRegular).toBe(false)
    expect(estado.progreso[0].total).toBe(5)
  })

  it('las medias faltas suman fracciones', () => {
    const regla: ReglaRegularidad = { limite: 10, periodo: 'ciclo' }
    expect(evaluarRegularidad(dias('2026-03', 19, 0.5), [regla], null, [], '2026-04-01').noRegular).toBe(false)
    const estado = evaluarRegularidad(dias('2026-03', 20, 0.5), [regla], null, [], '2026-04-01')
    expect(estado.noRegular).toBe(true)
    expect(estado.noRegularDesde).toBe('2026-03-20')
  })

  it('el total de la infracción incluye las faltas que pasaron el límite', () => {
    const estado = evaluarRegularidad(dias('2026-03', 12), [{ limite: 10, periodo: 'mes' }], null, [], '2026-03-31')
    expect(estado.infracciones[0].total).toBe(12)
    expect(estado.infracciones[0].fecha).toBe('2026-03-10')
  })

  it('no depende del orden en que vienen las faltas', () => {
    const desordenadas = [...dias('2026-03', 10)].reverse()
    const estado = evaluarRegularidad(desordenadas, [BIMESTRE_10], null, [], '2026-04-15')
    expect(estado.noRegularDesde).toBe('2026-03-10')
  })

  it('sigue No Regular en períodos posteriores aunque no haya faltas nuevas', () => {
    const estado = evaluarRegularidad(dias('2026-03', 10), [BIMESTRE_10], null, [], '2026-11-10')
    expect(estado.noRegular).toBe(true)
    expect(estado.progreso[0].total).toBe(0) // el progreso mira solo el período de la fecha de referencia
  })

  it('una infracción por período: dos bimestres con 10 faltas dan dos infracciones', () => {
    const faltas = [...dias('2026-05', 10), ...dias('2026-03', 10)]
    const estado = evaluarRegularidad(faltas, [BIMESTRE_10], null, [], '2026-06-30')
    expect(estado.infracciones.map((i) => i.fecha)).toEqual(['2026-03-10', '2026-05-10'])
    expect(estado.noRegularDesde).toBe('2026-03-10')
  })
})

describe('evaluarRegularidad: reincorporaciones', () => {
  const reglaB: ReincorporacionRegla = { fecha: '2026-03-20', reglas: [BIMESTRE_10] }

  it('reincorporar reinicia el conteo de la regla infringida y el alumno vuelve a Regular', () => {
    const estado = evaluarRegularidad(dias('2026-03', 10), [BIMESTRE_10], null, [reglaB], '2026-04-01')
    expect(estado.noRegular).toBe(false)
    expect(estado.progreso[0]).toMatchObject({ total: 0, conteoDesde: '2026-03-20' })
  })

  it('las faltas anteriores se conservan pero no cuentan; las nuevas cuentan desde cero', () => {
    const faltas = [...dias('2026-03', 10), f('2026-03-25'), f('2026-03-26'), f('2026-03-27')]
    const estado = evaluarRegularidad(faltas, [BIMESTRE_10], null, [reglaB], '2026-04-01')
    expect(estado.noRegular).toBe(false)
    expect(estado.progreso[0].total).toBe(3)
  })

  it('las faltas del mismo día de la reincorporación sí cuentan', () => {
    const reinc: ReincorporacionRegla = { fecha: '2026-03-10', reglas: [BIMESTRE_10] }
    const estado = evaluarRegularidad(dias('2026-03', 10), [BIMESTRE_10], null, [reinc], '2026-03-31')
    expect(estado.progreso[0].total).toBe(1)
    expect(estado.noRegular).toBe(false)
  })

  it('puede volver a quedar No Regular con faltas nuevas después de reincorporarse', () => {
    const faltas = [...dias('2026-03', 10), ...dias('2026-04', 10)]
    const estado = evaluarRegularidad(faltas, [BIMESTRE_10], null, [reglaB], '2026-04-30')
    expect(estado.noRegular).toBe(true)
    expect(estado.infracciones[0]).toMatchObject({ fecha: '2026-04-10', conteoDesde: '2026-03-20' })
  })

  describe('con dos reglas (10 por bimestre y 28 por ciclo)', () => {
    const reglas = [BIMESTRE_10, CICLO_28]
    // 10 en marzo (infringe el bimestre), 5 en abril, 6 en mayo y 7 en julio: 28 en total, ninguna otra tanda llega a 10
    const faltas = [...dias('2026-03', 10), ...dias('2026-04', 5), ...dias('2026-05', 6), ...dias('2026-07', 7)]

    it('la reincorporación reinicia solo la regla infringida: la del ciclo sigue acumulando', () => {
      const estado = evaluarRegularidad(faltas.slice(0, 15), reglas, null, [reglaB], '2026-04-10')
      const [bimestre, ciclo] = estado.progreso
      expect(estado.noRegular).toBe(false)
      expect(bimestre).toMatchObject({ total: 5, conteoDesde: '2026-03-20' })
      expect(ciclo).toMatchObject({ total: 15, conteoDesde: null })
    })

    it('llegar a 28 en el ciclo lo deja No Regular por esa regla aunque el bimestre se haya reiniciado', () => {
      const estado = evaluarRegularidad(faltas, reglas, null, [reglaB], '2026-07-31')
      expect(estado.infracciones).toHaveLength(1)
      expect(estado.infracciones[0]).toMatchObject({ regla: CICLO_28, fecha: '2026-07-07', total: 28 })
      expect(estado.noRegularDesde).toBe('2026-07-07')
    })

    it('una reincorporación anterior (sin reglas guardadas) reinicia todas las reglas', () => {
      const antigua: ReincorporacionRegla = { fecha: '2026-03-20', reglas: null }
      const estado = evaluarRegularidad(faltas, reglas, null, [antigua], '2026-07-31')
      expect(estado.noRegular).toBe(false)
      expect(estado.progreso[1]).toMatchObject({ total: 18, conteoDesde: '2026-03-20' }) // 5 + 6 + 7
    })
  })
})

describe('conteoDesdeDeRegla y mismaRegla', () => {
  it('sin reincorporaciones no hay fecha de reinicio', () => {
    expect(conteoDesdeDeRegla(BIMESTRE_10, [])).toBeNull()
  })

  it('toma la última reincorporación que aplica, en cualquier orden', () => {
    const reinc: ReincorporacionRegla[] = [
      { fecha: '2026-06-01', reglas: [BIMESTRE_10] },
      { fecha: '2026-03-20', reglas: [BIMESTRE_10] },
    ]
    expect(conteoDesdeDeRegla(BIMESTRE_10, reinc)).toBe('2026-06-01')
    expect(conteoDesdeDeRegla(BIMESTRE_10, [...reinc].reverse())).toBe('2026-06-01')
  })

  it('ignora las reincorporaciones que reiniciaron otras reglas', () => {
    expect(conteoDesdeDeRegla(BIMESTRE_10, [{ fecha: '2026-03-20', reglas: [CICLO_28] }])).toBeNull()
  })

  it('una reincorporación sin reglas guardadas aplica a cualquier regla', () => {
    expect(conteoDesdeDeRegla(CICLO_28, [{ fecha: '2026-03-20', reglas: null }])).toBe('2026-03-20')
  })

  it('dos reglas son la misma si coinciden el límite y el período', () => {
    expect(mismaRegla(BIMESTRE_10, { limite: 10, periodo: 'bimestre' })).toBe(true)
    expect(mismaRegla(BIMESTRE_10, { limite: 10, periodo: 'trimestre' })).toBe(false)
    expect(mismaRegla(BIMESTRE_10, { limite: 11, periodo: 'bimestre' })).toBe(false)
  })
})
