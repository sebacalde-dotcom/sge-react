import { describe, expect, it } from 'vitest'
import {
  agruparPorDocente,
  controlDeCarga,
  espaciosDisponibles,
  franjasCubren,
  fusionarFranjas,
  horaCorta,
  limitesDeTurno,
  puedeDarClase,
  totalEspacios,
  validarFranjas,
  type Franja,
} from './disponibilidad'
import { generarModulos, type GrillaModulos } from './grilla'

// Mañana de lunes a viernes con 3 módulos (08:00-11:00) y tarde solo el lunes con 2 (14:30-16:30)
const grilla: GrillaModulos = {
  manana: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [String(d), generarModulos('08:00', 3)])),
  tarde: { '1': generarModulos('14:30', 2) },
}

const f = (dia: number, desde: string, hasta: string): Franja => ({ dia, desde, hasta })

describe('horaCorta', () => {
  it('saca los segundos que devuelve la base', () => {
    expect(horaCorta('08:00:00')).toBe('08:00')
    expect(horaCorta('14:30')).toBe('14:30')
  })
})

describe('validarFranjas', () => {
  it('una lista en orden y sin superposiciones está bien; las que se tocan también', () => {
    expect(validarFranjas([f(1, '08:00', '10:00'), f(1, '10:00', '12:00'), f(2, '08:00', '09:00')])).toBeNull()
    expect(validarFranjas([])).toBeNull()
  })

  it('una franja tiene que terminar después de empezar', () => {
    expect(validarFranjas([f(2, '10:00', '09:00')])).toBe('Una franja del Martes termina antes de empezar')
    expect(validarFranjas([f(2, '10:00', '10:00')])).toBe('Una franja del Martes termina antes de empezar')
  })

  it('pide completar las horas', () => {
    expect(validarFranjas([f(3, '', '10:00')])).toBe('Completá las horas de una franja del Miércoles')
  })

  it('no admite franjas superpuestas el mismo día, pero sí en días distintos', () => {
    expect(validarFranjas([f(1, '08:00', '11:00'), f(1, '10:00', '12:00')])).toBe('Hay franjas superpuestas el Lunes')
    expect(validarFranjas([f(1, '08:00', '11:00'), f(2, '10:00', '12:00')])).toBeNull()
  })
})

describe('fusionarFranjas', () => {
  it('une las que se superponen o se tocan y deja las separadas', () => {
    expect(fusionarFranjas([f(1, '10:00', '12:00'), f(1, '08:00', '10:00'), f(1, '13:00', '14:00'), f(2, '08:00', '09:00')])).toEqual([
      f(1, '08:00', '12:00'),
      f(1, '13:00', '14:00'),
      f(2, '08:00', '09:00'),
    ])
  })

  it('no modifica lo que recibe', () => {
    const entrada = [f(1, '08:00', '10:00'), f(1, '10:00', '12:00')]
    fusionarFranjas(entrada)
    expect(entrada[0].hasta).toBe('10:00')
  })
})

describe('franjasCubren', () => {
  it('un módulo entra si cae por completo dentro de una franja', () => {
    expect(franjasCubren([f(1, '08:00', '11:00')], 1, '09:00', '10:00')).toBe(true)
    expect(franjasCubren([f(1, '08:00', '11:00')], 1, '10:30', '11:30')).toBe(false)
  })

  it('un módulo que cruza dos franjas que se tocan entra', () => {
    expect(franjasCubren([f(1, '08:00', '09:30'), f(1, '09:30', '11:00')], 1, '09:00', '10:00')).toBe(true)
  })

  it('un módulo que cruza dos franjas separadas por un hueco no entra', () => {
    expect(franjasCubren([f(1, '08:00', '09:30'), f(1, '09:45', '11:00')], 1, '09:00', '10:00')).toBe(false)
  })

  it('depende del día', () => {
    expect(franjasCubren([f(1, '08:00', '11:00')], 2, '09:00', '10:00')).toBe(false)
  })
})

