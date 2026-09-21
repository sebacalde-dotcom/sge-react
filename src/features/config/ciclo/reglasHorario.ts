import { MAX_MATERIA_POR_DIA_DEFECTO, type ReglasHorario } from './generador'

/** Las reglas del horario tal como se cargan en pantalla: texto en blanco = sin límite. */
export interface FormReglas {
  minManana: string
  maxManana: string
  minTarde: string
  maxTarde: string
  maxMateria: string
  sinHuecos: boolean
}

const MAX_MODULOS_POR_DIA = 12

const aTexto = (n: number | undefined) => (n === undefined ? '' : String(n))

export function formDesdeReglas(reglas: ReglasHorario | null | undefined): FormReglas {
  return {
    minManana: aTexto(reglas?.minModulosPorDia?.manana),
    maxManana: aTexto(reglas?.maxModulosPorDia?.manana),
    minTarde: aTexto(reglas?.minModulosPorDia?.tarde),
    maxTarde: aTexto(reglas?.maxModulosPorDia?.tarde),
    maxMateria: String(reglas?.maxModulosMateriaPorDia ?? MAX_MATERIA_POR_DIA_DEFECTO),
    sinHuecos: reglas?.docentesSinHuecos ?? true,
  }
}

const enteroEnRango = (texto: string, minimo: number): number | undefined | 'invalido' => {
  const limpio = texto.trim()
  if (limpio === '') return undefined
  const n = Number(limpio)
  return Number.isInteger(n) && n >= minimo && n <= MAX_MODULOS_POR_DIA ? n : 'invalido'
}

/** Las reglas que se guardan y usa el generador, o el motivo por el que lo cargado no sirve. */
export function reglasDesdeForm(form: FormReglas): { reglas: ReglasHorario; error: string | null } {
  const minManana = enteroEnRango(form.minManana, 0)
  const maxManana = enteroEnRango(form.maxManana, 1)
  const minTarde = enteroEnRango(form.minTarde, 0)
  const maxTarde = enteroEnRango(form.maxTarde, 1)
  const maxMateria = enteroEnRango(form.maxMateria, 1)
  const reglas: ReglasHorario = { docentesSinHuecos: form.sinHuecos }
  const valores = [minManana, maxManana, minTarde, maxTarde, maxMateria]
  if (valores.includes('invalido')) {
    return { reglas, error: `Los módulos tienen que ser números enteros: los máximos de 1 a ${MAX_MODULOS_POR_DIA} y los mínimos de 0 a ${MAX_MODULOS_POR_DIA}.` }
  }
  if (typeof minManana === 'number' && typeof maxManana === 'number' && minManana > maxManana) {
    return { reglas, error: 'El mínimo de módulos por día de la mañana no puede ser mayor que el máximo.' }
  }
  if (typeof minTarde === 'number' && typeof maxTarde === 'number' && minTarde > maxTarde) {
    return { reglas, error: 'El mínimo de módulos por día de la tarde no puede ser mayor que el máximo.' }
  }
  const porTurno = (manana: number | undefined | 'invalido', tarde: number | undefined | 'invalido') => {
    const resultado: { manana?: number; tarde?: number } = {}
    if (typeof manana === 'number') resultado.manana = manana
    if (typeof tarde === 'number') resultado.tarde = tarde
    return Object.keys(resultado).length > 0 ? resultado : undefined
  }
  const minimos = porTurno(minManana, minTarde)
  const maximos = porTurno(maxManana, maxTarde)
  if (minimos) reglas.minModulosPorDia = minimos
  if (maximos) reglas.maxModulosPorDia = maximos
  if (typeof maxMateria === 'number') reglas.maxModulosMateriaPorDia = maxMateria
  return { reglas, error: null }
}

export const mismasReglas = (a: FormReglas, b: FormReglas): boolean =>
  a.minManana === b.minManana &&
  a.maxManana === b.maxManana &&
  a.minTarde === b.minTarde &&
  a.maxTarde === b.maxTarde &&
  a.maxMateria === b.maxMateria &&
  a.sinHuecos === b.sinHuecos
