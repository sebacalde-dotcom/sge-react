import { describe, expect, it } from 'vitest'
import type { CalendarioCiclo } from '@/lib/calendario'
import { diasCursables, partirPorDiasCursables, sugerirBimestres, sugerirTrimestres, validarPeriodos } from './sugerirPeriodos'

const dia = (n: number) => `2026-03-${String(n).padStart(2, '0')}`

// 2026-03-02 es lunes
const calendario = (dias_especiales: CalendarioCiclo['dias_especiales'] = {}): CalendarioCiclo => ({
  inicio: '2026-03-02',
  fin: '2026-12-18',
  dias_especiales,
})

describe('diasCursables', () => {
  it('cuenta de lunes a viernes', () => {
    expect(diasCursables(dia(2), dia(8), calendario())).toEqual([dia(2), dia(3), dia(4), dia(5), dia(6)])
  })

  it('no cuenta feriados ni asuetos, y sí un día cursable extra', () => {
    const cal = calendario({
      [dia(4)]: { tipo: 'feriado', descripcion: '' },
      [dia(7)]: { tipo: 'cursable', descripcion: 'Recuperatorio' }, // sábado
    })
    expect(diasCursables(dia(2), dia(8), cal)).toEqual([dia(2), dia(3), dia(5), dia(6), dia(7)])
  })

  it('no cuenta lo que queda fuera del ciclo', () => {
    expect(diasCursables('2026-02-23', dia(3), calendario())).toEqual([dia(2), dia(3)])
  })
})

describe('partirPorDiasCursables', () => {
  it('parte en dos con la misma cantidad de días de clase; cada parte empieza al día siguiente de la anterior', () => {
    expect(partirPorDiasCursables(dia(2), dia(13), 2, calendario())).toEqual([
      { desde: dia(2), hasta: dia(6) },
      { desde: dia(7), hasta: dia(13) },
    ])
  })

  it('un feriado mueve el corte: el día que no se cursa no cuenta para el reparto', () => {
    const cal = calendario({ [dia(3)]: { tipo: 'feriado', descripcion: '' } })
    // 9 días de clase: 5 en la primera parte, 4 en la segunda
    expect(partirPorDiasCursables(dia(2), dia(13), 2, cal)?.[0]).toEqual({ desde: dia(2), hasta: dia(9) })
  })

  it('con una sola parte devuelve el tramo entero', () => {
    expect(partirPorDiasCursables(dia(2), dia(13), 1, calendario())).toEqual([{ desde: dia(2), hasta: dia(13) }])
  })

  it('no se puede partir en más partes que días de clase', () => {
    expect(partirPorDiasCursables(dia(2), dia(3), 3, calendario())).toBeNull()
  })
})

describe('sugerirBimestres y sugerirTrimestres', () => {
  const fechas = {
    inicio: '2026-03-02',
    fin: '2026-12-18',
    c1_desde: '2026-03-02',
    c1_hasta: '2026-07-10',
    c2_desde: '2026-08-03',
    c2_hasta: '2026-12-18',
  }
  const cursables = (r: { desde: string; hasta: string }) => diasCursables(r.desde, r.hasta, calendario()).length

  it('da 4 bimestres: el 2° termina con el 1° cuatrimestre y el 3° empieza con el 2°', () => {
    const b = sugerirBimestres(fechas, calendario())!
    expect(b).toHaveLength(4)
    expect(b[0].desde).toBe('2026-03-02')
    expect(b[1].hasta).toBe('2026-07-10')
    expect(b[2].desde).toBe('2026-08-03')
    expect(b[3].hasta).toBe('2026-12-18')
  })

  it('cada cuatrimestre queda en dos mitades de días de clase (difieren en a lo sumo uno) y sin huecos entre ellas', () => {
    const b = sugerirBimestres(fechas, calendario())!
    expect(Math.abs(cursables(b[0]) - cursables(b[1]))).toBeLessThanOrEqual(1)
    expect(Math.abs(cursables(b[2]) - cursables(b[3]))).toBeLessThanOrEqual(1)
    const alDiaSiguiente = (iso: string) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)
    expect(b[1].desde).toBe(alDiaSiguiente(b[0].hasta))
    expect(b[3].desde).toBe(alDiaSiguiente(b[2].hasta))
  })

  it('el receso queda entre el 2° y el 3° bimestre, sin pertenecer a ninguno', () => {
    const b = sugerirBimestres(fechas, calendario())!
    expect(b[1].hasta < '2026-07-13' && b[2].desde > '2026-07-31').toBe(true)
  })

  it('sin las fechas de los cuatrimestres, parte todo el ciclo en cuatro', () => {
    const b = sugerirBimestres({ ...fechas, c1_desde: '', c1_hasta: '', c2_desde: '', c2_hasta: '' }, calendario())!
    expect(b).toHaveLength(4)
    expect(b[0].desde).toBe('2026-03-02')
    expect(b[3].hasta).toBe('2026-12-18')
  })

  it('da 3 trimestres entre el inicio y el fin del ciclo', () => {
    const t = sugerirTrimestres(fechas, calendario())!
    expect(t).toHaveLength(3)
    expect(t[0].desde).toBe('2026-03-02')
    expect(t[2].hasta).toBe('2026-12-18')
    const dias = t.map(cursables)
    expect(Math.max(...dias) - Math.min(...dias)).toBeLessThanOrEqual(1)
  })

  it('sin las fechas del ciclo no puede sugerir nada', () => {
    expect(sugerirBimestres({ ...fechas, inicio: '', fin: '', c1_desde: '' }, calendario())).toBeNull()
    expect(sugerirTrimestres({ inicio: '', fin: '' }, calendario())).toBeNull()
  })
})

describe('validarPeriodos', () => {
  const ciclo = { inicio: '2026-03-02', fin: '2026-12-18' }

  it('una lista en orden y dentro del ciclo está bien; con huecos también (receso)', () => {
    expect(
      validarPeriodos(
        'bimestre',
        [
          { desde: '2026-03-02', hasta: '2026-04-29' },
          { desde: '2026-04-30', hasta: '2026-07-10' },
          { desde: '2026-08-03', hasta: '2026-12-18' },
        ],
        ciclo,
      ),
    ).toBeNull()
    expect(validarPeriodos('bimestre', [], ciclo)).toBeNull()
  })

  it('avisa qué período tiene el problema', () => {
    expect(validarPeriodos('bimestre', [{ desde: '2026-03-02', hasta: '' }], ciclo)).toBe('Completá las fechas del 1° bimestre')
    expect(validarPeriodos('trimestre', [{ desde: '2026-05-01', hasta: '2026-04-01' }], ciclo)).toBe(
      'El 1° trimestre termina antes de empezar',
    )
    expect(validarPeriodos('bimestre', [{ desde: '2026-02-01', hasta: '2026-04-01' }], ciclo)).toBe(
      'El 1° bimestre empieza antes del inicio del ciclo',
    )
    expect(validarPeriodos('bimestre', [{ desde: '2026-03-02', hasta: '2027-01-10' }], ciclo)).toBe(
      'El 1° bimestre termina después del fin del ciclo',
    )
  })

  it('no admite períodos superpuestos ni desordenados', () => {
    expect(
      validarPeriodos(
        'bimestre',
        [
          { desde: '2026-03-02', hasta: '2026-05-10' },
          { desde: '2026-05-10', hasta: '2026-07-10' },
        ],
        ciclo,
      ),
    ).toBe('El 2° bimestre tiene que empezar después de que termine el 1° bimestre')
  })
})
