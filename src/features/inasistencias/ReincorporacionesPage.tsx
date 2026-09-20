import { useState } from 'react'
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
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { ArrowBack, Delete } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCiclo } from '@/contexts/CicloContext'
import { esAdmin } from '@/lib/permisos'
import { formatFecha, formatNum } from './notificaciones/carta'
import { etiquetaPeriodo } from './notificaciones/periodos'
import { hoyISO, useRegularidad, type AlumnoRegularidad } from './useRegularidad'
import { mismaRegla, type ReglaRegularidad } from './regularidad'
import type { ReincorporacionFila } from './datosCiclo'

const nombreCompleto = (p: { apellido: string; nombre: string } | null) => (p ? `${p.apellido}, ${p.nombre}` : '—')

const textoRegla = (r: ReglaRegularidad) => `${formatNum(r.limite)} inasistencias en ${etiquetaPeriodo(r.periodo)}`

function reglasInfringidas(a: AlumnoRegularidad): ReglaRegularidad[] {
  const reglas: ReglaRegularidad[] = []
  for (const i of a.estado.infracciones) if (!reglas.some((r) => mismaRegla(r, i.regla))) reglas.push(i.regla)
  return reglas
}

export function ReincorporacionesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { personal } = useAuth()
  const { cicloId } = useCiclo()
  const puedeReincorporar = esAdmin(personal?.rol)
  const { alumnos, noRegulares, reincorporaciones, isLoading, tablaDisponible, soportaReglas } = useRegularidad()

  const [objetivo, setObjetivo] = useState<AlumnoRegularidad | null>(null)
  const [fecha, setFecha] = useState(hoyISO())
  const [observaciones, setObservaciones] = useState('')
  const [aEliminar, setAEliminar] = useState<ReincorporacionFila | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['ciclo-datos'] })

  const reincorporarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('reincorporaciones').insert({
        persona_id: objetivo!.persona_id,
        ciclo_id: cicloId!,
        fecha,
        observaciones: observaciones.trim() || null,
        autorizada_por: personal?.id ?? null,
        ...(soportaReglas ? { reglas: reglasInfringidas(objetivo!) } : {}),
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`${objetivo?.apellido}, ${objetivo?.nombre} fue reincorporado/a`)
      setObjetivo(null)
      refrescar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const eliminarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('reincorporaciones').delete().eq('id', aEliminar!.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo eliminar (sin permisos en la base)')
    },
    onSuccess: () => {
      toast.success('Reincorporación eliminada')
      setAEliminar(null)
      refrescar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function abrirReincorporar(a: AlumnoRegularidad) {
    setObjetivo(a)
    setFecha(hoyISO())
    setObservaciones('')
  }

  const cursoPorPersona = new Map(alumnos.map((a) => [a.persona_id, a.curso]))
  const q = busqueda.trim().toLowerCase()
  const coincide = (texto: string) => !q || texto.toLowerCase().includes(q)
  const noRegularesVisibles = noRegulares.filter((a) => coincide(`${a.apellido} ${a.nombre} ${a.dni ?? ''} ${a.curso}`))
  const historialVisible = reincorporaciones.filter((r) =>
    coincide(`${nombreCompleto(r.personas)} ${r.personas?.dni ?? ''} ${cursoPorPersona.get(r.persona_id) ?? ''}`),
  )

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/inasistencias')}><ArrowBack /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Reincorporaciones</Typography>
          <Typography variant="body2" color="text.secondary">
            Alumnos No Regulares y decisiones de reincorporación del Director
          </Typography>
        </Box>
        <TextField size="small" placeholder="Buscar alumno o curso" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} sx={{ width: 240 }} />
      </Box>

      {!tablaDisponible && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta crear la tabla de reincorporaciones en Supabase (migración 007). Hasta entonces se ven los alumnos No
          Regulares, pero no se pueden reincorporar.
        </Alert>
      )}
      {tablaDisponible && !soportaReglas && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta correr la migración 008 en Supabase. Hasta entonces, cada reincorporación reinicia el conteo de todas las
          reglas y no solo el de la que se infringió.
        </Alert>
      )}
      {!puedeReincorporar && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Solo el Director (administradores y directivos) puede reincorporar alumnos.
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          <Card variant="outlined" sx={{ mb: 3, borderRadius: 2, overflow: 'auto' }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontWeight: 700 }}>No Regulares</Typography>
              <Chip size="small" label={noRegulares.length} color={noRegulares.length > 0 ? 'error' : 'default'} />
            </Box>
            {noRegularesVisibles.length === 0 ? (
              <Typography color="text.disabled" sx={{ p: 3, textAlign: 'center' }}>
                {noRegulares.length === 0 ? 'No hay alumnos No Regulares.' : 'No hay resultados para la búsqueda.'}
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Alumno</TableCell>
                    <TableCell>Curso</TableCell>
                    <TableCell>No Regular desde</TableCell>
                    <TableCell>Regla</TableCell>
                    <TableCell>Última reincorporación</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {noRegularesVisibles.map((a) => {
                    const infr = a.estado.infracciones[0]
                    return (
                      <TableRow key={a.persona_id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{a.apellido}, {a.nombre}</TableCell>
                        <TableCell>{a.curso || '—'}</TableCell>
                        <TableCell>{a.estado.noRegularDesde ? formatFecha(a.estado.noRegularDesde) : '—'}</TableCell>
                        <TableCell>
                          {reglasInfringidas(a).map((r) => (
                            <Box key={`${r.limite}_${r.periodo}`}>{textoRegla(r)}</Box>
                          ))}
                          {infr && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              Tiene {formatNum(infr.total)} en el período de la primera
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{a.ultimaReincorporacion ? formatFecha(a.ultimaReincorporacion) : 'Nunca'}</TableCell>
                        <TableCell align="right">
                          {puedeReincorporar && (
                            <Button size="small" variant="contained" disabled={!tablaDisponible} onClick={() => abrirReincorporar(a)}>
                              Reincorporar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'auto' }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontWeight: 700 }}>Historial de reincorporaciones</Typography>
              <Chip size="small" label={reincorporaciones.length} />
            </Box>
            {historialVisible.length === 0 ? (
              <Typography color="text.disabled" sx={{ p: 3, textAlign: 'center' }}>
                {reincorporaciones.length === 0 ? 'Todavía no hay reincorporaciones en este ciclo.' : 'No hay resultados para la búsqueda.'}
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Alumno</TableCell>
                    <TableCell>Curso</TableCell>
                    <TableCell>Reinició</TableCell>
                    <TableCell>Autorizada por</TableCell>
                    <TableCell>Observaciones</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historialVisible.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{formatFecha(r.fecha)}</TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{nombreCompleto(r.personas)}</TableCell>
                      <TableCell>{cursoPorPersona.get(r.persona_id) || '—'}</TableCell>
                      <TableCell>
                        {r.reglas ? (r.reglas.length ? r.reglas.map(textoRegla).join(' · ') : '—') : 'Todas las reglas'}
                      </TableCell>
                      <TableCell>{nombreCompleto(r.personal)}</TableCell>
                      <TableCell>{r.observaciones ?? '—'}</TableCell>
                      <TableCell align="right">
                        {puedeReincorporar && (
                          <IconButton size="small" color="error" onClick={() => setAEliminar(r)} aria-label="Eliminar reincorporación">
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}

      <Dialog open={!!objetivo} onClose={() => setObjetivo(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reincorporar a {objetivo?.apellido}, {objetivo?.nombre}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary">
            El alumno vuelve a Regular. Desde la fecha elegida empieza de nuevo el conteo de{' '}
            {soportaReglas && objetivo ? (
              <>
                la regla que infringió (<strong>{reglasInfringidas(objetivo).map(textoRegla).join(' y ')}</strong>). Las
                demás reglas siguen contando lo que venían contando.
              </>
            ) : (
              'todas las reglas.'
            )}{' '}
            Las inasistencias anteriores no se borran.
          </Typography>
          <TextField
            type="date"
            label="Fecha de reincorporación"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Observaciones (opcional)"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setObjetivo(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!fecha || reincorporarMutation.isPending}
            startIcon={reincorporarMutation.isPending ? <CircularProgress size={18} /> : undefined}
            onClick={() => reincorporarMutation.mutate()}
          >
            Reincorporar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!aEliminar} onClose={() => setAEliminar(null)}>
        <DialogTitle>Eliminar reincorporación</DialogTitle>
        <DialogContent>
          <Typography>
            Se elimina la reincorporación de <strong>{nombreCompleto(aEliminar?.personas ?? null)}</strong> del{' '}
            {aEliminar ? formatFecha(aEliminar.fecha) : ''}. Si sus inasistencias superan alguna regla, volverá a figurar como No Regular.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAEliminar(null)}>Cancelar</Button>
          <Button color="error" disabled={eliminarMutation.isPending} onClick={() => eliminarMutation.mutate()}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
