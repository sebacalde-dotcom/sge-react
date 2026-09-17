import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Add, Search, Edit, Delete, Phone, Email } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'

interface PersonalRow {
  id: string
  apellido: string
  nombre: string
  dni: string | null
  fecha_nac: string | null
  rol: string
  mail: string | null
  telefono: string | null
  calle: string | null
  numero: string | null
  piso: string | null
  depto: string | null
  cp: string | null
  localidad: string | null
  provincia: string | null
  foto_url: string | null
  eliminado: boolean
}

interface PersonalForm {
  apellido: string
  nombre: string
  dni: string
  fecha_nac: string
  rol: string
  mail: string
  telefono: string
  calle: string
  numero: string
  piso: string
  depto: string
  cp: string
  localidad: string
  provincia: string
}

const EMPTY: PersonalForm = {
  apellido: '', nombre: '', dni: '', fecha_nac: '', rol: 'docente',
  mail: '', telefono: '',
  calle: '', numero: '', piso: '', depto: '', cp: '', localidad: '', provincia: '',
}

const ROL_LABELS: Record<string, string> = {
  admin: 'Administrador',
  directivo: 'Directivo',
  docente: 'Docente',
  preceptor: 'Preceptor',
}

const ROL_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'info'> = {
  admin: 'primary',
  directivo: 'secondary',
  docente: 'info',
  preceptor: 'success',
}

