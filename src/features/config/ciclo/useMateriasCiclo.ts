import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'

export interface MateriaFila {
  id: string
  curso_id: string
  nombre: string
  horas_semanales?: number | null // existe después de la migración 014
  personal_id: string | null
  personal: { apellido: string; nombre: string } | null
}

/** Todas las materias del ciclo en una sola consulta, y si ya existe la columna de horas semanales (migración 014). */
export function useMateriasCiclo() {
  const { cicloId } = useCiclo()
  return useQuery({
    queryKey: ['materias', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const consultar = (columnas: string) =>
        supabase
          .from('materias')
          .select(`id, curso_id, nombre, ${columnas}personal_id, personal:personal_id(apellido, nombre)`)
          .eq('ciclo_id', cicloId!)
          .order('nombre')
      let { data, error } = await consultar('horas_semanales, ')
      let soportaHoras = true
      if (error) {
        // Sin la migración 014 no existe la columna de horas
        soportaHoras = false
        ;({ data, error } = await consultar(''))
      }
      if (error) throw error
      return { filas: (data ?? []) as unknown as MateriaFila[], soportaHoras }
    },
  })
}
