import { useMutation } from '@tanstack/react-query'
import { useCiclo } from '@/contexts/CicloContext'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'
import type { TipoInasistencia } from './conteo'
import { CONFIG_NOTIFICACIONES, useConfigNotificaciones } from './notificaciones/useConfigNotificaciones'
import {
  avisosConAjustesDeLaEscuela,
  diferenciasConRegimen,
  origenDelRegimen,
  regimenEfectivo,
  tiposConTeclasDeLaEscuela,
  type AreaDelRegimen,
  type Regimen,
} from './regimenes'
import type { ReglaRegularidad } from './regularidad'
import { reglasDesdeConfig } from './useRegularidad'

interface ConfigInasistencias {
  tipos?: TipoInasistencia[]
  reglas_regularidad?: ReglaRegularidad[]
  permite_reincorporaciones?: boolean
}

/**
 * El régimen de asistencia y evaluación que rige: el elegido en Ciclo Lectivo o, si no se eligió, el de la
 * jurisdicción cargada en Institución. Es la fuente única para todo lo que depende de la normativa.
 */
export function useRegimen() {
  const { ciclo } = useCiclo()
  const { data: institucion } = useConfig<{ jurisdiccion?: string }>('institucional')
  const jurisdiccion = institucion?.jurisdiccion
  return {
    regimen: regimenEfectivo(ciclo?.regimen, jurisdiccion),
    origen: origenDelRegimen(ciclo?.regimen, jurisdiccion),
    jurisdiccion,
  }
}

/** En qué se aparta la configuración guardada de los valores del régimen (vacío si coincide o no hay régimen). */
export function useDiferenciasConRegimen(regimen: Regimen | undefined): AreaDelRegimen[] {
  const { data: config } = useConfig<ConfigInasistencias>('inasistencias')
  const { config: avisos } = useConfigNotificaciones()
  if (!regimen) return []
  return diferenciasConRegimen(regimen, {
    tipos: config?.tipos ?? [],
    reglas_regularidad: reglasDesdeConfig(config),
    permite_reincorporaciones: config?.permite_reincorporaciones ?? true,
    avisos: avisos.notificaciones,
  })
}

/**
 * Carga en la configuración los valores de un régimen: tipos, reglas de regularidad, reglas de aviso y
 * reincorporaciones. Conserva las teclas y los mensajes que la escuela ya había elegido, y los textos de la carta.
 */
export function useAplicarRegimen() {
  const { data: config } = useConfig<Record<string, unknown> & ConfigInasistencias>('inasistencias')
  const { config: avisos } = useConfigNotificaciones()
  const guardarConfig = useConfigMutation('inasistencias')
  const guardarAvisos = useConfigMutation(CONFIG_NOTIFICACIONES)

  return useMutation({
    mutationFn: async (regimen: Regimen) => {
      await guardarConfig.mutateAsync({
        ...config,
        tipos: tiposConTeclasDeLaEscuela(regimen.tipos, config?.tipos ?? []),
        reglas_regularidad: regimen.reglas_regularidad,
        permite_reincorporaciones: regimen.permite_reincorporaciones,
      })
      // Las reglas de aviso viven en su propia configuración (con la carta), que se conserva
      await guardarAvisos.mutateAsync({
        ...avisos,
        notificaciones: avisosConAjustesDeLaEscuela(regimen.avisos, avisos.notificaciones),
      } as unknown as Record<string, unknown>)
    },
  })
}
