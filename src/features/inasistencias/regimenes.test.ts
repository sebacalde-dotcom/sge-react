import { describe, expect, it } from 'vitest'
import { valorDeTipo } from './conteo'
import { evaluarRegularidad, type FaltaSimple } from './regularidad'
import { REGIMENES, regimenPorId, type Regimen } from './regimenes'
import type { FechasCiclo } from './notificaciones/periodos'

const plantilla = (id: string): Regimen => regimenPorId(id)!

// Ciclo 2026 con los cuatro bimestres cargados
const ciclo: FechasCiclo = {
  anio: 2026,
  inicio: '2026-03-02',
  fin: '2026-12-18',
  c1_desde: '2026-03-02',
  c1_hasta: '2026-07-10',
  c2_desde: '2026-08-03',
  c2_hasta: '2026-12-18',
  periodos: {
    bimestres: [
      { desde: '2026-03-02', hasta: '2026-04-29' },
      { desde: '2026-04-30', hasta: '2026-07-10' },
      { desde: '2026-08-03', hasta: '2026-09-30' },
      { desde: '2026-10-01', hasta: '2026-12-18' },
    ],
  },
}

const dias = (mes: string, cantidad: number, justificada = false): FaltaSimple[] =>
  Array.from({ length: cantidad }, (_, i) => ({ fecha: `${mes}-${String(i + 1).padStart(2, '0')}`, valor: 1, justificada }))

describe('plantillas de régimen: coherencia de la configuración', () => {
  it('hay una plantilla por régimen y se encuentran por su id', () => {
    const ids = REGIMENES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(['caba', 'pba']))
    expect(regimenPorId('caba')?.id).toBe('caba')
    expect(regimenPorId('no-existe')).toBeUndefined()
  })

  for (const r of REGIMENES) {
    describe(r.nombre, () => {
      it('las teclas son de un solo carácter, no se repiten y no usan la J (reservada para justificar)', () => {
        const teclas = r.tipos.map((t) => t.tecla.toUpperCase())
        for (const t of teclas) expect(t).toHaveLength(1)
        expect(new Set(teclas).size).toBe(teclas.length)
        expect(teclas).not.toContain('J')
      })

      it('los nombres de los tipos no se repiten y los valores están entre 0 y 2', () => {
        const nombres = r.tipos.map((t) => t.nombre)
        expect(new Set(nombres).size).toBe(nombres.length)
        for (const t of r.tipos) {
          expect(t.valor).toBeGreaterThanOrEqual(0)
          expect(t.valor).toBeLessThanOrEqual(2)
          if (t.valor_doble_turno !== undefined) {
            expect(t.valor_doble_turno).toBeGreaterThanOrEqual(0)
            expect(t.valor_doble_turno).toBeLessThanOrEqual(2)
          }
        }
      })

      it('las reglas tienen límite positivo y no hay dos iguales (misma cantidad y período)', () => {
        for (const lista of [r.reglas_regularidad, r.avisos]) {
          const claves = lista.map((x) => `${x.limite}_${x.periodo}`)
          expect(new Set(claves).size).toBe(claves.length)
          for (const x of lista) expect(x.limite).toBeGreaterThan(0)
        }
      })

      it('un día completo ausente vale 1 tanto en turno simple como sumando los dos turnos del doble turno', () => {
        const ausente = r.tipos.find((t) => t.nombre === 'Ausente')!
        expect(valorDeTipo(ausente, false)).toBe(1)
        expect(valorDeTipo(ausente, true) * 2).toBe(1)
      })

      it('explica lo que todavía no cubre', () => {
        expect(r.limitaciones.length).toBeGreaterThan(0)
      })
    })
  }
})

describe('plantilla de CABA', () => {
  const reglas = plantilla('caba').reglas_regularidad
  const evaluar = (faltas: FaltaSimple[]) => evaluarRegularidad(faltas, reglas, ciclo, [], '2026-12-01')

  it('el tope por bimestre es 5 injustificadas: con 5 sigue regular y con 6 pierde la regularidad', () => {
    expect(evaluar(dias('2026-03', 5)).noRegular).toBe(false)
    const estado = evaluar(dias('2026-03', 6))
    expect(estado.noRegular).toBe(true)
    expect(estado.infracciones[0].regla.periodo).toBe('bimestre')
  })

  it('las justificadas no cuentan para perder la regularidad', () => {
    // 5 injustificadas en marzo y 10 justificadas en abril: todas caen en el 1° bimestre (02/03 al 29/04)
    const faltas = [...dias('2026-03', 5), ...dias('2026-04', 10, true)]
    expect(evaluar(faltas).noRegular).toBe(false)
    // el progreso mira el período de la fecha de referencia: estando en el 1° bimestre, muestra solo las 5 injustificadas
    expect(evaluarRegularidad(faltas, reglas, ciclo, [], '2026-04-15').progreso[0].total).toBe(5)
  })

  it('5 en cada bimestre (20 en el año) no alcanza para perder la regularidad', () => {
    const faltas = [...dias('2026-03', 5), ...dias('2026-05', 5), ...dias('2026-08', 5), ...dias('2026-10', 5)]
    expect(evaluar(faltas).noRegular).toBe(false)
  })

  it('el ingreso tardío y el retiro anticipado suman un cuarto de falta', () => {
    const tarde = plantilla('caba').tipos.find((t) => t.nombre === 'Ingreso tardío')!
    expect(valorDeTipo(tarde, false)).toBe(0.25)
    expect(valorDeTipo(tarde, true)).toBe(0.25)
  })

  it('no admite reincorporaciones por criterio institucional', () => {
    expect(plantilla('caba').permite_reincorporaciones).toBe(false)
  })
})

describe('plantilla de la Provincia de Buenos Aires', () => {
  const pba = plantilla('pba')

  it('no tiene reglas de regularidad: nadie pierde la regularidad, por muchas faltas que tenga', () => {
    expect(pba.reglas_regularidad).toEqual([])
    const muchas = [...dias('2026-03', 31), ...dias('2026-05', 31), ...dias('2026-09', 30)]
    expect(evaluarRegularidad(muchas, pba.reglas_regularidad, ciclo, [], '2026-12-01').noRegular).toBe(false)
  })

  it('avisa a las 10, 20 y 28 inasistencias del ciclo, contando también las justificadas', () => {
    expect(pba.avisos.map((a) => a.limite)).toEqual([10, 20, 28])
    for (const aviso of pba.avisos) {
      expect(aviso.periodo).toBe('ciclo')
      expect(aviso.cuenta).toBe('todas')
      expect(aviso.notificar_padres).toBe(true)
    }
  })

  it('la llegada tarde vale un cuarto de falta', () => {
    const tarde = pba.tipos.find((t) => t.nombre === 'Llegada tarde')!
    expect(valorDeTipo(tarde, false)).toBe(0.25)
  })
})
