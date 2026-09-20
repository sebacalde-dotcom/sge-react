import { describe, expect, it } from 'vitest'
import { AREAS_CONFIG, ROLES_DELEGABLES, esAdmin } from './permisos'

describe('esAdmin', () => {
  it('admin y directivo administran; los demás roles y la ausencia de rol, no', () => {
    expect(esAdmin('admin')).toBe(true)
    expect(esAdmin('directivo')).toBe(true)
    expect(esAdmin('docente')).toBe(false)
    expect(esAdmin('preceptor')).toBe(false)
    expect(esAdmin(null)).toBe(false)
    expect(esAdmin(undefined)).toBe(false)
  })
})

describe('matriz de permisos', () => {
  it('cada área de configuración aparece una sola vez', () => {
    const areas = AREAS_CONFIG.map((a) => a.area)
    expect(new Set(areas).size).toBe(areas.length)
  })

  it('solo se delegan permisos a docentes y preceptores, nunca a quienes ya administran', () => {
    for (const { rol } of ROLES_DELEGABLES) expect(esAdmin(rol)).toBe(false)
  })
})
