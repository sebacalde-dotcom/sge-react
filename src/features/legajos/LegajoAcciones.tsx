import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import { Archive, Unarchive, DeleteForever } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { esAdmin } from '@/lib/permisos'
import type { Persona } from './LegajoPage'

type Accion = 'archivar' | 'desarchivar' | 'eliminar'

const FUNCIONES: Record<Accion, string> = {
  archivar: 'archivar_legajo',
  desarchivar: 'desarchivar_legajo',
  eliminar: 'eliminar_legajo',
}

const mensajeError = (mensaje: string) =>
  /schema cache|does not exist|Could not find the function/i.test(mensaje)
    ? 'Falta correr la migración 011 en Supabase'
    : 'Error: ' + mensaje

export function LegajoAcciones({ persona }: { persona: Persona }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { personal } = useAuth()
  const [confirmando, setConfirmando] = useState<Accion | null>(null)
  const archivado = !!persona.archivado_at
  const nombre = `${persona.apellido}, ${persona.nombre}`
  // El personal solo se archiva: se conserva el historial de lo que registró
  const esPersonal = ['docente', 'preceptor', 'directivo', 'admin'].includes(persona.tipo)

  const mutation = useMutation({
    mutationFn: async (accion: Accion) => {
      const { error } = await supabase.rpc(FUNCIONES[accion], { p_persona: persona.id })
      if (error) throw error
      return accion
    },
    onSuccess: (accion) => {
      setConfirmando(null)
      for (const clave of [
        ['persona', persona.id],
        ['personas'],
        ['alumno-academico', persona.id],
        ['alumno-datos'],
        ['alumnos'],
        ['alumnos-curso'],
        ['ciclo-datos'],
        ['notificaciones'],
        ['legajos-pases'],
      ]) {
        queryClient.invalidateQueries({ queryKey: clave })
      }
      if (accion === 'archivar') {
        toast.success('Legajo archivado. Lo encontrás en Legajos → Tipo → Archivados')
        navigate('/legajos')
      } else if (accion === 'eliminar') {
        toast.success('Legajo eliminado')
        navigate('/legajos')
      } else {
        toast.success('Legajo restaurado')
      }
    },
    onError: (e) => toast.error(mensajeError(e.message)),
  })

  if (!esAdmin(personal?.rol)) return null

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        {archivado ? (
          <>
            <Button size="small" variant="outlined" startIcon={<Unarchive />} onClick={() => setConfirmando('desarchivar')}>
              Restaurar
            </Button>
            {!esPersonal && (
              <Button size="small" variant="outlined" color="error" startIcon={<DeleteForever />} onClick={() => setConfirmando('eliminar')}>
                Eliminar
              </Button>
            )}
          </>
        ) : (
          <Button size="small" variant="outlined" color="inherit" startIcon={<Archive />} onClick={() => setConfirmando('archivar')}>
            Archivar
          </Button>
        )}
      </Box>

      <Dialog open={confirmando === 'archivar'} onClose={() => setConfirmando(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Archivar legajo</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{nombre}</strong> deja de aparecer en las listas, planillas y tareas. Se conserva todo su historial y
            se puede restaurar cuando quieras desde Legajos → Tipo → Archivados.
          </Typography>
          {esPersonal && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              También pierde el acceso al sistema.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmando(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={18} /> : undefined}
            onClick={() => mutation.mutate('archivar')}
          >
            Archivar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmando === 'desarchivar'} onClose={() => setConfirmando(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Restaurar legajo</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{nombre}</strong> vuelve a aparecer en las listas, planillas y tareas.
          </Typography>
          {esPersonal && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              También recupera el acceso al sistema.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmando(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={18} /> : undefined}
            onClick={() => mutation.mutate('desarchivar')}
          >
            Restaurar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmando === 'eliminar'} onClose={() => setConfirmando(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Eliminar legajo</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography>
            ¿Eliminar definitivamente el legajo de <strong>{nombre}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Se borran sus datos, inasistencias, notificaciones, pases y reincorporaciones, y también los adultos
            responsables que no lo sean de otro alumno. Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmando(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={18} /> : undefined}
            onClick={() => mutation.mutate('eliminar')}
          >
            Eliminar definitivamente
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
