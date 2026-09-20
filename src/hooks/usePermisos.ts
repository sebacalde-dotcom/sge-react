import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { esAdmin, type AreaConfig } from '@/lib/permisos'

export interface PermisoConfig {
  area: AreaConfig
  rol: string
  puede_editar: boolean
}

export function usePermisos() {
  const { personal } = useAuth()
  const admin = esAdmin(personal?.rol)

  const query = useQuery({
    queryKey: ['permisos'],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('permisos_configuracion').select('area, rol, puede_editar')
      if (error) throw error
      return data as PermisoConfig[]
    },
  })

  function puedeEditar(area: AreaConfig): boolean {
    if (admin) return true
    return !!query.data?.some((p) => p.area === area && p.rol === personal?.rol && p.puede_editar)
  }

  return {
    esAdmin: admin,
    puedeEditar,
    permisos: query.data ?? [],
    cargando: query.isLoading,
    tablaDisponible: !query.isError,
    // Para quien no es admin hay que esperar la matriz antes de decidir si puede entrar.
    decidiendo: !admin && query.isLoading,
  }
}
