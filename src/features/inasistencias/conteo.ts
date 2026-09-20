// Cómo se cuentan las inasistencias: qué tipos hay, cuánto vale cada uno y cuándo una regla se considera cumplida.
// No importa nada del resto del módulo para que cualquiera pueda usarlo sin ciclos de importación.

export type CuentaFaltas = 'todas' | 'injustificadas'
export type Comparacion = 'alcanza' | 'supera'

export interface TipoInasistencia {
  nombre: string
  valor: number
  /** Valor del tipo cuando el ciclo tiene doble turno (ej.: ausente = 1 en turno simple y 0,5 por turno). Si falta, vale lo mismo. */
  valor_doble_turno?: number
  tecla: string
}

export const CUENTAS: { value: CuentaFaltas; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'injustificadas', label: 'Solo injustificadas' },
]

export const COMPARACIONES: { value: Comparacion; label: string }[] = [
  { value: 'alcanza', label: 'Alcanzan' },
  { value: 'supera', label: 'Superan' },
]

/** ¿Una regla con este límite se cumple? "Alcanza" es mayor o igual; "supera", estrictamente mayor. */
export function superaLimite(total: number, limite: number, comparacion?: Comparacion): boolean {
  return comparacion === 'supera' ? total > limite : total >= limite
}

/** ¿Esta inasistencia cuenta para una regla? Con "solo injustificadas", las justificadas no suman. */
export function cuentaFalta(justificada: boolean | undefined, cuenta?: CuentaFaltas): boolean {
  return cuenta !== 'injustificadas' || !justificada
}

export function faltasQueCuentan<T extends { justificada?: boolean }>(faltas: T[], cuenta?: CuentaFaltas): T[] {
  return cuenta === 'injustificadas' ? faltas.filter((f) => cuentaFalta(f.justificada, cuenta)) : faltas
}

/** Valor de una falta de este tipo según los turnos del ciclo. Un tipo desconocido vale `porDefecto`. */
export function valorDeTipo(
  tipo: Pick<TipoInasistencia, 'valor' | 'valor_doble_turno'> | undefined,
  dobleTurno: boolean,
  porDefecto = 1,
): number {
  if (!tipo) return porDefecto
  return dobleTurno ? (tipo.valor_doble_turno ?? tipo.valor) : tipo.valor
}
