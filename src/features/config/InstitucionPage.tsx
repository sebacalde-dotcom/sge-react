import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Card from '@mui/material/Card'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Save } from '@mui/icons-material'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'
import { PhotoUpload } from '@/components/shared/PhotoUpload'
import { REGIMENES } from '@/features/inasistencias/regimenes'

interface InstitucionData {
  nombre: string
  cuit: string
  telefono: string
  direccion: string
  email: string
  logoUrl: string | null
  director: string
  firmaDirectorUrl: string | null
  /** 'pba' o 'caba': define el régimen de asistencia y evaluación que se propone para cada ciclo. Vacío = sin elegir. */
  jurisdiccion?: string
  darkMode?: boolean
}

const VACIO: InstitucionData = {
  nombre: '',
  cuit: '',
  telefono: '',
  direccion: '',
  email: '',
  logoUrl: null,
  director: '',
  firmaDirectorUrl: null,
  jurisdiccion: '',
}

export function InstitucionPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useConfig<InstitucionData>('institucional')
  const mutation = useConfigMutation('institucional')

  const { control, handleSubmit, reset } = useForm<InstitucionData>({ defaultValues: VACIO })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      reset({ ...VACIO, ...data })
      setLogoUrl(data.logoUrl ?? null)
      setFirmaUrl(data.firmaDirectorUrl ?? null)
    }
  }, [data, reset])

  async function onSubmit(values: InstitucionData) {
    try {
      await mutation.mutateAsync({ ...data, ...values, logoUrl, firmaDirectorUrl: firmaUrl })
      toast.success('Datos de la institución guardados')
    } catch (e) {
      toast.error('Error al guardar: ' + (e as Error).message)
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h5">Institución</Typography>
          <Typography variant="body2" color="text.secondary">
            Datos generales de la institución y logo.
          </Typography>
        </Box>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <PhotoUpload
                bucket="logos"
                currentUrl={logoUrl}
                onUploaded={setLogoUrl}
                shape="square"
                size={120}
                placeholder="image"
              />
              <Typography variant="caption" color="text.secondary">Logo</Typography>
            </Box>

            <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
              <Controller
                name="nombre"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Nombre" fullWidth sx={{ gridColumn: { sm: '1 / -1' } }} />
                )}
              />
              <Controller
                name="cuit"
                control={control}
                render={({ field }) => <TextField {...field} label="CUIT" placeholder="30-12345678-9" />}
              />
              <Controller
                name="telefono"
                control={control}
                render={({ field }) => <TextField {...field} label="Teléfono" />}
              />
              <Controller
                name="email"
                control={control}
                render={({ field }) => <TextField {...field} label="Email" type="email" />}
              />
              <Controller
                name="direccion"
                control={control}
                render={({ field }) => <TextField {...field} label="Dirección" />}
              />
            </Box>
          </Box>
        </Card>

        <Card sx={{ p: 4, mt: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
            Jurisdicción
          </Typography>
          <Controller
            name="jurisdiccion"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                select
                fullWidth
                label="Jurisdicción de la escuela"
                helperText="Define el régimen de asistencia y de evaluación que se propone para cada ciclo lectivo. Cada ciclo puede elegir el suyo en Ciclo Lectivo."
              >
                <MenuItem value="">Sin elegir</MenuItem>
                {REGIMENES.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>
                ))}
              </TextField>
            )}
          />
        </Card>

        <Card sx={{ p: 4, mt: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
            Director/a
          </Typography>
          <Box sx={{ display: 'flex', gap: 4, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'flex-start' } }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <PhotoUpload
                bucket="logos"
                currentUrl={firmaUrl}
                onUploaded={setFirmaUrl}
                shape="square"
                size={90}
                width={220}
                fit="contain"
                placeholder="draw"
              />
              <Typography variant="caption" color="text.secondary">Firma digital</Typography>
              {firmaUrl && (
                <Button size="small" color="error" onClick={() => setFirmaUrl(null)}>Quitar firma</Button>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Controller
                name="director"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Nombre del director/a" fullWidth />
                )}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Se usan en las notificaciones impresas a los padres. Conviene una imagen de la firma sobre fondo
                blanco o transparente (PNG).
              </Typography>
            </Box>
          </Box>
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={18} /> : <Save />}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </Box>
      </form>
    </Box>
  )
}