describe('espacios de la grilla', () => {
  it('cuenta cuántos espacios en total tiene la grilla', () => {
    expect(totalEspacios(grilla)).toBe(17)
    expect(totalEspacios(null)).toBe(0)
  })

  it('un docente disponible toda la mañana del lunes cubre sus 3 espacios y ninguno más', () => {
    const espacios = espaciosDisponibles([f(1, '08:00', '11:00')], grilla)
    expect(espacios).toEqual([
      { turno: 'manana', dia: 1, modulo: 1 },
      { turno: 'manana', dia: 1, modulo: 2 },
      { turno: 'manana', dia: 1, modulo: 3 },
    ])
  })

  it('una franja que corta un módulo por la mitad no lo cubre', () => {
    expect(espaciosDisponibles([f(1, '08:00', '10:30')], grilla).map((e) => e.modulo)).toEqual([1, 2])
  })

  it('cubre los de la tarde si la franja los incluye', () => {
    expect(espaciosDisponibles([f(1, '14:00', '17:00')], grilla).map((e) => e.turno)).toEqual(['tarde', 'tarde'])
  })

  it('el recreo entre módulos no impide cubrirlos si la franja lo incluye', () => {
    const conRecreo: GrillaModulos = { manana: { '1': generarModulos('08:00', 3, 60, 10) } }
    expect(espaciosDisponibles([f(1, '08:00', '11:20')], conRecreo)).toHaveLength(3)
  })
})

describe('limitesDeTurno', () => {
  it('va del inicio del primer módulo al fin del último', () => {
    expect(limitesDeTurno(grilla, 'manana', 2)).toEqual({ desde: '08:00', hasta: '11:00' })
    expect(limitesDeTurno(grilla, 'tarde', 1)).toEqual({ desde: '14:30', hasta: '16:30' })
  })

  it('un día sin módulos no tiene límites', () => {
    expect(limitesDeTurno(grilla, 'tarde', 3)).toBeNull()
  })
})

describe('puedeDarClase', () => {
  it('sin disponibilidad cargada no se sabe: no se le marca nada', () => {
    expect(puedeDarClase([], grilla, 'manana', 1, 1)).toBeNull()
    expect(puedeDarClase(undefined, grilla, 'manana', 1, 1)).toBeNull()
  })

  it('con disponibilidad, dice si el módulo entra', () => {
    const franjas = [f(1, '08:00', '10:00')]
    expect(puedeDarClase(franjas, grilla, 'manana', 1, 2)).toBe(true)
    expect(puedeDarClase(franjas, grilla, 'manana', 1, 3)).toBe(false)
    expect(puedeDarClase(franjas, grilla, 'manana', 2, 1)).toBe(false)
  })

  it('un módulo que no existe en la grilla no se puede evaluar', () => {
    expect(puedeDarClase([f(1, '08:00', '10:00')], grilla, 'manana', 1, 9)).toBeNull()
  })
})

describe('controlDeCarga', () => {
  const franjas = [f(1, '08:00', '11:00'), f(2, '08:00', '11:00')] // 6 espacios

  it('sin disponibilidad cargada no se puede controlar', () => {
    expect(controlDeCarga([], grilla, 10)).toEqual({ estado: 'sin_disponibilidad', disponibles: 0, necesarios: 10 })
  })

  it('alcanza cuando los módulos que dicta no superan los espacios en los que está disponible', () => {
    expect(controlDeCarga(franjas, grilla, 6)).toEqual({ estado: 'alcanza', disponibles: 6, necesarios: 6 })
  })

  it('no alcanza cuando necesita más espacios de los que tiene disponibles', () => {
    expect(controlDeCarga(franjas, grilla, 7)).toEqual({ estado: 'no_alcanza', disponibles: 6, necesarios: 7 })
  })
})

describe('agruparPorDocente', () => {
  it('agrupa las filas de la base por docente y saca los segundos de las horas', () => {
    const mapa = agruparPorDocente([
      { personal_id: 'ana', dia: 1, desde: '08:00:00', hasta: '12:00:00' },
      { personal_id: 'beto', dia: 2, desde: '14:30:00', hasta: '16:30:00' },
      { personal_id: 'ana', dia: 3, desde: '08:00:00', hasta: '10:00:00' },
    ])
    expect(mapa.get('ana')).toEqual([f(1, '08:00', '12:00'), f(3, '08:00', '10:00')])
    expect(mapa.get('beto')).toEqual([f(2, '14:30', '16:30')])
    expect(mapa.get('carla')).toBeUndefined()
  })
})
