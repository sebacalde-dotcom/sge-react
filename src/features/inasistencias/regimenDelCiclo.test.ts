import { describe, expect, it } from 'vitest'
import {
  REGIMENES,
  avisosConAjustesDeLaEscuela,
  diferenciasConRegimen,
  origenDelRegimen,
  regimenEfectivo,
  regimenPorId,
  tiposConTeclasDeLaEscuela,
  type ConfigAsistencia,
} from './regimenes'

const pba = regimenPorId('pba')!
const caba = regimenPorId('caba')!

const configDe = (r: typeof pba): ConfigAsistencia => ({
  tipos: r.tipos.map((t) => ({ ...t })),
  reglas_regularidad: r.reglas_regularidad.map((x) => ({ ...x })),
  permite_reincorporaciones: r.permite_reincorporaciones,
  avisos: r.avisos.map((a) => ({ ...a })),
})

describe('regimenEfectivo y origenDelRegimen', () => {
  it('el régimen elegido para el ciclo manda sobre la jurisdicción de la institución', () => {
    expect(regimenEfectivo('caba', 'pba')?.id).toBe('caba')
    expect(origenDelRegimen('caba', 'pba')).toBe('ciclo')
  })

  it('si el ciclo no eligió, rige el de la jurisdicción', () => {
    expect(regimenEfectivo(null, 'pba')?.id).toBe('pba')
    expect(regimenEfectivo('', 'caba')?.id).toBe('caba')
    expect(origenDelRegimen(undefined, 'pba')).toBe('institucion')
  })

  it('sin ninguno de los dos no hay régimen', () => {
    expect(regimenEfectivo(undefined, undefined)).toBeUndefined()
    expect(origenDelRegimen(null, '')).toBeNull()
  })

  it('un valor que no es un régimen conocido se ignora', () => {
    expect(regimenEfectivo('cordoba', 'pba')?.id).toBe('pba')
    expect(regimenEfectivo('cordoba', 'santa-fe')).toBeUndefined()
  })
})

describe('los regímenes dicen de dónde salen sus valores', () => {
  for (const r of REGIMENES) {
    it(`${r.nombre}: tiene fuente y avisa si todavía no se verificó`, () => {
      expect(r.fuente.trim().length).toBeGreaterThan(0)
      expect(typeof r.aVerificar).toBe('boolean')
    })
  }
})

describe('diferenciasConRegimen', () => {
  it('la configuración que salió del régimen coincide con él', () => {
    expect(diferenciasConRegimen(pba, configDe(pba))).toEqual([])
    expect(diferenciasConRegimen(caba, configDe(caba))).toEqual([])
  })

  it('las teclas, los mensajes y "notificar a los padres" son preferencias de la escuela y no cuentan', () => {
    const config = configDe(pba)
    config.tipos[0].tecla = 'X'
    config.avisos[0].mensaje = 'Otro mensaje'
    config.avisos[1].notificar_padres = false
    expect(diferenciasConRegimen(pba, config)).toEqual([])
  })

  it('el orden de las reglas y de los tipos no importa', () => {
    const config = configDe(caba)
    config.reglas_regularidad.reverse()
    config.tipos.reverse()
    expect(diferenciasConRegimen(caba, config)).toEqual([])
  })

  it('una regla sin "cuenta" ni "comparación" equivale a "todas" y "alcanza"', () => {
    const config = configDe(pba)
    config.avisos = config.avisos.map(({ limite, periodo, mensaje, notificar_padres }) => ({ limite, periodo, mensaje, notificar_padres }))
    expect(diferenciasConRegimen(pba, config)).toEqual([])
  })

  it('un valor de doble turno igual al valor normal equivale a no tenerlo', () => {
    const config = configDe(pba)
    const tarde = config.tipos.find((t) => t.nombre === 'Llegada tarde')!
    tarde.valor_doble_turno = tarde.valor
    expect(diferenciasConRegimen(pba, config)).toEqual([])
  })

  it('cambiar un límite se nota en las reglas de regularidad', () => {
    const config = configDe(caba)
    config.reglas_regularidad[0].limite = 6
    expect(diferenciasConRegimen(caba, config)).toEqual(['Reglas de regularidad'])
  })

  it('cambiar cómo se cuenta una regla también se nota', () => {
    const config = configDe(caba)
    config.reglas_regularidad[0].cuenta = 'todas'
    expect(diferenciasConRegimen(caba, config)).toEqual(['Reglas de regularidad'])
    const otra = configDe(pba)
    otra.avisos[0].comparacion = 'supera'
    expect(diferenciasConRegimen(pba, otra)).toEqual(['Reglas de aviso'])
  })

  it('cambiar el valor de un tipo, o sacar uno, se nota en los tipos', () => {
    const cambiado = configDe(pba)
    cambiado.tipos[0].valor = 0.5
    expect(diferenciasConRegimen(pba, cambiado)).toEqual(['Tipos de inasistencia'])
    const sinUno = configDe(pba)
    sinUno.tipos.pop()
    expect(diferenciasConRegimen(pba, sinUno)).toEqual(['Tipos de inasistencia'])
  })

  it('permitir reincorporaciones donde el régimen no las admite se nota', () => {
    const config = configDe(caba)
    config.permite_reincorporaciones = true
    expect(diferenciasConRegimen(caba, config)).toEqual(['Reincorporaciones'])
  })

  it('una configuración que nunca se aplicó (vacía) difiere en todo lo que el régimen fija', () => {
    const vacia: ConfigAsistencia = { tipos: [], reglas_regularidad: [], permite_reincorporaciones: true, avisos: [] }
    expect(diferenciasConRegimen(pba, vacia)).toEqual(['Tipos de inasistencia', 'Reglas de aviso', 'Reincorporaciones'])
    expect(diferenciasConRegimen(caba, vacia)).toEqual(['Tipos de inasistencia', 'Reglas de regularidad', 'Reincorporaciones'])
  })
})

