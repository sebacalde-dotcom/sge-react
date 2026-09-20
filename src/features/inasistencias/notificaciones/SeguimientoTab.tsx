import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { MoreVert, Print } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { formatFecha, formatNum } from './carta'
import { RUTA_IMPRIMIR_NOTIFICACIONES } from './rutas'
import { ESTADOS, useNotificaciones, type EstadoNotificacion, type NotificacionItem } from './useNotificaciones'

type Filtro = 'pendientes' | 'todas' | EstadoNotificacion

const DIAS_ALERTA_FIRMA = 7
const MS_DIA = 24 * 60 * 60 * 1000

const estadoInfo = (estado: EstadoNotificacion) => ESTADOS.find((e) => e.value === estado)!

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / MS_DIA)
}

function ultimaAccion(n: NotificacionItem): string {
  const r = n.registro
  if (!r) return '—'
  if (n.estado === 'firmada') return `Firmada el ${formatFecha(r.firmada_at ?? r.emitida_at)}`
  if (n.estado === 'entregada') return `Entregada el ${formatFecha(r.entregada_at ?? r.emitida_at)}`
  return `Impresa el ${formatFecha(r.emitida_at)}`
}

const SIGUIENTE: Partial<Record<EstadoNotificacion, { estado: 'entregada' | 'firmada'; texto: string }>> = {
  impresa: { estado: 'entregada', texto: 'Entregada' },
  entregada: { estado: 'firmada', texto: 'Firmada' },
}

const REVERSION: Partial<Record<EstadoNotificacion, string>> = {
  impresa: 'Deshacer la impresión (vuelve a "Por imprimir")',
  entregada: 'Volver a "Impresa"',
  firmada: 'Volver a "Entregada"',
}

