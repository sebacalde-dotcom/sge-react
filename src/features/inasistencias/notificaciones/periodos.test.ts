import { describe, expect, it } from 'vitest'
import {
  RANGO_TODO,
  etiquetaPeriodo,
  instanciaPeriodo,
  notificacionesCruzadas,
  rangoPeriodo,
  type FechasCiclo,
  type NotificacionInasistencia,
  type RangoFechas,
} from './periodos'

const ciclo = (extra: Partial<FechasCiclo> = {}): FechasCiclo => ({
  anio: 2026,
  inicio: '2026-03-02',
  c1_desde: null,
  c1_hasta: null,
  c2_desde: null,
  c2_hasta: null,
  ...extra,
})

const rango = (desde: string, hasta: string): RangoFechas => ({ desde, hasta })

describe('rangoPeriodo', () => {
  it('mes: primer y último día, con años bisiestos', () => {
    expect(rangoPeriodo('mes', '2026-02-15', null)).toEqual(rango('2026-02-01', '2026-02-28'))
    expect(rangoPeriodo('mes', '2028-02-10', null)).toEqual(rango('2028-02-01', '2028-02-29'))
    expect(rangoPeriodo('mes', '2026-12-31', null)).toEqual(rango('2026-12-01', '2026-12-31'))
  })

  it('ciclo: abarca todas las fechas', () => {
    expect(rangoPeriodo('ciclo', '2026-05-05', null)).toEqual(RANGO_TODO)
  })

  describe('bimestre y trimestre (cuentan desde el mes de inicio del ciclo; sin ciclo, marzo)', () => {
    it('bimestre: mar-abr, may-jun… y una fecha en el límite queda en el bloque que corresponde', () => {
      expect(rangoPeriodo('bimestre', '2026-03-10', null)).toEqual(rango('2026-03-01', '2026-04-30'))
      expect(rangoPeriodo('bimestre', '2026-04-30', null)).toEqual(rango('2026-03-01', '2026-04-30'))
      expect(rangoPeriodo('bimestre', '2026-05-01', null)).toEqual(rango('2026-05-01', '2026-06-30'))
      expect(rangoPeriodo('bimestre', '2026-11-20', null)).toEqual(rango('2026-11-01', '2026-12-31'))
    })

    it('bimestre: usa el mes de inicio del ciclo cuando está cargado', () => {
      expect(rangoPeriodo('bimestre', '2026-03-20', ciclo({ inicio: '2026-02-16' }))).toEqual(
        rango('2026-02-01', '2026-03-31'),
      )
    })

    it('trimestre: mar-may, jun-ago…', () => {
      expect(rangoPeriodo('trimestre', '2026-04-10', null)).toEqual(rango('2026-03-01', '2026-05-31'))
      expect(rangoPeriodo('trimestre', '2026-09-01', null)).toEqual(rango('2026-09-01', '2026-11-30'))
    })

    it('trimestre: el último bloque termina en diciembre', () => {
      expect(rangoPeriodo('trimestre', '2026-12-10', null)).toEqual(rango('2026-12-01', '2026-12-31'))
    })
  })

  describe('el ciclo lectivo no cruza el año ni pasa de su fin', () => {
    const diasDelAnio = Array.from({ length: 365 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))
    const periodos = ['mes', 'bimestre', 'trimestre', 'cuatrimestre'] as const

    it('ningún período pasa a otro año: no hay nada que se retome en enero', () => {
      for (const periodo of periodos) {
        for (const dia of diasDelAnio) {
          const r = rangoPeriodo(periodo, dia, null)
          expect(r.desde <= dia && dia <= r.hasta, `${periodo} ${dia}: ${r.desde} a ${r.hasta}`).toBe(true)
          expect(r.hasta.slice(0, 4), `${periodo} ${dia}`).toBe('2026')
        }
      }
    })

    it('todo termina a más tardar en la fecha de fin del ciclo', () => {
      const conFin = ciclo({ fin: '2026-12-18' })
      for (const periodo of periodos) {
        for (const dia of diasDelAnio.filter((d) => d >= '2026-03-02' && d <= '2026-12-18')) {
          const r = rangoPeriodo(periodo, dia, conFin)
          expect(r.desde <= dia && dia <= r.hasta, `${periodo} ${dia}: ${r.desde} a ${r.hasta}`).toBe(true)
          expect(r.hasta <= '2026-12-18', `${periodo} ${dia} pasa del fin del ciclo`).toBe(true)
        }
      }
    })

    it('el último período se acorta hasta el fin del ciclo y los anteriores no cambian', () => {
      const conFin = ciclo({ fin: '2026-12-18' })
      expect(rangoPeriodo('trimestre', '2026-12-10', conFin)).toEqual(rango('2026-12-01', '2026-12-18'))
      expect(rangoPeriodo('mes', '2026-12-10', conFin)).toEqual(rango('2026-12-01', '2026-12-18'))
      expect(rangoPeriodo('bimestre', '2026-04-10', conFin)).toEqual(rango('2026-03-01', '2026-04-30'))
    })

    it('el inicio del período no se recorta al inicio del ciclo: es la clave con que se identifica', () => {
      expect(rangoPeriodo('mes', '2026-03-10', ciclo({ inicio: '2026-03-02' })).desde).toBe('2026-03-01')
    })
  })

  describe('cuatrimestre', () => {
    const conFechas = ciclo({
      c1_desde: '2026-03-02',
      c1_hasta: '2026-07-10',
      c2_desde: '2026-08-03',
      c2_hasta: '2026-12-18',
    })

    it('usa las fechas de los cuatrimestres del ciclo cuando están cargadas', () => {
      expect(rangoPeriodo('cuatrimestre', '2026-05-10', conFechas)).toEqual(rango('2026-03-02', '2026-07-10'))
      expect(rangoPeriodo('cuatrimestre', '2026-07-10', conFechas)).toEqual(rango('2026-03-02', '2026-07-10'))
      expect(rangoPeriodo('cuatrimestre', '2026-10-01', conFechas)).toEqual(rango('2026-08-03', '2026-12-18'))
    })

    it('una fecha entre el fin del 1° y el inicio del 2° (receso) cuenta en el 2° cuatrimestre', () => {
      expect(rangoPeriodo('cuatrimestre', '2026-07-20', conFechas)).toEqual(rango('2026-08-03', '2026-12-18'))
    })

    it('sin fechas cargadas divide el año en bloques de 4 meses desde el inicio del ciclo', () => {
      expect(rangoPeriodo('cuatrimestre', '2026-05-10', null)).toEqual(rango('2026-03-01', '2026-06-30'))
      expect(rangoPeriodo('cuatrimestre', '2026-08-01', null)).toEqual(rango('2026-07-01', '2026-10-31'))
    })

    it('con las fechas a medias también usa los bloques de 4 meses', () => {
      expect(rangoPeriodo('cuatrimestre', '2026-05-10', ciclo({ c1_desde: '2026-03-02' }))).toEqual(
        rango('2026-03-01', '2026-06-30'),
      )
    })
  })
})

