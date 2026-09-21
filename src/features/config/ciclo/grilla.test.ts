import { describe, expect, it } from 'vitest'
import {
  DIAS_SEMANA,
  controlHoras,
  diaDesdeModulos,
  diasConClase,
  generarModulos,
  modulosDelDia,
  modulosDesdeDia,
  modulosPorSemana,
  modulosSemanalesDelCurso,
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

  it('con datos inválidos no arma nada', () => {
    expect(generarModulos('', 4)).toEqual([])
    expect(generarModulos('mañana', 4)).toEqual([])
    expect(generarModulos('07:30', 0)).toEqual([])
    expect(generarModulos('07:30', 3, 0)).toEqual([])
  })
})

describe('modulosDesdeDia: módulos y recreos de cada día', () => {
  it('un recreo de 10 minutos entre cada módulo de una hora', () => {
    const dia = { inicio: '08:00', modulos: [60, 60, 60].map((duracion, i) => ({ duracion, recreoAntes: i === 0 ? 0 : 10 })) }
    expect(modulosDesdeDia(dia)).toEqual([
      { inicio: '08:00', fin: '09:00' },
      { inicio: '09:10', fin: '10:10' },
      { inicio: '10:20', fin: '11:20' },
    ])
  })

  it('dos recreos de 15 minutos en lugar de uno entre cada módulo', () => {
    const dia = {
      inicio: '08:00',
      modulos: [
        { duracion: 60, recreoAntes: 0 },
        { duracion: 60, recreoAntes: 0 },
        { duracion: 60, recreoAntes: 15 },
        { duracion: 60, recreoAntes: 0 },
        { duracion: 60, recreoAntes: 15 },
      ],
    }
    expect(modulosDesdeDia(dia).map((m) => `${m.inicio}-${m.fin}`)).toEqual([
      '08:00-09:00',
      '09:00-10:00',
      '10:15-11:15',
      '11:15-12:15',
      '12:30-13:30',
    ])
  })

  it('el recreo del primer módulo no cuenta: el día empieza a la hora indicada', () => {
    expect(modulosDesdeDia({ inicio: '08:00', modulos: [{ duracion: 60, recreoAntes: 30 }] })[0].inicio).toBe('08:00')
  })

  it('un día sin módulos o con una hora inválida no tiene horarios', () => {
    expect(modulosDesdeDia({ inicio: '08:00', modulos: [] })).toEqual([])
    expect(modulosDesdeDia({ inicio: '', modulos: [{ duracion: 60, recreoAntes: 0 }] })).toEqual([])
  })
})

describe('diaDesdeModulos', () => {
  it('recupera la hora de inicio, la duración y el recreo de cada módulo', () => {
    const modulos = [
      { inicio: '08:00', fin: '09:00' },
      { inicio: '09:10', fin: '10:00' },
    ]
    expect(diaDesdeModulos(modulos, '07:30')).toEqual({
      inicio: '08:00',
      modulos: [
        { duracion: 60, recreoAntes: 0 },
        { duracion: 50, recreoAntes: 10 },
      ],
    })
  })

  it('es la operación inversa de modulosDesdeDia', () => {
    const dia = { inicio: '13:00', modulos: [{ duracion: 60, recreoAntes: 0 }, { duracion: 40, recreoAntes: 5 }] }
    expect(diaDesdeModulos(modulosDesdeDia(dia), '07:30')).toEqual(dia)
  })

  it('un día sin módulos usa la hora de inicio por defecto', () => {
    expect(diaDesdeModulos(undefined, '13:00')).toEqual({ inicio: '13:00', modulos: [] })
    expect(diaDesdeModulos([], '07:30').inicio).toBe('07:30')
  })

  it('módulos superpuestos no dan un recreo negativo', () => {
    const dia = diaDesdeModulos([{ inicio: '08:00', fin: '09:00' }, { inicio: '08:50', fin: '09:50' }], '07:30')
    expect(dia.modulos[1].recreoAntes).toBe(0)
  })
})

describe('espacios por día y por semana', () => {
  // Mañana con 4 espacios de lunes a miércoles y 5 jueves y viernes; tarde solo lunes y martes
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

  it('los días pueden ser de lunes a sábado', () => {
    expect(DIAS_SEMANA.map((d) => d.label)).toEqual(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'])
  })

  it('cada día puede tener una cantidad distinta de espacios', () => {
    expect(modulosDelDia(grilla, 'manana', 3)).toHaveLength(4)
    expect(modulosDelDia(grilla, 'manana', 4)).toHaveLength(5)
    expect(modulosDelDia(grilla, 'tarde', 5)).toEqual([])
  })

  it('suma los espacios de la semana de un turno, sábado incluido', () => {
    expect(modulosPorSemana(grilla, 'manana')).toBe(22)
    expect(modulosPorSemana(grilla, 'tarde')).toBe(6)
    const conSabado: GrillaModulos = { manana: { ...grilla.manana, '6': generarModulos('08:00', 3) } }
    expect(modulosPorSemana(conSabado, 'manana')).toBe(25)
  })

  it('sin grilla cargada no hay espacios', () => {
    expect(modulosPorSemana(null, 'manana')).toBe(0)
    expect(modulosDelDia(undefined, 'tarde', 1)).toEqual([])
  })

  it('un curso de doble turno suma los espacios de los dos turnos', () => {
    expect(modulosSemanalesDelCurso('manana', grilla)).toBe(22)
    expect(modulosSemanalesDelCurso('tarde', grilla)).toBe(6)
    expect(modulosSemanalesDelCurso('doble', grilla)).toBe(28)
  })

  it('un curso sin turno no tiene espacios', () => {
    expect(modulosSemanalesDelCurso(null, grilla)).toBe(0)
    expect(modulosSemanalesDelCurso('vespertino', grilla)).toBe(0)
  })

  it('diasConClase muestra solo los días que tienen algún espacio, y el sábado solo si hay clase', () => {
    expect(diasConClase(grilla, ['manana'])).toEqual([1, 2, 3, 4, 5])
    expect(diasConClase(grilla, ['tarde'])).toEqual([1, 2])
    expect(diasConClase(grilla, ['manana', 'tarde'])).toEqual([1, 2, 3, 4, 5])
    const conSabado: GrillaModulos = { manana: { '1': generarModulos('08:00', 2), '6': generarModulos('08:00', 3) } }
    expect(diasConClase(conSabado, ['manana'])).toEqual([1, 6])
  })

  it('sin espacios cargados se muestran los días de lunes a viernes', () => {
    expect(diasConClase(null, ['manana'])).toEqual([1, 2, 3, 4, 5])
    expect(diasConClase(grilla, [])).toEqual([1, 2, 3, 4, 5])
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
  it('las materias entran cuando sus horas no superan los espacios; los que sobran son días más cortos', () => {
    expect(controlHoras(25, 25)).toEqual({ estado: 'entran', diferencia: 0 })
    expect(controlHoras(25, 22)).toEqual({ estado: 'entran', diferencia: 3 })
  })

  it('no entran cuando las horas pasan los espacios, y dice cuántos faltan', () => {
    expect(controlHoras(25, 27.5)).toEqual({ estado: 'no_entran', diferencia: 2.5 })
  })

  it('sin espacios cargados no se puede controlar', () => {
    expect(controlHoras(0, 10)).toEqual({ estado: 'sin_datos', diferencia: 0 })
  })
})
