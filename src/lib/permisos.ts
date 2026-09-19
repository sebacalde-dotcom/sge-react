export function puedeConfigurar(rol: string | undefined | null): boolean {
  return rol === 'admin' || rol === 'directivo'
}
