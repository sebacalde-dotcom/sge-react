import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Add, Delete, Save, Keyboard } from '@mui/icons-material'
import MenuItem from '@mui/material/MenuItem'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'
import { PERIODOS, etiquetaPeriodo } from './notificaciones/periodos'
import { reglasDesdeConfig } from './useRegularidad'
import type { ReglaRegularidad } from './regularidad'

interface TipoInasistencia {
  nombre: string
  valor: number
  tecla: string
}

interface InasistenciasConfig {
  tipos: TipoInasistencia[]
  reglas_regularidad: ReglaRegularidad[]
}

const DEFAULT_CONFIG: InasistenciasConfig = {
  tipos: [
    { nombre: 'Ausente', valor: 1, tecla: 'A' },
    { nombre: 'Tarde', valor: 0.5, tecla: 'T' },
    { nombre: 'Media falta', valor: 0.5, tecla: 'M' },
  ],
  reglas_regularidad: [{ limite: 25, periodo: 'ciclo' }],
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
  const {
    fields: reglaFields,
    append: appendRegla,
    remove: removeRegla,
  } = useFieldArray({ control, name: 'reglas_regularidad' })
  const watchedTipos = watch('tipos')

  useEffect(() => {
    if (config && Object.keys(config).length > 0) {
      reset({
        tipos: config.tipos ?? DEFAULT_CONFIG.tipos,
        reglas_regularidad: reglasDesdeConfig(config),
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
    if (values.reglas_regularidad.some((r) => !Number.isFinite(r.limite) || r.limite <= 0)) {
      toast.error('Cada regla de regularidad necesita una cantidad de inasistencias mayor a 0')
      return
    }
    const claves = values.reglas_regularidad.map((r) => `${r.limite}_${r.periodo}`)
    const repetida = values.reglas_regularidad.find((r, i) => claves.indexOf(`${r.limite}_${r.periodo}`) !== i)
    if (repetida) {
      toast.error(`Ya hay una regla de ${repetida.limite} inasistencias en ${etiquetaPeriodo(repetida.periodo)}`)
      return
    }
    // Se conservan las claves que ya no se editan acá (reglas y carta anteriores) para no pisarlas.
    mutation.mutate({ ...config, ...values } as unknown as Record<string, unknown>, {
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
            Regularidad
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Un alumno pasa a <strong>No Regular</strong> cuando junta esa cantidad de inasistencias dentro del período de
            cualquiera de las reglas. Sigue No Regular hasta que el Director lo reincorpore; desde ese día el conteo
            empieza de nuevo (las inasistencias anteriores no se borran, solo dejan de contar).
          </Typography>
          {reglaFields.length === 0 && (
            <Typography variant="body2" sx={{ mb: 2, color: 'text.disabled' }}>
              Sin reglas: ningún alumno pasa a No Regular.
            </Typography>
          )}
          {reglaFields.map((field, index) => (
            <Box key={field.id} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Controller
                name={`reglas_regularidad.${index}.limite`}
                control={control}
                render={({ field: f }) => (
                  <TextField
                    {...f}
                    label="Inasistencias"
                    type="number"
                    size="small"
                    sx={{ width: 120 }}
                    slotProps={{ htmlInput: { min: 1, step: 0.5 } }}
                    onChange={(e) => f.onChange(parseFloat(e.target.value))}
                  />
                )}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>en</Typography>
              <Controller
                name={`reglas_regularidad.${index}.periodo`}
                control={control}
                render={({ field: f }) => (
                  <TextField {...f} select label="Período" size="small" sx={{ width: 160 }}>
                    {PERIODOS.map((p) => (
                      <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <IconButton size="small" color="error" onClick={() => removeRegla(index)}>
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<Add />} onClick={() => appendRegla({ limite: 25, periodo: 'ciclo' })}>
            Agregar regla
          </Button>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
            Mes: mes calendario. Bimestre y trimestre: se cuentan desde el mes de inicio del ciclo. Cuatrimestre: usa las
            fechas cargadas en Ciclo Lectivo.
          </Typography>
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