describe('tiposConTeclasDeLaEscuela', () => {
  it('conserva la tecla que la escuela eligió para un tipo que sigue existiendo', () => {
    const actuales = [{ nombre: 'Ausente', valor: 1, tecla: 'X' }]
    const tipos = tiposConTeclasDeLaEscuela(pba.tipos, actuales)
    expect(tipos.find((t) => t.nombre === 'Ausente')?.tecla).toBe('X')
    expect(tipos.find((t) => t.nombre === 'Llegada tarde')?.tecla).toBe('T')
  })

  it('no toca los valores del régimen', () => {
    const tipos = tiposConTeclasDeLaEscuela(pba.tipos, [{ nombre: 'Ausente', valor: 9, tecla: 'X' }])
    expect(tipos.find((t) => t.nombre === 'Ausente')).toMatchObject({ valor: 1, valor_doble_turno: 0.5 })
  })

  it('si conservar las teclas dejaría una repetida, usa las del régimen', () => {
    const actuales = [{ nombre: 'Ausente', valor: 1, tecla: 'T' }] // T es la tecla de "Llegada tarde"
    expect(tiposConTeclasDeLaEscuela(pba.tipos, actuales)).toEqual(pba.tipos)
  })

  it('nunca deja la J, que está reservada para justificar', () => {
    const actuales = [{ nombre: 'Ausente', valor: 1, tecla: 'J' }]
    expect(tiposConTeclasDeLaEscuela(pba.tipos, actuales)).toEqual(pba.tipos)
  })

  it('sin configuración previa usa las teclas del régimen', () => {
    expect(tiposConTeclasDeLaEscuela(caba.tipos, [])).toEqual(caba.tipos)
  })
})

describe('avisosConAjustesDeLaEscuela', () => {
  it('conserva el mensaje y "notificar a los padres" de un aviso que la escuela ya tenía', () => {
    const actuales = [{ limite: 10, periodo: 'ciclo' as const, mensaje: 'Mi mensaje', notificar_padres: false }]
    const avisos = avisosConAjustesDeLaEscuela(pba.avisos, actuales)
    expect(avisos[0]).toMatchObject({ limite: 10, mensaje: 'Mi mensaje', notificar_padres: false, cuenta: 'todas', comparacion: 'alcanza' })
  })

  it('los avisos nuevos quedan como los define el régimen', () => {
    const avisos = avisosConAjustesDeLaEscuela(pba.avisos, [])
    expect(avisos).toEqual(pba.avisos)
  })

  it('un aviso con la misma cantidad pero otro período no es el mismo', () => {
    const actuales = [{ limite: 10, periodo: 'mes' as const, mensaje: 'De otro período', notificar_padres: false }]
    expect(avisosConAjustesDeLaEscuela(pba.avisos, actuales)[0].mensaje).toBe(pba.avisos[0].mensaje)
  })
})