export function SeguimientoTab({ puedeConfigurar, alIrAReglas }: { puedeConfigurar: boolean; alIrAReglas: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { items, conteos, pendientes, isLoading, tablaDisponible, hayReglas } = useNotificaciones()
  const [filtro, setFiltro] = useState<Filtro>('pendientes')
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<{ ancla: HTMLElement; item: NotificacionItem } | null>(null)

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['notificaciones'] })

  const avanzarMutation = useMutation({
    mutationFn: async ({ ids, estado }: { ids: string[]; estado: 'entregada' | 'firmada' }) => {
      const ahora = new Date().toISOString()
      const campos = estado === 'entregada' ? { estado, entregada_at: ahora } : { estado, firmada_at: ahora }
      const { data, error } = await supabase.from('notificaciones_inasistencia').update(campos).in('id', ids).select('id')
      if (error) throw error
      if (!data || data.length !== ids.length) throw new Error('No se pudieron actualizar todas las notificaciones (sin permisos en la base)')
    },
    onSuccess: (_, { ids, estado }) => {
      toast.success(`${ids.length} ${ids.length === 1 ? 'marcada' : 'marcadas'} como ${estado === 'entregada' ? 'entregada' : 'firmada'}`)
      setSeleccion(new Set())
      refrescar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const revertirMutation = useMutation({
    mutationFn: async (item: NotificacionItem) => {
      const id = item.registro!.id
      if (item.estado === 'impresa') {
        const { data, error } = await supabase.from('notificaciones_inasistencia').delete().eq('id', id).select('id')
        if (error) throw error
        if (!data || data.length === 0) throw new Error('No se pudo deshacer (sin permisos en la base)')
        return
      }
      const campos =
        item.estado === 'entregada'
          ? { estado: 'impresa', entregada_at: null }
          : { estado: 'entregada', firmada_at: null }
      const { data, error } = await supabase.from('notificaciones_inasistencia').update(campos).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo revertir (sin permisos en la base)')
    },
    onSuccess: () => {
      toast.success('Estado revertido')
      refrescar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const q = busqueda.trim().toLowerCase()
  const visibles = items.filter((n) => {
    if (filtro === 'pendientes' ? n.estado === 'firmada' : filtro !== 'todas' && n.estado !== filtro) return false
    if (!q) return true
    return `${n.apellido} ${n.nombre} ${n.dni ?? ''} ${n.datos.curso}`.toLowerCase().includes(q)
  })

  const filtros: { value: Filtro; label: string; cantidad: number }[] = [
    { value: 'pendientes', label: 'Pendientes', cantidad: pendientes },
    { value: 'por_imprimir', label: 'Por imprimir', cantidad: conteos.por_imprimir },
    { value: 'impresa', label: 'Impresas', cantidad: conteos.impresa },
    { value: 'entregada', label: 'Entregadas', cantidad: conteos.entregada },
    { value: 'firmada', label: 'Firmadas', cantidad: conteos.firmada },
    { value: 'todas', label: 'Todas', cantidad: items.length },
  ]

  const seleccionadas = items.filter((n) => seleccion.has(n.key))
  const porEstado = (e: EstadoNotificacion) => seleccionadas.filter((n) => n.estado === e)
  const todasMarcadas = visibles.length > 0 && visibles.every((n) => seleccion.has(n.key))

  function alternar(key: string) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function imprimir(lista: NotificacionItem[]) {
    navigate(RUTA_IMPRIMIR_NOTIFICACIONES, { state: { items: lista } })
  }

  const ocupado = avanzarMutation.isPending || revertirMutation.isPending

  return (
    <Box>
      {!tablaDisponible && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta crear la tabla de cartas en Supabase (migración 005). Mientras tanto se pueden ver e imprimir los pendientes, pero no queda registro de las cartas emitidas.
        </Alert>
      )}
      {!hayReglas && !isLoading && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={puedeConfigurar ? <Button color="inherit" size="small" onClick={alIrAReglas}>Ir a Reglas</Button> : undefined}
        >
          No hay reglas con "Notificar a los padres" activado, por eso no se generan notificaciones nuevas.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        {filtros.map((f) => (
          <Chip
            key={f.value}
            label={`${f.label} (${f.cantidad})`}
            color={filtro === f.value ? 'primary' : 'default'}
            variant={filtro === f.value ? 'filled' : 'outlined'}
            onClick={() => setFiltro(f.value)}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        <TextField
          size="small"
          placeholder="Buscar alumno o curso"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          sx={{ width: 240 }}
        />
      </Box>

      {seleccionadas.length > 0 && (
        <Card variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', bgcolor: 'action.hover' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mr: 1 }}>{seleccionadas.length} seleccionadas</Typography>
          {porEstado('por_imprimir').length > 0 && (
            <Button size="small" variant="contained" startIcon={<Print />} onClick={() => imprimir(porEstado('por_imprimir'))}>
              Generar cartas ({porEstado('por_imprimir').length})
            </Button>
          )}
          {porEstado('impresa').length > 0 && (
            <Button
              size="small"
              variant="contained"
              disabled={ocupado}
              onClick={() => avanzarMutation.mutate({ ids: porEstado('impresa').map((n) => n.registro!.id), estado: 'entregada' })}
            >
              Marcar entregadas ({porEstado('impresa').length})
            </Button>
          )}
          {porEstado('entregada').length > 0 && (
            <Button
              size="small"
              variant="contained"
              disabled={ocupado}
              onClick={() => avanzarMutation.mutate({ ids: porEstado('entregada').map((n) => n.registro!.id), estado: 'firmada' })}
            >
              Marcar firmadas ({porEstado('entregada').length})
            </Button>
          )}
          <Button size="small" onClick={() => setSeleccion(new Set())}>Limpiar</Button>
        </Card>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : visibles.length === 0 ? (
        <Card variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">
            {items.length === 0 ? 'Todavía no hay notificaciones.' : 'No hay notificaciones con ese filtro.'}
          </Typography>
        </Card>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={todasMarcadas}
                    indeterminate={!todasMarcadas && visibles.some((n) => seleccion.has(n.key))}
                    onChange={() => setSeleccion(todasMarcadas ? new Set() : new Set(visibles.map((n) => n.key)))}
                  />
                </TableCell>
                <TableCell>Alumno</TableCell>
                <TableCell>Curso</TableCell>
                <TableCell>Regla</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Última acción</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.map((n) => {
                const info = estadoInfo(n.estado)
                const siguiente = SIGUIENTE[n.estado]
                const diasSinFirma = n.estado === 'entregada' && n.registro?.entregada_at ? diasDesde(n.registro.entregada_at) : 0
                return (
                  <TableRow key={n.key} hover>
                    <TableCell padding="checkbox">
                      <Checkbox checked={seleccion.has(n.key)} onChange={() => alternar(n.key)} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{n.apellido}, {n.nombre}</TableCell>
                    <TableCell>{n.datos.curso || '—'}</TableCell>
                    <TableCell>
                      {n.tipo === 'no_regular' ? (
                        <>
                          <Chip size="small" color="error" label="Pasó a No Regular" />
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                            {formatNum(n.datos.regla_limite ?? 0)} inasistencias · {n.datos.periodo_texto}
                            {n.datos.no_regular_desde ? ` · desde el ${formatFecha(n.datos.no_regular_desde)}` : ''}
                          </Typography>
                        </>
                      ) : (
                        <>
                          {formatNum(n.limite)} inasistencias · {n.datos.periodo_texto}
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Tiene {formatNum(n.datos.periodo.total)} en el período · {formatNum(n.datos.ciclo.total)} en el ciclo
                          </Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell><Chip size="small" color={info.color} label={info.label} /></TableCell>
                    <TableCell>
                      {ultimaAccion(n)}
                      {diasSinFirma >= DIAS_ALERTA_FIRMA && (
                        <Chip size="small" color="warning" variant="outlined" label={`${diasSinFirma} días sin firma`} sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      {n.estado === 'por_imprimir' && (
                        <Button size="small" variant="contained" startIcon={<Print />} onClick={() => imprimir([n])}>Imprimir</Button>
                      )}
                      {siguiente && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={ocupado}
                          onClick={() => avanzarMutation.mutate({ ids: [n.registro!.id], estado: siguiente.estado })}
                        >
                          {siguiente.texto}
                        </Button>
                      )}
                      {n.estado !== 'por_imprimir' && (
                        <IconButton size="small" onClick={(e) => setMenu({ ancla: e.currentTarget, item: n })}>
                          <MoreVert fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Menu anchorEl={menu?.ancla} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            const item = menu!.item
            setMenu(null)
            imprimir([item])
          }}
        >
          Volver a imprimir
        </MenuItem>
        {menu && REVERSION[menu.item.estado] && (
          <MenuItem
            onClick={() => {
              const item = menu.item
              setMenu(null)
              revertirMutation.mutate(item)
            }}
          >
            {REVERSION[menu.item.estado]}
          </MenuItem>
        )}
      </Menu>
    </Box>
  )
}
