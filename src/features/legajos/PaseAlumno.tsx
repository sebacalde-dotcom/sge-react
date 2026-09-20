import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { esAdmin } from '@/lib/permisos'

interface Pase {
  id: string
  fecha: string
  colegio_destino: string | null
  motivo: string | null
}

const hoy = () => new Date().toISOString().slice(0, 10)
const formatFecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function PaseAlumno({ personaId, nombre }: { personaId: string; nombre: string }) {
  const queryClient = useQueryClient()
  const { personal } = useAuth()
  const puedeGestionar = esAdmin(personal?.rol)
  const [registrando, setRegistrando] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [fecha, setFecha] = useState(hoy())
  const [destino, setDestino] = useState('')
  const [motivo, setMotivo] = useState('')

  const { data: pase } = useQuery({
    queryKey: ['alumno-pase', personaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pases')
        .select('id, fecha, colegio_destino, motivo')
        .eq('persona_id', personaId)
        .is('anulado_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) return null
      return (data?.[0] ?? null) as Pase | null
    },
  })

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['alumno-pase', personaId] })
    queryClient.invalidateQueries({ queryKey: ['legajos-pases'] })
    queryClient.invalidateQueries({ queryKey: ['ciclo-datos'] })
    queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
    queryClient.invalidateQueries({ queryKey: ['alumno-datos'] })
  }

  const registrarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_pase', {
        p_persona: personaId,
        p_fecha: fecha,
        p_destino: destino,
        p_motivo: motivo,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Pase registrado')
      setRegistrando(false)
      refrescar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const anularMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('anular_pase', { p_persona: personaId })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Pase anulado: el alumno vuelve a estar activo')
      setAnulando(false)
      refrescar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function abrirRegistro() {
    setFecha(hoy())
    setDestino('')
    setMotivo('')
    setRegistrando(true)
  }

  return (
    <>
      {pase && (
        <Chip
          size="small"
          color="warning"
          label={`Pase · ${formatFecha(pase.fecha)}${pase.colegio_destino ? ` · ${pase.colegio_destino}` : ''}`}
        />
      )}
      {puedeGestionar && !pase && (
        <Button size="small" variant="outlined" onClick={abrirRegistro}>Registrar pase</Button>
      )}
      {puedeGestionar && pase && (
        <Button size="small" color="inherit" onClick={() => setAnulando(true)}>Anular pase</Button>
      )}

      <Dialog open={registrando} onClose={() => setRegistrando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Registrar pase de {nombre}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary">
            El alumno deja de figurar en las planillas y las tareas. Su legajo y su historial de inasistencias se
            conservan, y queda en Ex alumnos.
          </Typography>
          <TextField
            type="date"
            label="Fecha del pase"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField label="Colegio de destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
          <TextField label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} multiline minRows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRegistrando(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!fecha || registrarMutation.isPending}
            startIcon={registrarMutation.isPending ? <CircularProgress size={18} /> : undefined}
            onClick={() => registrarMutation.mutate()}
          >
            Registrar pase
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={anulando} onClose={() => setAnulando(false)}>
        <DialogTitle>Anular pase</DialogTitle>
        <DialogContent>
          <Box>
            <Typography>
              El pase de <strong>{nombre}</strong> queda anulado (se conserva en el registro) y el alumno vuelve a estar activo.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAnulando(false)}>Cancelar</Button>
          <Button color="error" disabled={anularMutation.isPending} onClick={() => anularMutation.mutate()}>Anular pase</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
