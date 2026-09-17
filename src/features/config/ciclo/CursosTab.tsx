import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { Add, Edit, Delete } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'

interface Seccion {
  id: string
  nombre: string
}

interface Curso {
  id: string
  nombre: string
  division: string | null
  seccion_id: string | null
  secciones: Seccion | null
}

interface CursoForm {
  nombre: string
  division: string
  seccion_id: string
}

const EMPTY_FORM: CursoForm = { nombre: '', division: '', seccion_id: '' }

export function CursosTab() {
  const { cicloId } = useCiclo()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Curso | null>(null)
  const [form, setForm] = useState<CursoForm>(EMPTY_FORM)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: secciones = [] } = useQuery({
    queryKey: ['secciones', cicloId],
    queryFn: async () => {
      if (!cicloId) return []
      const { data, error } = await supabase
        .from('secciones')
        .select('id, nombre')
        .eq('ciclo_id', cicloId)
        .order('nombre')
      if (error) throw error
      return data as Seccion[]
    },
    enabled: !!cicloId,
  })

  const { data: cursos = [], isLoading } = useQuery({
    queryKey: ['cursos', cicloId],
    queryFn: async () => {
      if (!cicloId) return []
      const { data, error } = await supabase
        .from('cursos')
        .select('*, secciones(id, nombre)')
        .eq('ciclo_id', cicloId)
        .order('nombre')
      if (error) throw error
      return data as Curso[]
    },
    enabled: !!cicloId,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const row = {
        ciclo_id: cicloId!,
        nombre: form.nombre,
        division: form.division || null,
        seccion_id: form.seccion_id || null,
      }
      if (editing) {
        const { error } = await supabase.from('cursos').update(row).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('cursos').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Curso actualizado' : 'Curso creado')
      queryClient.invalidateQueries({ queryKey: ['cursos', cicloId] })
      closeDialog()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cursos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Curso eliminado')
      queryClient.invalidateQueries({ queryKey: ['cursos', cicloId] })
      setDeleting(null)
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(c: Curso) {
    setEditing(c)
    setForm({
      nombre: c.nombre,
      division: c.division ?? '',
      seccion_id: c.seccion_id ?? '',
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
          {cursos.length} {cursos.length === 1 ? 'curso' : 'cursos'}
        </Typography>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={openNew}>
          Nuevo curso
        </Button>
      </Box>

      {cursos.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">No hay cursos cargados</Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {cursos.map((c) => (
            <Card key={c.id} sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1">
                    {c.nombre}{c.division ? ` ${c.division}` : ''}
                  </Typography>
                  {c.secciones && (
                    <Chip label={c.secciones.nombre} size="small" variant="outlined" />
                  )}
                </Box>
              </Box>
              <IconButton size="small" onClick={() => openEdit(c)}>
                <Edit fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => setDeleting(c.id)}>
                <Delete fontSize="small" />
              </IconButton>
            </Card>
          ))}
        </Box>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar curso' : 'Nuevo curso'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField
            label="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            autoFocus
            placeholder="Ej: 1° Año"
          />
          <TextField
            label="División"
            value={form.division}
            onChange={(e) => setForm({ ...form, division: e.target.value })}
            placeholder="Ej: A, B, I"
          />
          <TextField
            select
            label="Sección"
            value={form.seccion_id}
            onChange={(e) => setForm({ ...form, seccion_id: e.target.value })}
          >
            <MenuItem value="">Sin sección</MenuItem>
            {secciones.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>
            ))}
          </TextField>
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
        <DialogTitle>¿Eliminar curso?</DialogTitle>
        <DialogContent>
          <Typography>Se eliminarán también los alumnos y materias asociadas a este curso.</Typography>
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
