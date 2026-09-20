import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEXTO_CARTA,
  DEFAULT_TEXTO_CARTA_NO_REGULAR,
  VARIABLES_CARTA,
  cantidadRegla,
  descripcionPeriodo,
  formatFecha,
  formatNum,
  renderTexto,
  resumir,
} from './carta'
import type { FechasCiclo } from './periodos'

const ciclo: FechasCiclo = {
  anio: 2026,
  inicio: '2026-03-02',
  c1_desde: '2026-03-02',
  c1_hasta: '2026-07-10',
  c2_desde: '2026-08-03',
  c2_hasta: '2026-12-18',
}

describe('formatFecha', () => {
  it('pasa de AAAA-MM-DD a DD/MM/AAAA, también desde un timestamp', () => {
    expect(formatFecha('2026-09-20')).toBe('20/09/2026')
    expect(formatFecha('2026-09-20T15:30:00+00:00')).toBe('20/09/2026')
  })
})

describe('formatNum', () => {
  it('muestra los enteros sin decimales y las fracciones sin ceros de más', () => {
    expect(formatNum(10)).toBe('10')
    expect(formatNum(0.5)).toBe('0.5')
    expect(formatNum(2.5)).toBe('2.5')
    expect(formatNum(1.25)).toBe('1.25')
  })

  it('absorbe el error de punto flotante de sumar fracciones', () => {
    expect(formatNum(0.1 + 0.2)).toBe('0.3')
  })
})

describe('cantidadRegla', () => {
  it('dice la cantidad de la regla tal como la lee la normativa', () => {
    expect(cantidadRegla(10)).toBe('10 inasistencias')
    expect(cantidadRegla(10, 'alcanza', 'todas')).toBe('10 inasistencias')
    expect(cantidadRegla(5, 'supera', 'injustificadas')).toBe('más de 5 inasistencias injustificadas')
    expect(cantidadRegla(28, 'alcanza', 'injustificadas')).toBe('28 inasistencias injustificadas')
  })
})

describe('resumir', () => {
  it('suma el valor de las faltas separando justificadas de injustificadas', () => {
    const resumen = resumir([
      { fecha: '2026-03-02', tipo: 'A', valor: 1, justificada: false },
      { fecha: '2026-03-03', tipo: 'T', valor: 0.5, justificada: false },
      { fecha: '2026-03-04', tipo: 'A', valor: 1, justificada: true },
    ])
    expect(resumen).toEqual({ total: 2.5, justificadas: 1, injustificadas: 1.5 })
  })

  it('acepta valores numéricos que llegan como texto desde la base', () => {
    const fila = { fecha: '2026-03-02', tipo: 'T', valor: '0.5' as unknown as number, justificada: false }
    expect(resumir([fila, fila]).total).toBe(1)
  })

  it('sin faltas da todo en cero', () => {
    expect(resumir([])).toEqual({ total: 0, justificadas: 0, injustificadas: 0 })
  })
})

describe('renderTexto', () => {
  it('reemplaza las variables, incluso repetidas', () => {
    expect(renderTexto('{alumno} y {alumno} ({dni})', { alumno: 'Ana', dni: '123' })).toBe('Ana y Ana (123)')
  })

  it('deja intactas las variables desconocidas para que se note el error', () => {
    expect(renderTexto('Hola {alumno} {inexistente}', { alumno: 'Ana' })).toBe('Hola Ana {inexistente}')
  })
})

describe('modelos de carta', () => {
  it('todas las variables que usan los textos por defecto están declaradas en VARIABLES_CARTA', () => {
    const declaradas = new Set(VARIABLES_CARTA.map((v) => v.nombre))
    for (const texto of [DEFAULT_TEXTO_CARTA, DEFAULT_TEXTO_CARTA_NO_REGULAR]) {
      for (const [variable] of texto.matchAll(/\{\w+\}/g)) {
        expect(declaradas.has(variable), `${variable} no está en VARIABLES_CARTA`).toBe(true)
      }
    }
  })

  it('el texto de No Regular menciona desde cuándo, y el común no', () => {
    expect(DEFAULT_TEXTO_CARTA_NO_REGULAR).toContain('{desde}')
    expect(DEFAULT_TEXTO_CARTA).not.toContain('{desde}')
  })
})

describe('descripcionPeriodo', () => {
  it('mes', () => {
    expect(descripcionPeriodo('mes', '2026-09-01', '2026-09-30', ciclo)).toBe('el mes de septiembre de 2026')
  })

  it('bimestre y trimestre con uno o varios meses', () => {
    expect(descripcionPeriodo('bimestre', '2026-03-01', '2026-04-30', ciclo)).toBe('el bimestre de marzo a abril de 2026')
    expect(descripcionPeriodo('trimestre', '2026-03-01', '2026-05-31', ciclo)).toBe('el trimestre de marzo a mayo de 2026')
    // el trimestre que cruza el fin de año queda cortado en diciembre
    expect(descripcionPeriodo('trimestre', '2026-12-01', '2026-12-31', ciclo)).toBe('el trimestre de diciembre de 2026')
  })

  it('cuatrimestre: reconoce el 1° y el 2° del ciclo y, si no, lo describe por fechas', () => {
    expect(descripcionPeriodo('cuatrimestre', '2026-03-02', '2026-07-10', ciclo)).toBe(
      'el 1° cuatrimestre (02/03/2026 al 10/07/2026)',
    )
    expect(descripcionPeriodo('cuatrimestre', '2026-08-03', '2026-12-18', ciclo)).toBe(
      'el 2° cuatrimestre (03/08/2026 al 18/12/2026)',
    )
    expect(descripcionPeriodo('cuatrimestre', '2026-03-01', '2026-06-30', null)).toBe(
      'el cuatrimestre (01/03/2026 al 30/06/2026)',
    )
  })

  it('bimestres y trimestres definidos en el ciclo se nombran por número y con sus fechas', () => {
    const conPeriodos: FechasCiclo = {
      ...ciclo,
      periodos: {
        bimestres: [
          { desde: '2026-03-02', hasta: '2026-04-29' },
          { desde: '2026-04-30', hasta: '2026-07-10' },
        ],
        trimestres: [{ desde: '2026-03-02', hasta: '2026-06-12' }],
      },
    }
    expect(descripcionPeriodo('bimestre', '2026-04-30', '2026-07-10', conPeriodos)).toBe(
      'el 2° bimestre (30/04/2026 al 10/07/2026)',
    )
    expect(descripcionPeriodo('trimestre', '2026-03-02', '2026-06-12', conPeriodos)).toBe(
      'el 1° trimestre (02/03/2026 al 12/06/2026)',
    )
    // un período que no está entre los definidos se describe por meses, como antes
    expect(descripcionPeriodo('bimestre', '2026-05-01', '2026-06-30', conPeriodos)).toBe('el bimestre de mayo a junio de 2026')
  })

  it('ciclo lectivo con el año del ciclo', () => {
    expect(descripcionPeriodo('ciclo', '0000-01-01', '9999-12-31', ciclo)).toBe('el ciclo lectivo 2026')
  })
})
