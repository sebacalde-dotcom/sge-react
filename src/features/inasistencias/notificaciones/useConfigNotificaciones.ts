import { useMemo } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { DEFAULT_TEXTO_CARTA } from './carta'
import type { NotificacionInasistencia } from './periodos'

export const CONFIG_NOTIFICACIONES = 'notificaciones_inasistencia'

export interface ConfigNotificaciones {
  notificaciones: NotificacionInasistencia[]
  carta: { texto: string; incluir_detalle: boolean }
}

type Guardado = Partial<ConfigNotificaciones>

const tieneDatos = (v: Guardado | undefined) => !!v && (v.notificaciones !== undefined || v.carta !== undefined)

// Las reglas y la carta vivían en la config general de inasistencias; se leen de ahí hasta que se guarden en su propia clave.
export function useConfigNotificaciones() {
  const nueva = useConfig<Guardado>(CONFIG_NOTIFICACIONES)
  const anterior = useConfig<Guardado>('inasistencias')

  const origen = tieneDatos(nueva.data) ? nueva.data : anterior.data
  const config = useMemo<ConfigNotificaciones>(
    () => ({
      notificaciones: (origen?.notificaciones ?? []).map((n) => ({ ...n, periodo: n.periodo ?? 'ciclo' })),
      carta: {
        texto: origen?.carta?.texto?.trim() ? origen.carta.texto : DEFAULT_TEXTO_CARTA,
        incluir_detalle: origen?.carta?.incluir_detalle ?? false,
      },
    }),
    [origen],
  )

  return { config, isLoading: nueva.isLoading || anterior.isLoading }
}
