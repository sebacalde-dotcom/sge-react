import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { Add, Edit, Delete } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'

interface Seccion {
  id: string
  nombre: string
  seccion: string | null
  descripcion: string | null
  titulo_obtenido: string | null
}

interface SeccionForm {
  nombre: string
  seccion: string
  descripcion: string
  titulo_obtenido: string
}

const EMPTY_FORM: SeccionForm = { nombre: '', seccion: '', descripcion: '', titulo_obtenido: '' }

export function SeccionesTab() {
  const { cicloId } = useCiclo()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Seccion | null>(null)
  const [form, setForm] = useState<SeccionForm>(EMPTY_FORM)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: secciones = [], isLoading } = useQuery({
    queryKey: ['secciones', cicloId],
    queryFn: async () => {
      if (!cicloId) return []
      const { data, error } = await supabase
        .from('secciones')
        .select('*')
        .eq('ciclo_id', cicloId)
        .order('nombre')
      if (error) throw error
      return data as Seccion[]
    },
    enabled: !!cicloId,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const row = {
        ciclo_id: cicloId!,
        nombre: form.nombre,
        seccion: form.seccion || null,
        descripcion: form.descripcion || null,
        titulo_obtenido: form.titulo_obtenido || null,
      }
      if (editing) {
        const { error } = await supabase.from('secciones').update(row).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('secciones').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Sección actualizada' : 'Sección creada')
      queryClient.invalidateQueries({ queryKey: ['secciones', cicloId] })
      closeDialog()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('secciones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Sección eliminada')
      queryClient.invalidateQueries({ queryKey: ['secciones', cicloId] })
      setDeleting(null)
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(s: Seccion) {
    setEditing(s)
    setForm({
      nombre: s.nombre,
      seccion: s.seccion ?? '',
      descripcion: s.descripcion ?? '',
      titulo_obtenido: s.titulo_obtenido ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
  }

  if (!cicloId) {
    return <Alert severity="warning">Primero creá un ciclo lectivo en la pestaña General.</Alert>
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {secciones.length} {secciones.length === 1 ? 'sección' : 'secciones'}
        </Typography>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={openNew}>
          Nueva sección
        </Button>
      </Box>

      {secciones.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">No hay secciones cargadas</Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {secciones.map((s) => (
            <Card key={s.id} sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">{s.nombre}</Typography>
                {s.seccion && (
                  <Typography variant="body2" color="text.secondary">Sección: {s.seccion}</Typography>
                )}
                {s.titulo_obtenido && (
                  <Typography variant="body2" color="text.secondary">Título: {s.titulo_obtenido}</Typography>
                )}
              </Box>
              <IconButton size="small" onClick={() => openEdit(s)}>
                <Edit fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => setDeleting(s.id)}>
                <Delete fontSize="small" />
              </IconButton>
            </Card>
          ))}
        </Box>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar sección' : 'Nueva sección'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            autoFocus
          />
          <TextField
            label="Sección (letra/número)"
            value={form.seccion}
            onChange={(e) => setForm({ ...form, seccion: e.target.value })}
          />
          <TextField
            label="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            multiline
            rows={2}
          />
          <TextField
            label="Título obtenido"
            value={form.titulo_obtenido}
            onChange={(e) => setForm({ ...form, titulo_obtenido: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!form.nombre.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog confirmar eliminación */}
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>¿Eliminar sección?</DialogTitle>
        <DialogContent>
          <Typography>Se eliminarán también los cursos asociados a esta sección.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleting && deleteMutation.mutate(deleting)}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
