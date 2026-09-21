import { describe, expect, it } from 'vitest'
import { formDesdeReglas, mismasReglas, reglasDesdeForm } from './reglasHorario'

describe('formDesdeReglas', () => {
  it('sin reglas guardadas usa el máximo por defecto y evita los módulos libres', () => {
    expect(formDesdeReglas(null)).toEqual({ minManana: '', maxManana: '', minTarde: '', maxTarde: '', maxMateria: '2', sinHuecos: true })
  })

  it('lee las reglas guardadas', () => {
    const form = formDesdeReglas({
      minModulosPorDia: { manana: 4 },
      maxModulosPorDia: { manana: 5, tarde: 3 },
      maxModulosMateriaPorDia: 3,
      docentesSinHuecos: false,
    })
    expect(form).toEqual({ minManana: '4', maxManana: '5', minTarde: '', maxTarde: '3', maxMateria: '3', sinHuecos: false })
  })
})

describe('reglasDesdeForm', () => {
  it('arma solo lo que se indicó', () => {
    const { reglas, error } = reglasDesdeForm({ minManana: '4', maxManana: '5', minTarde: '', maxTarde: '', maxMateria: '2', sinHuecos: true })
    expect(error).toBeNull()
    expect(reglas).toEqual({
      minModulosPorDia: { manana: 4 },
      maxModulosPorDia: { manana: 5 },
      maxModulosMateriaPorDia: 2,
      docentesSinHuecos: true,
    })
  })

  it('ida y vuelta con el formulario', () => {
    const form = { minManana: '4', maxManana: '5', minTarde: '1', maxTarde: '2', maxMateria: '3', sinHuecos: false }
    expect(formDesdeReglas(reglasDesdeForm(form).reglas)).toEqual(form)
  })

  it('un formulario vacío no limita nada', () => {
    const { reglas, error } = reglasDesdeForm({ minManana: '', maxManana: '', minTarde: '', maxTarde: '', maxMateria: '', sinHuecos: true })
    expect(error).toBeNull()
    expect(reglas).toEqual({ docentesSinHuecos: true })
  })

  it('rechaza mínimos mayores que los máximos', () => {
    expect(reglasDesdeForm({ minManana: '6', maxManana: '5', minTarde: '', maxTarde: '', maxMateria: '2', sinHuecos: true }).error).toContain('mañana')
    expect(reglasDesdeForm({ minManana: '', maxManana: '', minTarde: '3', maxTarde: '2', maxMateria: '2', sinHuecos: true }).error).toContain('tarde')
  })

  it('rechaza números que no son enteros o están fuera de rango', () => {
    const base = { minManana: '', maxManana: '', minTarde: '', maxTarde: '', maxMateria: '2', sinHuecos: true }
    expect(reglasDesdeForm({ ...base, maxManana: '4.5' }).error).not.toBeNull()
    expect(reglasDesdeForm({ ...base, minTarde: '-1' }).error).not.toBeNull()
    expect(reglasDesdeForm({ ...base, maxMateria: '0' }).error).not.toBeNull()
    expect(reglasDesdeForm({ ...base, maxManana: '40' }).error).not.toBeNull()
    expect(reglasDesdeForm({ ...base, maxManana: 'abc' }).error).not.toBeNull()
  })
})

describe('mismasReglas', () => {
  it('compara todos los campos', () => {
    const a = formDesdeReglas(null)
    expect(mismasReglas(a, { ...a })).toBe(true)
    expect(mismasReglas(a, { ...a, minManana: '4' })).toBe(false)
    expect(mismasReglas(a, { ...a, sinHuecos: false })).toBe(false)
  })
})
