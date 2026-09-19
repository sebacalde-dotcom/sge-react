import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { ArrowBack, Print } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { formatFecha, formatNum } from './carta'
import { useNotificacionesPendientes, type NotificacionItem } from './useNotificacionesPendientes'

function Seccion({ titulo, cantidad, ayuda, children }: { titulo: string; cantidad: number; ayuda: string; children: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ mb: 3, borderRadius: 2 }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontWeight: 700 }}>{titulo}</Typography>
        <Chip size="small" label={cantidad} color={cantidad > 0 ? 'primary' : 'default'} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>{ayuda}</Typography>
      </Box>
      {children}
    </Card>
  )
}

export function TareasPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { porImprimir, porEntregar, esperandoFirma, isLoading, tablaDisponible, hayReglas } = useNotificacionesPendientes()
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())

  const estadoMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: 'entregada' | 'firmada' }) => {
      const ahora = new Date().toISOString()
      const campos = estado === 'entregada' ? { estado, entregada_at: ahora } : { estado, firmada_at: ahora }
      const { data, error } = await supabase.from('notificaciones_inasistencia').update(campos).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo actualizar la notificación (sin permisos en la base)')
    },
    onSuccess: (_, { estado }) => {
      toast.success(estado === 'entregada' ? 'Marcada como entregada' : 'Marcada como firmada')
      queryClient.invalidateQueries({ queryKey: ['tareas'] })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function alternar(key: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const seleccionadas = porImprimir.filter((n) => seleccion.has(n.key))
  const todasMarcadas = porImprimir.length > 0 && seleccionadas.length === porImprimir.length

  function imprimir(items: NotificacionItem[]) {
    navigate('/tareas/imprimir', { state: { items } })
  }

  const regla = (n: NotificacionItem) => `${formatNum(n.limite)} inasistencias · ${n.datos.periodo_texto}`
  const acumulado = (n: NotificacionItem) => `${formatNum(n.datos.periodo.total)} en el período · ${formatNum(n.datos.ciclo.total)} en el ciclo`

  const tablaAcciones = (items: NotificacionItem[], boton: { texto: string; estado: 'entregada' | 'firmada'; fecha: (n: NotificacionItem) => string }) => (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Alumno</TableCell>
          <TableCell>Curso</TableCell>
          <TableCell>Regla</TableCell>
          <TableCell>Estado</TableCell>
          <TableCell align="right" />
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((n) => (
          <TableRow key={n.key} hover>
            <TableCell sx={{ fontWeight: 500 }}>{n.apellido}, {n.nombre}</TableCell>
            <TableCell>{n.datos.curso}</TableCell>
            <TableCell>{regla(n)}</TableCell>
            <TableCell>{boton.fecha(n)}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              <Tooltip title="Volver a imprimir">
                <IconButton size="small" onClick={() => imprimir([n])}><Print fontSize="small" /></IconButton>
              </Tooltip>
              <Button
                size="small"
                variant="outlined"
                disabled={estadoMutation.isPending}
                onClick={() => estadoMutation.mutate({ id: n.registro!.id, estado: boton.estado })}
                sx={{ ml: 1 }}
              >
                {boton.texto}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h5">Tareas pendientes</Typography>
          <Typography variant="body2" color="text.secondary">Notificaciones de inasistencias a los padres</Typography>
        </Box>
      </Box>

      {!tablaDisponible && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta crear la tabla de cartas en Supabase (migración 005). Mientras tanto se pueden ver e imprimir los pendientes, pero no queda registro de las cartas emitidas.
        </Alert>
      )}
      {!hayReglas && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No hay reglas con "Notificar a los padres" activado. Configuralas en Inasistencias → Configuración.
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <Seccion titulo="Por imprimir" cantidad={porImprimir.length} ayuda="Alumnos que alcanzaron una regla y todavía no tienen su carta emitida.">
            {porImprimir.length > 0 && (
              <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={todasMarcadas}
                          indeterminate={seleccionadas.length > 0 && !todasMarcadas}
                          onChange={() => setSeleccion(todasMarcadas ? new Set() : new Set(porImprimir.map((n) => n.key)))}
                        />
                      </TableCell>
                      <TableCell>Alumno</TableCell>
                      <TableCell>Curso</TableCell>
                      <TableCell>Regla</TableCell>
                      <TableCell>Acumulado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {porImprimir.map((n) => (
                      <TableRow key={n.key} hover onClick={() => alternar(n.key)} sx={{ cursor: 'pointer' }}>
                        <TableCell padding="checkbox"><Checkbox checked={seleccion.has(n.key)} /></TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{n.apellido}, {n.nombre}</TableCell>
                        <TableCell>{n.datos.curso}</TableCell>
                        <TableCell>{regla(n)}</TableCell>
                        <TableCell>{acumulado(n)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<Print />}
                    disabled={seleccionadas.length === 0}
                    onClick={() => imprimir(seleccionadas)}
                  >
                    Generar cartas ({seleccionadas.length})
                  </Button>
                </Box>
              </>
            )}
          </Seccion>

          <Seccion titulo="Para entregar" cantidad={porEntregar.length} ayuda="Cartas impresas que todavía no se entregaron a los padres.">
            {porEntregar.length > 0 &&
              tablaAcciones(porEntregar, {
                texto: 'Entregada',
                estado: 'entregada',
                fecha: (n) => `Impresa el ${formatFecha(n.registro!.emitida_at)}`,
              })}
          </Seccion>

          <Seccion titulo="Esperando firma" cantidad={esperandoFirma.length} ayuda="Cartas entregadas que todavía no volvieron firmadas.">
            {esperandoFirma.length > 0 &&
              tablaAcciones(esperandoFirma, {
                texto: 'Firmada',
                estado: 'firmada',
                fecha: (n) => `Entregada el ${formatFecha(n.registro!.entregada_at ?? n.registro!.emitida_at)}`,
              })}
          </Seccion>
        </>
      )}
    </Box>
  )
}
