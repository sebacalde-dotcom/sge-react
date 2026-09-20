import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { Save, Add } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import type { Persona } from '@/features/legajos/LegajoPage'
import { AlumnoResponsablesTab } from './AlumnoResponsablesTab'
import { useAlumnoAcademico, type Progenitor } from '../useAlumnoAcademico'

const FORM_ID = 'ficha-personal-form'

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
  prog1_nombre: string
  prog1_apellido: string
  prog1_dni: string
  prog1_rol: string
  prog2_nombre: string
  prog2_apellido: string
  prog2_dni: string
  prog2_rol: string
}

const EMPTY: PersonaForm = {
  apellido: '', nombre: '', dni: '', fecha_nac: '', sexo: '', nacionalidad: '',
  calle: '', numero: '', piso: '', depto: '', localidad: '', barrio: '', cp: '', provincia: '',
  telefono: '', email: '',
  prog1_nombre: '', prog1_apellido: '', prog1_dni: '', prog1_rol: '',
  prog2_nombre: '', prog2_apellido: '', prog2_dni: '', prog2_rol: '',
}

interface Props {
  persona: Persona | null
  cicloId: string | null
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
      {children}
    </Typography>
  )
}

const aProgenitor = (v: PersonaForm, n: 1 | 2): Progenitor => ({
  nombre: v[`prog${n}_nombre`].trim(),
  apellido: v[`prog${n}_apellido`].trim(),
  dni: v[`prog${n}_dni`].trim(),
  rol: v[`prog${n}_rol`].trim(),
})

export function AlumnoFichaPersonalTab({ persona, cicloId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !persona
  const { alumnoDatos } = useAlumnoAcademico(persona?.id)

  const { control, handleSubmit, reset } = useForm<PersonaForm>({ defaultValues: EMPTY })

  // Falla si todavía no se corrió la migración 010
  const { data: soportaProgenitores = false } = useQuery({
    queryKey: ['soporta-progenitores'],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { error } = await supabase.from('alumno_datos').select('progenitores').limit(1)
      return !error
    },
  })

  useEffect(() => {
    if (persona) {
      const [p1, p2] = alumnoDatos?.progenitores ?? []
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
        prog1_nombre: p1?.nombre ?? '',
        prog1_apellido: p1?.apellido ?? '',
        prog1_dni: p1?.dni ?? '',
        prog1_rol: p1?.rol ?? '',
        prog2_nombre: p2?.nombre ?? '',
        prog2_apellido: p2?.apellido ?? '',
        prog2_dni: p2?.dni ?? '',
        prog2_rol: p2?.rol ?? '',
      })
    }
  }, [persona, alumnoDatos, reset])

  const saveMutation = useMutation({
    mutationFn: async (values: PersonaForm) => {
      const personaRow = {
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
        tipo: 'alumno' as const,
      }
      const progenitores = soportaProgenitores ? { progenitores: [aProgenitor(values, 1), aProgenitor(values, 2)] } : {}

      let personaId: string

      if (isNew) {
        const { data, error } = await supabase.from('personas').insert(personaRow).select('id').single()
        if (error) throw error
        personaId = data.id

        const { error: adError } = await supabase.from('alumno_datos').insert({
          persona_id: personaId,
          ciclo_id: cicloId!,
          estado: 'activo',
          ...progenitores,
        })
        if (adError) throw adError
      } else {
        personaId = persona!.id
        const { error } = await supabase.from('personas').update(personaRow).eq('id', personaId)
        if (error) throw error

        if (soportaProgenitores) {
          const { data: filas, error: adError } = await supabase
            .from('alumno_datos')
            .update(progenitores)
            .eq('persona_id', personaId)
            .select('id')
          if (adError) throw adError
          if (!filas || filas.length === 0) throw new Error('No se pudieron guardar los progenitores')
        }
      }

      return personaId
    },
    onSuccess: (personaId) => {
      toast.success(isNew ? 'Legajo creado' : 'Legajo actualizado')
      queryClient.invalidateQueries({ queryKey: ['alumnos'] })
      queryClient.invalidateQueries({ queryKey: ['persona', personaId] })
      queryClient.invalidateQueries({ queryKey: ['alumno-datos', personaId] })
      queryClient.invalidateQueries({ queryKey: ['alumno-academico', personaId] })
      if (isNew) navigate(`/legajos/${personaId}`, { replace: true })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  return (
    <>
      <form id={FORM_ID} onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
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

        <Card sx={{ p: 3, mb: 3 }}>
          <SectionTitle>Progenitores</SectionTitle>
          {!soportaProgenitores && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Falta correr la migración 010 en Supabase para poder guardar los progenitores.
            </Alert>
          )}
          {([1, 2] as const).map((n) => (
            <Box key={n} sx={{ mb: n === 1 ? 3 : 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>Progenitor {n}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
                <Controller name={`prog${n}_nombre`} control={control} render={({ field }) => (
                  <TextField {...field} label="Nombre" disabled={!soportaProgenitores} />
                )} />
                <Controller name={`prog${n}_apellido`} control={control} render={({ field }) => (
                  <TextField {...field} label="Apellido" disabled={!soportaProgenitores} />
                )} />
                <Controller name={`prog${n}_dni`} control={control} render={({ field }) => (
                  <TextField {...field} label="DNI" disabled={!soportaProgenitores} />
                )} />
                <Controller name={`prog${n}_rol`} control={control} render={({ field }) => (
                  <TextField {...field} label="Rol (opcional)" disabled={!soportaProgenitores} />
                )} />
              </Box>
            </Box>
          ))}
        </Card>
      </form>

      <Box sx={{ mb: 3 }}>
        {persona ? (
          <AlumnoResponsablesTab alumnoPersonaId={persona.id} />
        ) : (
          <Card sx={{ p: 3 }}>
            <SectionTitle>Adultos responsables</SectionTitle>
            <Typography variant="body2" color="text.disabled">
              Guardá el legajo para poder cargar los adultos responsables.
            </Typography>
          </Card>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {persona && (
          <Typography variant="caption" color="text.secondary">
            Los adultos responsables se guardan al agregarlos; el botón guarda el resto de la ficha.
          </Typography>
        )}
        <Button
          type="submit"
          form={FORM_ID}
          variant="contained"
          disabled={saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={18} /> : isNew ? <Add /> : <Save />}
        >
          {isNew ? 'Crear legajo' : 'Guardar'}
        </Button>
      </Box>
    </>
  )
}
