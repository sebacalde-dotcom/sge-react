import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { Save, Add } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { usePermisos } from '@/hooks/usePermisos'
import { ROLES, type UserRole } from '@/lib/constants'
import type { Persona } from '../LegajoPage'

interface PersonaForm {
  apellido: string
  nombre: string
  dni: string
  fecha_nac: string
  sexo: string
  nacionalidad: string
  calle: string
  numero: string
  piso: string
  depto: string
  localidad: string
  barrio: string
  cp: string
  provincia: string
  telefono: string
  email: string
}

const EMPTY: PersonaForm = {
  apellido: '', nombre: '', dni: '', fecha_nac: '', sexo: '', nacionalidad: '',
  calle: '', numero: '', piso: '', depto: '', localidad: '', barrio: '', cp: '', provincia: '',
  telefono: '', email: '',
}

interface Props {
  persona: Persona | null
  tipo: string
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
      {children}
    </Typography>
  )
}

// Tipos de legajo a los que tiene sentido darles acceso al sistema (no alumnos ni padres: eso es el portal de familias)
const TIPOS_CON_ACCESO = ['docente', 'preceptor', 'directivo', 'otro']

/** Quién puede entrar a este legajo y con qué rol. Darle o quitarle el rol es lo que lo invita o le quita el acceso. */
function AccesoSistemaCard({ persona }: { persona: Persona }) {
  const queryClient = useQueryClient()
  const { esAdmin } = usePermisos()

  const cambiarRolMutation = useMutation({
    mutationFn: async (rol: UserRole | '') => {
      const { data, error } = await supabase.from('personas').update({ rol: rol || null }).eq('id', persona.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo guardar (sin permisos en la base)')
    },
    onSuccess: () => {
      toast.success('Acceso actualizado')
      queryClient.invalidateQueries({ queryKey: ['persona', persona.id] })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <SectionTitle>Acceso al sistema</SectionTitle>
      <TextField
        select
        label="Rol"
        value={persona.rol ?? ''}
        disabled={!esAdmin || cambiarRolMutation.isPending}
        onChange={(e) => cambiarRolMutation.mutate(e.target.value as UserRole | '')}
        helperText={esAdmin ? 'Solo admin y directivos pueden cambiarlo.' : 'Pedile a un admin o directivo que lo cambie.'}
        sx={{ minWidth: 260 }}
      >
        <MenuItem value="">Sin acceso al sistema</MenuItem>
        {(Object.keys(ROLES) as UserRole[]).map((rol) => (
          <MenuItem key={rol} value={rol}>{ROLES[rol].label}</MenuItem>
        ))}
      </TextField>

      {persona.rol && (
        <Box sx={{ mt: 2 }}>
          {persona.auth_user_id ? (
            <Alert severity="success" sx={{ py: 0 }}>Ya inició sesión con este acceso.</Alert>
          ) : !persona.email ? (
            <Alert severity="warning" sx={{ py: 0 }}>Cargá un e-mail arriba para que pueda entrar.</Alert>
          ) : (
            <Alert severity="info" sx={{ py: 0 }}>
              Todavía no inició sesión. Decile que entre con Google usando <strong>{persona.email}</strong>.
            </Alert>
          )}
        </Box>
      )}
    </Card>
  )
}

export function PersonalFichaTab({ persona, tipo }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !persona

  const { control, handleSubmit, reset } = useForm<PersonaForm>({ defaultValues: EMPTY })

  useEffect(() => {
    if (persona) {
      reset({
        apellido: persona.apellido ?? '',
        nombre: persona.nombre ?? '',
        dni: persona.dni ?? '',
        fecha_nac: persona.fecha_nac ?? '',
        sexo: persona.sexo ?? '',
        nacionalidad: persona.nacionalidad ?? '',
        calle: persona.calle ?? '',
        numero: persona.numero ?? '',
        piso: persona.piso ?? '',
        depto: persona.depto ?? '',
        localidad: persona.localidad ?? '',
        barrio: persona.barrio ?? '',
        cp: persona.cp ?? '',
        provincia: persona.provincia ?? '',
        telefono: persona.telefono ?? '',
        email: persona.email ?? '',
      })
    }
  }, [persona, reset])

  const saveMutation = useMutation({
    mutationFn: async (values: PersonaForm) => {
      const row = {
        apellido: values.apellido,
        nombre: values.nombre,
        dni: values.dni || null,
        fecha_nac: values.fecha_nac || null,
        sexo: values.sexo || null,
        nacionalidad: values.nacionalidad || null,
        calle: values.calle || null,
        numero: values.numero || null,
        piso: values.piso || null,
        depto: values.depto || null,
        localidad: values.localidad || null,
        barrio: values.barrio || null,
        cp: values.cp || null,
        provincia: values.provincia || null,
        telefono: values.telefono || null,
        email: values.email || null,
        tipo: tipo as 'docente' | 'preceptor' | 'directivo' | 'padre' | 'otro',
      }

      if (isNew) {
        const { data, error } = await supabase.from('personas').insert(row).select('id').single()
        if (error) throw error
        return data.id as string
      } else {
        const { error } = await supabase.from('personas').update(row).eq('id', persona!.id)
        if (error) throw error
        return persona!.id
      }
    },
    onSuccess: (personaId) => {
      toast.success(isNew ? 'Legajo creado' : 'Legajo actualizado')
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      queryClient.invalidateQueries({ queryKey: ['persona', personaId] })
      if (isNew) navigate(`/legajos/${personaId}`, { replace: true })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  return (
    <>
    <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
      <Card sx={{ p: 3, mb: 3 }}>
        <SectionTitle>Datos personales</SectionTitle>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
          <Controller name="apellido" control={control} rules={{ required: 'Requerido' }} render={({ field, fieldState }) => (
            <TextField {...field} label="Apellido" error={!!fieldState.error} helperText={fieldState.error?.message} />
          )} />
          <Controller name="nombre" control={control} rules={{ required: 'Requerido' }} render={({ field, fieldState }) => (
            <TextField {...field} label="Nombre" error={!!fieldState.error} helperText={fieldState.error?.message} />
          )} />
          <Controller name="dni" control={control} render={({ field }) => (
            <TextField {...field} label="DNI" />
          )} />
          <Controller name="fecha_nac" control={control} render={({ field }) => (
            <TextField {...field} label="Fecha de nacimiento" type="date" slotProps={{ inputLabel: { shrink: true } }} />
          )} />
          <Controller name="sexo" control={control} render={({ field }) => (
            <TextField {...field} select label="Sexo">
              <MenuItem value="">—</MenuItem>
              <MenuItem value="M">Masculino</MenuItem>
              <MenuItem value="F">Femenino</MenuItem>
              <MenuItem value="X">No binario</MenuItem>
            </TextField>
          )} />
          <Controller name="nacionalidad" control={control} render={({ field }) => (
            <TextField {...field} label="Nacionalidad" />
          )} />
        </Box>
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <SectionTitle>Domicilio</SectionTitle>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2.5 }}>
          <Controller name="calle" control={control} render={({ field }) => (
            <TextField {...field} label="Calle" sx={{ gridColumn: { sm: '1 / 3' } }} />
          )} />
          <Controller name="numero" control={control} render={({ field }) => (
            <TextField {...field} label="Número" />
          )} />
          <Controller name="piso" control={control} render={({ field }) => (
            <TextField {...field} label="Piso / Dpto" />
          )} />
          <Controller name="localidad" control={control} render={({ field }) => (
            <TextField {...field} label="Localidad" />
          )} />
          <Controller name="barrio" control={control} render={({ field }) => (
            <TextField {...field} label="Barrio" />
          )} />
          <Controller name="cp" control={control} render={({ field }) => (
            <TextField {...field} label="Código Postal" />
          )} />
          <Controller name="provincia" control={control} render={({ field }) => (
            <TextField {...field} label="Provincia" />
          )} />
        </Box>
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <SectionTitle>Contacto</SectionTitle>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
          <Controller name="telefono" control={control} render={({ field }) => (
            <TextField {...field} label="Teléfono" />
          )} />
          <Controller name="email" control={control} render={({ field }) => (
            <TextField {...field} label="E-mail" type="email" />
          )} />
        </Box>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={18} /> : isNew ? <Add /> : <Save />}
        >
          {isNew ? 'Crear legajo' : 'Guardar'}
        </Button>
      </Box>
    </form>
    {persona && TIPOS_CON_ACCESO.includes(tipo) && <AccesoSistemaCard persona={persona} />}
    </>
  )
}
