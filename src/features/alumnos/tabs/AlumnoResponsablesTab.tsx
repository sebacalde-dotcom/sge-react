import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
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
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Autocomplete from '@mui/material/Autocomplete'
import { Add, Delete, Edit, Phone, Email } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface ResponsableRow {
  id: string
  relacion: string
  es_contacto_emergencia: boolean
  responsable_persona_id: string
  personas: {
    id: string
    apellido: string
    nombre: string
    dni: string | null
    telefono: string | null
    email: string | null
  }
}

interface ResponsableForm {
  apellido: string
  nombre: string
  dni: string
  telefono: string
  email: string
  relacion: string
  es_contacto_emergencia: boolean
}

const EMPTY: ResponsableForm = {
  apellido: '', nombre: '', dni: '', telefono: '', email: '',
  relacion: '', es_contacto_emergencia: false,
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

const VINCULOS =['Madre', 'Padre', 'Tutor/a', 'Abuelo/a', 'Tío/a', 'Hermano/a', 'Otro']

interface Props {
  alumnoPersonaId: string
}

export function AlumnoResponsablesTab({ alumnoPersonaId }: Props) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { control, handleSubmit, reset } = useForm<ResponsableForm>({ defaultValues: EMPTY })

  const { data: responsables = [], isLoading } = useQuery({
    queryKey: ['responsables', alumnoPersonaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alumno_responsables')
        .select('id, relacion, es_contacto_emergencia, responsable_persona_id, personas:responsable_persona_id(id, apellido, nombre, dni, telefono, email)')
        .eq('alumno_persona_id', alumnoPersonaId)
      if (error) throw error
      return data as unknown as ResponsableRow[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: ResponsableForm) => {
      const dni = values.dni.trim()
      const personaData = {
        apellido: values.apellido,
        nombre: values.nombre,
        dni: dni || null,
        telefono: values.telefono || null,
        email: values.email || null,
        tipo: 'padre' as const,
      }

      if (editingId) {
        const row = responsables.find((r) => r.id === editingId)!
        const { error: personaError } = await supabase.from('personas').update(personaData).eq('id', row.responsable_persona_id)
        if (personaError) throw personaError
        const { error: vinculoError } = await supabase.from('alumno_responsables').update({
          relacion: values.relacion,
          es_contacto_emergencia: values.es_contacto_emergencia,
        }).eq('id', editingId)
        if (vinculoError) throw vinculoError
      } else {
        // Si el DNI ya existe (hermanos, o una carga anterior), se vincula a esa persona en vez de crear otra
        let responsableId: string | null = null
        if (dni) {
          const { data: existente, error: buscarError } = await supabase
            .from('personas')
            .select('id, apellido, nombre, telefono, email')
            .eq('dni', dni)
            .maybeSingle()
          if (buscarError) throw buscarError
          if (existente) {
            if (existente.id === alumnoPersonaId) throw new Error('Ese DNI es el del propio alumno')
            // Solo se reutiliza si es la misma persona: si el nombre no coincide, el DNI está mal o es de otra persona
            if (normalizar(existente.apellido) !== normalizar(values.apellido) || normalizar(existente.nombre) !== normalizar(values.nombre)) {
              throw new Error(
                `El DNI ${dni} ya está cargado a nombre de ${existente.apellido}, ${existente.nombre}. ` +
                  'Si es la misma persona, cargala con ese nombre; si no, revisá el DNI.',
              )
            }
            if (responsables.some((r) => r.responsable_persona_id === existente.id)) {
              throw new Error('Esa persona ya está cargada como adulto responsable de este alumno')
            }
            responsableId = existente.id
            // Solo completa el contacto que le faltaba; no pisa los datos que ya tenía
            const faltantes = {
              ...(!existente.telefono && personaData.telefono ? { telefono: personaData.telefono } : {}),
              ...(!existente.email && personaData.email ? { email: personaData.email } : {}),
            }
            if (Object.keys(faltantes).length > 0) {
              await supabase.from('personas').update(faltantes).eq('id', existente.id)
            }
          }
        }

        if (!responsableId) {
          const { data: newPersona, error } = await supabase
            .from('personas')
            .insert(personaData)
            .select('id')
            .single()
          if (error) throw error
          responsableId = newPersona.id
        }

        const { error: linkError } = await supabase.from('alumno_responsables').insert({
          alumno_persona_id: alumnoPersonaId,
          responsable_persona_id: responsableId,
          relacion: values.relacion,
          es_contacto_emergencia: values.es_contacto_emergencia,
        })
        if (linkError) throw linkError
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Responsable actualizado' : 'Responsable agregado')
      queryClient.invalidateQueries({ queryKey: ['responsables', alumnoPersonaId] })
      queryClient.invalidateQueries({ queryKey: ['alumno-emergencia', alumnoPersonaId] })
      closeDialog()
    },
    onError: (e) =>
      toast.error(e.message.includes('personas_dni_key') ? 'Ya existe otra persona con ese DNI' : 'Error: ' + e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alumno_responsables').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Responsable eliminado')
      queryClient.invalidateQueries({ queryKey: ['responsables', alumnoPersonaId] })
      queryClient.invalidateQueries({ queryKey: ['alumno-emergencia', alumnoPersonaId] })
      setDeleteId(null)
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function openNew() {
    setEditingId(null)
    reset(EMPTY)
    setDialogOpen(true)
  }

  function openEdit(row: ResponsableRow) {
    setEditingId(row.id)
    reset({
      apellido: row.personas.apellido,
      nombre: row.personas.nombre,
      dni: row.personas.dni ?? '',
      telefono: row.personas.telefono ?? '',
      email: row.personas.email ?? '',
      relacion: row.relacion,
      es_contacto_emergencia: row.es_contacto_emergencia,
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    reset(EMPTY)
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
          Adultos responsables
        </Typography>
        <Button size="small" startIcon={<Add />} onClick={openNew}>Agregar</Button>
      </Box>

      {responsables.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">No hay adultos responsables cargados</Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {responsables.map((r) => (
            <Card key={r.id} sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle1">
                      {r.personas.apellido}, {r.personas.nombre}
                    </Typography>
                    <Chip label={r.relacion} size="small" variant="outlined" />
                    {r.es_contacto_emergencia && (
                      <Chip label="Emergencia" size="small" color="error" variant="outlined" />
                    )}
                  </Box>
                  {r.personas.dni && (
                    <Typography variant="body2" color="text.secondary">DNI: {r.personas.dni}</Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 3, mt: 1 }}>
                    {r.personas.telefono && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">{r.personas.telefono}</Typography>
                      </Box>
                    )}
                    {r.personas.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">{r.personas.email}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
                <Box>
                  <IconButton size="small" onClick={() => openEdit(r)}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => setDeleteId(r.id)}><Delete fontSize="small" /></IconButton>
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <DialogTitle>{editingId ? 'Editar responsable' : 'Nuevo responsable'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Controller name="apellido" control={control} rules={{ required: 'Requerido' }} render={({ field, fieldState }) => (
                <TextField {...field} label="Apellido" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Controller name="nombre" control={control} rules={{ required: 'Requerido' }} render={({ field, fieldState }) => (
                <TextField {...field} label="Nombre" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
            </Box>
            <Controller name="dni" control={control} render={({ field }) => (
              <TextField {...field} label="DNI" />
            )} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Controller name="telefono" control={control} render={({ field }) => (
                <TextField {...field} label="Teléfono de contacto" />
              )} />
              <Controller name="email" control={control} render={({ field }) => (
                <TextField {...field} label="Mail de contacto" type="email" />
              )} />
            </Box>
            <Controller name="relacion" control={control} render={({ field }) => (
              <Autocomplete
                freeSolo
                options={VINCULOS}
                value={field.value}
                onChange={(_, v) => field.onChange(v ?? '')}
                onInputChange={(_, v) => field.onChange(v)}
                renderInput={(params) => <TextField {...params} label="Vínculo" placeholder="Madre, padre, tutor/a, abuelo/a…" />}
              />
            )} />
            <Controller name="es_contacto_emergencia" control={control} render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={field.onChange} />}
                label="Contacto de emergencia"
              />
            )} />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : 'Guardar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Eliminar responsable</DialogTitle>
        <DialogContent>
          <Typography>¿Confirmar eliminación? Se desvinculará del alumno.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