export function PersonalPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [rolFilter, setRolFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { control, handleSubmit, reset } = useForm<PersonalForm>({ defaultValues: EMPTY })

  const { data: personal = [], isLoading } = useQuery({
    queryKey: ['personal-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personal')
        .select('*')
        .eq('eliminado', false)
        .order('apellido')
      if (error) throw error
      return data as PersonalRow[]
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (values: PersonalForm) => {
      const row = {
        apellido: values.apellido,
        nombre: values.nombre,
        dni: values.dni || null,
        fecha_nac: values.fecha_nac || null,
        rol: values.rol,
        mail: values.mail || null,
        telefono: values.telefono || null,
        calle: values.calle || null,
        numero: values.numero || null,
        piso: values.piso || null,
        depto: values.depto || null,
        cp: values.cp || null,
        localidad: values.localidad || null,
        provincia: values.provincia || null,
      }

      if (editingId) {
        const { error } = await supabase.from('personal').update(row).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('personal').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success(editingId ? 'Personal actualizado' : 'Personal agregado')
      queryClient.invalidateQueries({ queryKey: ['personal-list'] })
      closeDialog()
    },
    onError: (e) => {
      if (e.message.includes('duplicate') && e.message.includes('mail')) {
        toast.error('Ya existe un personal con ese email')
      } else if (e.message.includes('duplicate') && e.message.includes('dni')) {
        toast.error('Ya existe un personal con ese DNI')
      } else {
        toast.error('Error: ' + e.message)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personal').update({ eliminado: true }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Personal eliminado')
      queryClient.invalidateQueries({ queryKey: ['personal-list'] })
      setDeleteId(null)
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function openNew() {
    setEditingId(null)
    reset(EMPTY)
    setDialogOpen(true)
  }

  function openEdit(row: PersonalRow) {
    setEditingId(row.id)
    reset({
      apellido: row.apellido,
      nombre: row.nombre,
      dni: row.dni ?? '',
      fecha_nac: row.fecha_nac ?? '',
      rol: row.rol,
      mail: row.mail ?? '',
      telefono: row.telefono ?? '',
      calle: row.calle ?? '',
      numero: row.numero ?? '',
      piso: row.piso ?? '',
      depto: row.depto ?? '',
      cp: row.cp ?? '',
      localidad: row.localidad ?? '',
      provincia: row.provincia ?? '',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setEditingId(null)
    reset(EMPTY)
  }

  const filtered = personal.filter((p) => {
    const matchSearch = !search ||
      `${p.apellido} ${p.nombre}`.toLowerCase().includes(search.toLowerCase()) ||
      (p.dni && p.dni.includes(search)) ||
      (p.mail && p.mail.toLowerCase().includes(search.toLowerCase()))
    const matchRol = !rolFilter || p.rol === rolFilter
    return matchSearch && matchRol
  })

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Personal</Typography>
          <Typography variant="body2" color="text.secondary">
            {personal.length} {personal.length === 1 ? 'persona' : 'personas'}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openNew}>
          Nuevo
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Buscar por nombre, DNI o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
            },
          }}
        />
        <TextField
          select
          label="Rol"
          value={rolFilter}
          onChange={(e) => setRolFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="admin">Administrador</MenuItem>
          <MenuItem value="directivo">Directivo</MenuItem>
          <MenuItem value="docente">Docente</MenuItem>
          <MenuItem value="preceptor">Preceptor</MenuItem>
        </TextField>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">
            {personal.length === 0 ? 'No hay personal cargado' : 'No se encontraron resultados'}
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map((p) => (
            <Card
              key={p.id}
              sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}
            >
              <Avatar
                src={p.foto_url ?? undefined}
                sx={{ width: 42, height: 42, bgcolor: 'primary.light', fontSize: '0.85rem' }}
              >
                {p.apellido[0]}{p.nombre[0]}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
                  {p.apellido}, {p.nombre}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  {p.dni && (
                    <Typography variant="body2" color="text.secondary">DNI: {p.dni}</Typography>
                  )}
                  {p.mail && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Email sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">{p.mail}</Typography>
                    </Box>
                  )}
                  {p.telefono && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">{p.telefono}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
              <Chip
                label={ROL_LABELS[p.rol] ?? p.rol}
                size="small"
                color={ROL_COLORS[p.rol] ?? 'default'}
                variant="outlined"
              />
              <IconButton size="small" onClick={() => openEdit(p)}>
                <Edit fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => setDeleteId(p.id)}>
                <Delete fontSize="small" />
              </IconButton>
            </Card>
          ))}
        </Box>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <DialogTitle>{editingId ? 'Editar personal' : 'Nuevo personal'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
              Datos personales
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Controller name="apellido" control={control} rules={{ required: 'Requerido' }} render={({ field, fieldState }) => (
                <TextField {...field} label="Apellido" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
              <Controller name="nombre" control={control} rules={{ required: 'Requerido' }} render={({ field, fieldState }) => (
                <TextField {...field} label="Nombre" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Controller name="dni" control={control} render={({ field }) => (
                <TextField {...field} label="DNI" />
              )} />
              <Controller name="fecha_nac" control={control} render={({ field }) => (
                <TextField {...field} label="Fecha de nacimiento" type="date" slotProps={{ inputLabel: { shrink: true } }} />
              )} />
            </Box>
            <Controller name="rol" control={control} render={({ field }) => (
              <TextField {...field} select label="Rol">
                <MenuItem value="admin">Administrador</MenuItem>
                <MenuItem value="directivo">Directivo</MenuItem>
                <MenuItem value="docente">Docente</MenuItem>
                <MenuItem value="preceptor">Preceptor</MenuItem>
              </TextField>
            )} />

            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', mt: 1 }}>
              Contacto
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Controller name="mail" control={control} render={({ field }) => (
                <TextField {...field} label="E-mail" type="email" />
              )} />
              <Controller name="telefono" control={control} render={({ field }) => (
                <TextField {...field} label="Teléfono" />
              )} />
            </Box>

            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', mt: 1 }}>
              Domicilio
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 2 }}>
              <Controller name="calle" control={control} render={({ field }) => (
                <TextField {...field} label="Calle" />
              )} />
              <Controller name="numero" control={control} render={({ field }) => (
                <TextField {...field} label="Número" />
              )} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <Controller name="piso" control={control} render={({ field }) => (
                <TextField {...field} label="Piso / Dpto" />
              )} />
              <Controller name="localidad" control={control} render={({ field }) => (
                <TextField {...field} label="Localidad" />
              )} />
              <Controller name="cp" control={control} render={({ field }) => (
                <TextField {...field} label="Código Postal" />
              )} />
            </Box>
            <Controller name="provincia" control={control} render={({ field }) => (
              <TextField {...field} label="Provincia" />
            )} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeDialog}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <CircularProgress size={20} /> : 'Guardar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Dialog confirmar eliminación */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>¿Eliminar personal?</DialogTitle>
        <DialogContent>
          <Typography>Se marcará como eliminado. No se borrará permanentemente.</Typography>
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
