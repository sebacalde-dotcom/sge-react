import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import type { Turno } from './grilla'

export interface MateriaFila {
  id: string
  curso_id: string
  nombre: string
  horas_semanales?: number | null // existe después de la migración 014
  turno?: Turno | null // existe después de la migración 019
  bloque_doble?: boolean // existe después de la migración 019
  personal_id: string | null
  personal: { apellido: string; nombre: string } | null
}

/**
 * Todas las materias del ciclo en una sola consulta, y si ya existen las columnas de horas semanales (migración 014) y
 * las del generador de horarios: turno y bloque doble (migración 019).
 */
export function useMateriasCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['materias', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const consultar = (columnas: string) =>
        supabase
          .from('materias')
          .select(`id, curso_id, nombre, ${columnas}personal_id, personal:personas(apellido, nombre)`)
          .eq('ciclo_id', cicloId!)
          .order('nombre')
      const intentos = [
        { columnas: 'horas_semanales, turno, bloque_doble, ', soportaHoras: true, soportaGenerador: true },
        // Sin la migración 019 no existen turno ni bloque doble
        { columnas: 'horas_semanales, ', soportaHoras: true, soportaGenerador: false },
        // Sin la migración 014 no existe la columna de horas
        { columnas: '', soportaHoras: false, soportaGenerador: false },
      ]
      let ultimoError: Error | null = null
      for (const { columnas, soportaHoras, soportaGenerador } of intentos) {
        const { data, error } = await consultar(columnas)
        if (!error) return { filas: (data ?? []) as unknown as MateriaFila[], soportaHoras, soportaGenerador }
        ultimoError = error
      }
      throw ultimoError
    },
  })
}