describe('instanciaPeriodo', () => {
  it('las fechas del mismo período comparten clave y las de otro período no', () => {
    const a = instanciaPeriodo('mes', '2026-03-01', null)
    const b = instanciaPeriodo('mes', '2026-03-31', null)
    const c = instanciaPeriodo('mes', '2026-04-01', null)
    expect(a.clave).toBe(b.clave)
    expect(a.clave).not.toBe(c.clave)
    expect(a).toMatchObject({ desde: '2026-03-01', hasta: '2026-03-31' })
  })

  it('la clave de un período es su fecha de inicio', () => {
    expect(instanciaPeriodo('bimestre', '2026-04-30', null).clave).toBe('2026-03-01')
  })

  it('el ciclo es una sola instancia por año, con el año del ciclo si lo tiene', () => {
    expect(instanciaPeriodo('ciclo', '2026-05-05', ciclo())).toMatchObject({ ...RANGO_TODO, clave: '2026-01-01' })
    expect(instanciaPeriodo('ciclo', '2027-05-05', null).clave).toBe('2027-01-01')
  })
})

describe('notificacionesCruzadas', () => {
  const regla = (limite: number, periodo: NotificacionInasistencia['periodo']): NotificacionInasistencia => ({
    limite,
    periodo,
    mensaje: '',
    notificar_padres: true,
  })

  it('devuelve las reglas cuyo límite se cruzó con la última falta, de menor a mayor límite', () => {
    const contar = (r: RangoFechas) =>
      r.desde === '2026-09-01' ? { antes: 4, despues: 10 } : { antes: 19, despues: 19 }
    const cruzadas = notificacionesCruzadas(
      [regla(10, 'mes'), regla(20, 'ciclo'), regla(5, 'mes')],
      contar,
      '2026-09-15',
      null,
    )
    expect(cruzadas.map((n) => n.limite)).toEqual([5, 10])
  })

  it('no repite una regla que ya estaba superada antes de la falta', () => {
    const cruzadas = notificacionesCruzadas([regla(10, 'mes')], () => ({ antes: 12, despues: 13 }), '2026-09-15', null)
    expect(cruzadas).toEqual([])
  })

  it('una regla guardada sin período se cuenta sobre todo el ciclo', () => {
    let recibido: RangoFechas | null = null
    const sinPeriodo = { limite: 3, mensaje: '', notificar_padres: true } as unknown as NotificacionInasistencia
    notificacionesCruzadas(
      [sinPeriodo],
      (r) => {
        recibido = r
        return { antes: 0, despues: 0 }
      },
      '2026-09-15',
      null,
    )
    expect(recibido).toEqual(RANGO_TODO)
  })
})

describe('etiquetaPeriodo', () => {
  it('devuelve el texto para usar en una frase y, sin período, el ciclo lectivo', () => {
    expect(etiquetaPeriodo('mes')).toBe('el mes')
    expect(etiquetaPeriodo('cuatrimestre')).toBe('el cuatrimestre')
    expect(etiquetaPeriodo(undefined)).toBe('el ciclo lectivo')
  })
})
