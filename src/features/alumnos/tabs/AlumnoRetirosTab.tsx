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
import { Add, Edit, Delete } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface Retiro {
  id: string
  nombre: string | null
  dni: string | null
  parentesco: string | null
}

interface RetiroForm {
  nombre: string
  dni: string
  parentesco: string
}

const EMPTY: RetiroForm = { nombre: '', dni: '', parentesco: '' }

export function AlumnoRetirosTab({ alumnoId }: { alumnoId: string }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Retiro | null>(null)
  const [form, setForm] = useState<RetiroForm>(EMPTY)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { data: retiros = [], isLoading } = useQuery({
    queryKey: ['retiros', alumnoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('persona_retiros')
        .select('*')
        .eq('alumno_persona_id', alumnoId)
      if (error) throw error
      return data as Retiro[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const row = {
        alumno_persona_id: alumnoId,
        nombre: form.nombre || null,
        dni: form.dni || null,
        parentesco: form.parentesco || null,
      }
      if (editing) {
        const { error } = await supabase.from('persona_retiros').update(row).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('persona_retiros').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Retiro actualizado' : 'Retiro agregado')
      queryClient.invalidateQueries({ queryKey: ['retiros', alumnoId] })
      closeDialog()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('persona_retiros').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Retiro eliminado')
      queryClient.invalidateQueries({ queryKey: ['retiros', alumnoId] })
      setDeleting(null)
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }

  function openEdit(r: Retiro) {
    setEditing(r)
    setForm({
      nombre: r.nombre ?? '',
      dni: r.dni ?? '',
      parentesco: r.parentesco ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditing(null)
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {retiros.length} {retiros.length === 1 ? 'persona autorizada' : 'personas autorizadas'}
        </Typography>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={openNew}>
          Agregar persona
        </Button>
      </Box>

      {retiros.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">No hay personas autorizadas para retiro</Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {retiros.map((r) => (
            <Card key={r.id} sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1">{r.nombre || 'Sin nombre'}</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {r.dni && <Typography variant="body2" color="text.secondary">DNI: {r.dni}</Typography>}
                  {r.parentesco && <Typography variant="body2" color="text.secondary">{r.parentesco}</Typography>}
                </Box>
              </Box>
              <IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small" /></IconButton>
              <IconButton size="small" color="error" onClick={() => setDeleting(r.id)}><Delete fontSize="small" /></IconButton>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar persona' : 'Nueva persona autorizada'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField label="Nombre completo" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus />
          <TextField label="DNI" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
          <TextField label="Parentesco" value={form.parentesco} onChange={(e) => setForm({ ...form, parentesco: e.target.value })} placeholder="Madre, Padre, Tío…" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog}>Cancelar</Button>
          <Button variant="contained" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>¿Eliminar persona autorizada?</DialogTitle>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending} onClick={() => deleting && deleteMutation.mutate(deleting)}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
