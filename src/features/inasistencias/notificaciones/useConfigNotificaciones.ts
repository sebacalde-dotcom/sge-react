import { useMemo } from 'react'
import { useConfig } from '@/hooks/useConfig'
import { DEFAULT_TEXTO_CARTA, DEFAULT_TEXTO_CARTA_NO_REGULAR } from './carta'
import type { NotificacionInasistencia } from './periodos'

export const CONFIG_NOTIFICACIONES = 'notificaciones_inasistencia'

export interface AvisoNoRegular {
  activa: boolean
  mensaje: string
  notificar_padres: boolean
}

export interface ConfigNotificaciones {
  notificaciones: NotificacionInasistencia[]
  no_regular: AvisoNoRegular
  carta: { texto: string; texto_no_regular: string; incluir_detalle: boolean }
}

type Guardado = Partial<ConfigNotificaciones>

const tieneDatos = (v: Guardado | undefined) =>
  !!v && (v.notificaciones !== undefined || v.carta !== undefined || v.no_regular !== undefined)

// Las reglas y la carta vivían en la config general de inasistencias; se leen de ahí hasta que se guarden en su propia clave.
export function useConfigNotificaciones() {
  const nueva = useConfig<Guardado>(CONFIG_NOTIFICACIONES)
  const anterior = useConfig<Guardado>('inasistencias')

  const origen = tieneDatos(nueva.data) ? nueva.data : anterior.data
  const config = useMemo<ConfigNotificaciones>(
    () => ({
      notificaciones: (origen?.notificaciones ?? []).map((n) => ({ ...n, periodo: n.periodo ?? 'ciclo' })),
      no_regular: {
        activa: origen?.no_regular?.activa ?? true,
        mensaje: origen?.no_regular?.mensaje ?? '',
        notificar_padres: origen?.no_regular?.notificar_padres ?? true,
      },
      carta: {
        texto: origen?.carta?.texto?.trim() ? origen.carta.texto : DEFAULT_TEXTO_CARTA,
        texto_no_regular: origen?.carta?.texto_no_regular?.trim() ? origen.carta.texto_no_regular : DEFAULT_TEXTO_CARTA_NO_REGULAR,
        incluir_detalle: origen?.carta?.incluir_detalle ?? false,
      },
    }),
    [origen],
  )

  return { config, isLoading: nueva.isLoading || anterior.isLoading }
}
