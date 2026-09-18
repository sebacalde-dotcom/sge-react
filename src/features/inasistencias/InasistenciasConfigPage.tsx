import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Add, Delete, Save, Keyboard } from '@mui/icons-material'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'

interface TipoInasistencia {
  nombre: string
  valor: number
  tecla: string
}

interface InasistenciasConfig {
  tipos: TipoInasistencia[]
  doble_turno: boolean
  limite_no_regular: number
  reincorporacion_1: number
  reincorporacion_2: number
  reincorporacion_3: number
}

const DEFAULT_CONFIG: InasistenciasConfig = {
  tipos: [
    { nombre: 'Ausente', valor: 1, tecla: 'A' },
    { nombre: 'Tarde', valor: 0.5, tecla: 'T' },
    { nombre: 'Media falta', valor: 0.5, tecla: 'M' },
  ],
  doble_turno: false,
  limite_no_regular: 25,
  reincorporacion_1: 30,
  reincorporacion_2: 35,
  reincorporacion_3: 40,
}

const RESERVED_KEYS = ['J']

export function InasistenciasConfigPage() {
  const navigate = useNavigate()
  const { data: config, isLoading } = useConfig<InasistenciasConfig>('inasistencias')
  const mutation = useConfigMutation('inasistencias')

  const { control, handleSubmit, reset, watch } = useForm<InasistenciasConfig>({
    defaultValues: DEFAULT_CONFIG,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'tipos' })
  const watchedTipos = watch('tipos')

  useEffect(() => {
    if (config && Object.keys(config).length > 0) {
      reset({
        tipos: config.tipos ?? DEFAULT_CONFIG.tipos,
        doble_turno: config.doble_turno ?? DEFAULT_CONFIG.doble_turno,
        limite_no_regular: config.limite_no_regular ?? DEFAULT_CONFIG.limite_no_regular,
        reincorporacion_1: config.reincorporacion_1 ?? DEFAULT_CONFIG.reincorporacion_1,
        reincorporacion_2: config.reincorporacion_2 ?? DEFAULT_CONFIG.reincorporacion_2,
        reincorporacion_3: config.reincorporacion_3 ?? DEFAULT_CONFIG.reincorporacion_3,
      })
    }
  }, [config, reset])

  function onSubmit(values: InasistenciasConfig) {
    const keys = values.tipos.map((t) => t.tecla.toUpperCase())
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i)
    if (duplicates.length > 0) {
      toast.error(`Tecla duplicada: ${duplicates[0]}`)
      return
    }
    const reserved = keys.filter((k) => RESERVED_KEYS.includes(k))
    if (reserved.length > 0) {
      toast.error(`La tecla "${reserved[0]}" está reservada para Justificar`)
      return
    }
    if (values.reincorporacion_1 <= values.limite_no_regular) {
      toast.error('1era reincorporación debe ser mayor al límite No Regular')
      return
    }
    if (values.reincorporacion_2 <= values.reincorporacion_1) {
      toast.error('2da reincorporación debe ser mayor a la 1era')
      return
    }
    if (values.reincorporacion_3 <= values.reincorporacion_2) {
      toast.error('3era reincorporación debe ser mayor a la 2da')
      return
    }
    mutation.mutate(values as unknown as Record<string, unknown>, {
      onSuccess: () => toast.success('Configuración guardada'),
      onError: (e) => toast.error('Error: ' + e.message),
    })
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => navigate('/inasistencias')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5">Configuración de Inasistencias</Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' }}>
            Tipos de inasistencia
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Definí cada tipo, su valor numérico y la tecla para cargarlo rápido en la planilla. La tecla <Chip label="J" size="small" sx={{ mx: 0.5, fontWeight: 700 }} /> está reservada para justificar.
          </Typography>
          {fields.map((field, index) => (
            <Box key={field.id} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
              <Controller
                name={`tipos.${index}.nombre`}
                control={control}
                rules={{ required: 'Requerido' }}
                render={({ field: f }) => (
                  <TextField {...f} label="Nombre" size="small" sx={{ flex: 1 }} />
                )}
              />
              <Controller
                name={`tipos.${index}.valor`}
                control={control}
                render={({ field: f }) => (
                  <TextField
                    {...f}
                    label="Valor"
                    type="number"
                    size="small"
                    sx={{ width: 90 }}
                    slotProps={{ htmlInput: { step: 0.25, min: 0, max: 2 } }}
                    onChange={(e) => f.onChange(parseFloat(e.target.value))}
                  />
                )}
              />
              <Controller
                name={`tipos.${index}.tecla`}
                control={control}
                rules={{
                  required: 'Requerido',
                  maxLength: { value: 1, message: 'Solo 1 carácter' },
                }}
                render={({ field: f, fieldState }) => (
                  <TextField
                    {...f}
                    label="Tecla"
                    size="small"
                    sx={{ width: 70 }}
                    error={!!fieldState.error}
                    slotProps={{ htmlInput: { maxLength: 1, style: { textAlign: 'center', fontWeight: 700, textTransform: 'uppercase' } } }}
                    onChange={(e) => f.onChange(e.target.value.toUpperCase())}
                  />
                )}
              />
              <IconButton size="small" color="error" onClick={() => remove(index)} disabled={fields.length <= 1}>
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<Add />} onClick={() => append({ nombre: '', valor: 0.5, tecla: '' })}>
            Agregar tipo
          </Button>
        </Card>

        <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' }}>
            Turnos
          </Typography>
          <Controller name="doble_turno" control={control} render={({ field }) => (
            <TextField
              select
              label="Turnos por día"
              value={field.value ? 'doble' : 'simple'}
              onChange={(e) => field.onChange(e.target.value === 'doble')}
              fullWidth
              helperText="Doble turno divide cada día en mañana y tarde"
            >
              <MenuItem value="simple">Turno simple</MenuItem>
              <MenuItem value="doble">Doble turno</MenuItem>
            </TextField>
          )} />
        </Card>

        <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' }}>
            Regularidad y reincorporaciones
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Definí los límites de inasistencias para cada instancia. Al alcanzar el límite, el alumno queda como "No Regular".
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Controller name="limite_no_regular" control={control} render={({ field }) => (
              <TextField
                {...field}
                label="Límite No Regular"
                type="number"
                onChange={(e) => field.onChange(parseInt(e.target.value))}
                helperText="Inasistencias para quedar No Regular"
              />
            )} />
            <Controller name="reincorporacion_1" control={control} render={({ field }) => (
              <TextField
                {...field}
                label="1era Reincorporación"
                type="number"
                onChange={(e) => field.onChange(parseInt(e.target.value))}
                helperText="Límite tras la primera reincorporación"
              />
            )} />
            <Controller name="reincorporacion_2" control={control} render={({ field }) => (
              <TextField
                {...field}
                label="2da Reincorporación"
                type="number"
                onChange={(e) => field.onChange(parseInt(e.target.value))}
                helperText="Límite tras la segunda reincorporación"
              />
            )} />
            <Controller name="reincorporacion_3" control={control} render={({ field }) => (
              <TextField
                {...field}
                label="3era Reincorporación"
                type="number"
                onChange={(e) => field.onChange(parseInt(e.target.value))}
                helperText="Límite tras la tercera reincorporación (última instancia)"
              />
            )} />
          </Box>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          <Button
            type="submit"
            variant="contained"
            startIcon={mutation.isPending ? <CircularProgress size={18} /> : <Save />}
            disabled={mutation.isPending}
          >
            Guardar configuración
          </Button>
        </Box>

        <Card variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fafc' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Keyboard sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
              Atajos de teclado en la planilla
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(watchedTipos ?? []).filter((t) => t.tecla).map((t) => (
              <Chip key={t.tecla} label={`${t.tecla} = ${t.nombre}`} size="small" variant="outlined" />
            ))}
            <Chip label="J = Justificar" size="small" variant="outlined" color="success" />
            <Chip label="Supr/Del = Borrar" size="small" variant="outlined" color="error" />
            <Chip label="Flechas = Navegar" size="small" variant="outlined" />
            <Chip label="Tab = Derecha" size="small" variant="outlined" />
            <Chip label="Enter = Bajar" size="small" variant="outlined" />
          </Box>
        </Card>
      </form>
    </Box>
  )
}
