import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Print, CheckCircle } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'
import { CartaHoja, ESTILOS_CARTA, type InstitucionCarta } from './CartaHoja'
import { useConfigNotificaciones } from './useConfigNotificaciones'
import { RUTA_NOTIFICACIONES } from './rutas'
import type { NotificacionItem } from './useNotificaciones'

const ESTILOS_PANTALLA = `
  ${ESTILOS_CARTA}
  .pantalla-carta { background: #e5e7eb; min-height: 100vh; padding: 16px 0 40px; }
  @media print {
    .no-print { display: none !important; }
    .pantalla-carta { background: #fff !important; padding: 0 !important; min-height: 0 !important; }
    .hoja { margin: 0 !important; box-shadow: none !important; }
  }
`

export function ImprimirNotificacionesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { personal } = useAuth()
  const items = (location.state as { items?: NotificacionItem[] } | null)?.items
  const { data: institucion, isLoading: cargandoInstitucion } = useConfig<InstitucionCarta>('institucional')
  const { config, isLoading: cargandoConfig } = useConfigNotificaciones()

  useEffect(() => {
    const anterior = document.title
    document.title = 'Notificaciones de inasistencias'
    return () => {
      document.title = anterior
    }
  }, [])

  const nuevas = (items ?? []).filter((i) => !i.registro)

  const registrarMutation = useMutation({
    mutationFn: async () => {
      const filas = nuevas.map((i) => ({
        persona_id: i.persona_id,
        ciclo_id: i.ciclo_id,
        limite: i.limite,
        periodo: i.periodo,
        periodo_desde: i.periodo_desde,
        estado: 'impresa',
        datos: i.datos,
        emitida_por: personal?.id ?? null,
      }))
      const { error } = await supabase
        .from('notificaciones_inasistencia')
        .upsert(filas, { onConflict: 'persona_id,ciclo_id,limite,periodo,periodo_desde', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Cartas registradas como impresas')
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
      navigate(RUTA_NOTIFICACIONES)
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (!items || items.length === 0) return <Navigate to={RUTA_NOTIFICACIONES} replace />

  return (
    <div className="pantalla-carta">
      <style>{ESTILOS_PANTALLA}</style>

      <div className="no-print" style={{ width: '210mm', margin: '0 auto 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate(RUTA_NOTIFICACIONES)}>Volver</Button>
          <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
            Imprimir ({items.length} {items.length === 1 ? 'carta' : 'cartas'})
          </Button>
          {nuevas.length > 0 && (
            <Button
              variant="outlined"
              color="success"
              startIcon={registrarMutation.isPending ? <CircularProgress size={18} /> : <CheckCircle />}
              disabled={registrarMutation.isPending}
              onClick={() => registrarMutation.mutate()}
            >
              Ya imprimí: marcar {nuevas.length} como impresas
            </Button>
          )}
        </div>
        {nuevas.length > 0 && (
          <Alert severity="info">
            Primero imprimí. Cuando las hojas salgan bien, confirmá con "Ya imprimí" para que pasen a "Impresa". Si no
            confirmás, siguen apareciendo como "Por imprimir".
          </Alert>
        )}
      </div>

      {cargandoInstitucion || cargandoConfig ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>
      ) : (
        items.map((item) => (
          <CartaHoja
            key={item.key}
            item={item}
            institucion={institucion}
            texto={config.carta.texto}
            incluirDetalle={config.carta.incluir_detalle}
          />
        ))
      )}
    </div>
  )
}
