export type TipoDiaEspecial = 'feriado' | 'asueto' | 'sin_clases' | 'cursable'

export interface DiaEspecial {
  tipo: TipoDiaEspecial
  descripcion: string
}

export interface CalendarioCiclo {
  inicio: string | null
  fin: string | null
  dias_especiales: Record<string, DiaEspecial> | null
}

export interface DiaInfo {
  cursable: boolean
  especial: DiaEspecial | null
  motivo: string | null
}

export const TIPOS_DIA_ESPECIAL: { value: TipoDiaEspecial; label: string; bg: string; fg: string }[] = [
  { value: 'feriado', label: 'Feriado', bg: '#fee2e2', fg: '#b91c1c' },
  { value: 'asueto', label: 'Asueto', bg: '#ffedd5', fg: '#c2410c' },
  { value: 'sin_clases', label: 'Sin clases', bg: '#e2e8f0', fg: '#475569' },
  { value: 'cursable', label: 'Día cursable (extra)', bg: '#dcfce7', fg: '#15803d' },
]

export function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function diaInfo(cfg: CalendarioCiclo | null, year: number, month: number, day: number): DiaInfo {
  const fecha = toISODate(year, month, day)
  const especial = cfg?.dias_especiales?.[fecha] ?? null
  const label = (t: TipoDiaEspecial) => TIPOS_DIA_ESPECIAL.find((x) => x.value === t)?.label ?? t

  if (cfg?.inicio && fecha < cfg.inicio) return { cursable: false, especial, motivo: 'Fuera del ciclo lectivo' }
  if (cfg?.fin && fecha > cfg.fin) return { cursable: false, especial, motivo: 'Fuera del ciclo lectivo' }

  if (especial) {
    return {
      cursable: especial.tipo === 'cursable',
      especial,
      motivo: especial.descripcion ? `${label(especial.tipo)}: ${especial.descripcion}` : label(especial.tipo),
    }
  }

  const dow = new Date(year, month - 1, day).getDay()
  const finDeSemana = dow === 0 || dow === 6
  return { cursable: !finDeSemana, especial: null, motivo: finDeSemana ? 'Fin de semana' : null }
}
