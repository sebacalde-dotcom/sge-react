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
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Add, Delete, Save, Keyboard } from '@mui/icons-material'
import MenuItem from '@mui/material/MenuItem'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'
import { useCiclo } from '@/contexts/CicloContext'
import { PERIODOS, etiquetaPeriodo, periodoSinDefinir } from './notificaciones/periodos'
import { reglasDesdeConfig } from './useRegularidad'
import { COMPARACIONES, CUENTAS, type TipoInasistencia } from './conteo'
import { RegimenDelCiclo } from './RegimenDelCiclo'
import type { ReglaRegularidad } from './regularidad'

interface InasistenciasConfig {
  tipos: TipoInasistencia[]
  reglas_regularidad: ReglaRegularidad[]
  permite_reincorporaciones?: boolean
  asistencia_por_materia?: boolean
}

const DEFAULT_CONFIG: InasistenciasConfig = {
  tipos: [
    { nombre: 'Ausente', valor: 1, tecla: 'A' },
    { nombre: 'Tarde', valor: 0.5, tecla: 'T' },
    { nombre: 'Media falta', valor: 0.5, tecla: 'M' },
  ],
  reglas_regularidad: [{ limite: 25, periodo: 'ciclo' }],
  permite_reincorporaciones: true,
}

const RESERVED_KEYS = ['J']

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const

export function InasistenciasConfigPage() {
  const navigate = useNavigate()
  const { ciclo } = useCiclo()
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
  const watchedReglas = watch('reglas_regularidad')
  const permiteReincorporaciones = watch('permite_reincorporaciones')

  useEffect(() => {
    if (config && Object.keys(config).length > 0) {
      reset({
        tipos: config.tipos ?? DEFAULT_CONFIG.tipos,
        reglas_regularidad: reglasDesdeConfig(config),
        permite_reincorporaciones: config.permite_reincorporaciones ?? true,
        asistencia_por_materia: config.asistencia_por_materia,
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
    // El valor de doble turno vacío significa "igual que el valor normal": no se guarda
    const tipos = values.tipos.map((t) => ({
      ...t,
      valor_doble_turno: Number.isFinite(t.valor_doble_turno) ? t.valor_doble_turno : undefined,
    }))
    // Se conservan las claves que ya no se editan acá (reglas y carta anteriores) para no pisarlas.
    mutation.mutate({ ...config, ...values, tipos } as unknown as Record<string, unknown>, {
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

      <RegimenDelCiclo />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" sx={titulo}>
            Tipos de inasistencia
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Definí cada tipo, su valor numérico y la tecla para cargarlo rápido en la planilla. La tecla <Chip label="J" size="small" sx={{ mx: 0.5, fontWeight: 700 }} /> está reservada para justificar.
            El valor de doble turno es lo que suma cada turno cuando el ciclo tiene doble turno (por ejemplo, un ausente
            vale 1 en turno simple y 0,5 por turno en doble turno). Si lo dejás vacío, vale lo mismo.
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
                name={`tipos.${index}.valor_doble_turno`}
                control={control}
                render={({ field: f }) => (
                  <TextField
                    {...f}
                    value={f.value ?? ''}
                    label="Doble turno"
                    type="number"
                    size="small"
                    sx={{ width: 110 }}
                    slotProps={{ htmlInput: { step: 0.25, min: 0, max: 2 } }}
                    onChange={(e) => f.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
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
          <Typography variant="subtitle2" sx={titulo}>
            Regularidad
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Un alumno pasa a <strong>No Regular</strong> cuando se cumple cualquiera de estas reglas dentro de su período.
            {permiteReincorporaciones
              ? ' Sigue No Regular hasta que el Director lo reincorpore; desde ese día empieza de nuevo el conteo de la regla que infringió (las demás siguen contando). Las inasistencias anteriores no se borran, solo dejan de contar para esa regla.'
              : ' Sigue No Regular: este régimen no admite reincorporaciones.'}
          </Typography>
          {reglaFields.length === 0 && (
            <Typography variant="body2" sx={{ mb: 2, color: 'text.disabled' }}>
              Sin reglas: ningún alumno pasa a No Regular.
            </Typography>
          )}
          {reglaFields.map((field, index) => (
            <Box key={field.id} sx={{ mb: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Controller
                  name={`reglas_regularidad.${index}.comparacion`}
                  control={control}
                  render={({ field: f }) => (
                    <TextField {...f} value={f.value ?? 'alcanza'} select label="Cuando" size="small" sx={{ width: 120 }}>
                      {COMPARACIONES.map((c) => (
                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <Controller
                  name={`reglas_regularidad.${index}.limite`}
                  control={control}
                  render={({ field: f }) => (
                    <TextField
                      {...f}
                      label="Cantidad"
                      type="number"
                      size="small"
                      sx={{ width: 100 }}
                      slotProps={{ htmlInput: { min: 1, step: 0.5 } }}
                      onChange={(e) => f.onChange(parseFloat(e.target.value))}
                    />
                  )}
                />
                <Controller
                  name={`reglas_regularidad.${index}.cuenta`}
                  control={control}
                  render={({ field: f }) => (
                    <TextField {...f} value={f.value ?? 'todas'} select label="Inasistencias" size="small" sx={{ width: 190 }}>
                      {CUENTAS.map((c) => (
                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                      ))}
                    </TextField>
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
              {watchedReglas?.[index] && periodoSinDefinir(watchedReglas[index].periodo, ciclo) && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.main' }}>
                  Los {watchedReglas[index].periodo}s no están cargados en Ciclo Lectivo: se calculan por bloques de meses.
                </Typography>
              )}
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => appendRegla({ limite: 25, periodo: 'ciclo', comparacion: 'alcanza', cuenta: 'todas' })}
          >
            Agregar regla
          </Button>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
            "Alcanzan" se cumple al llegar a la cantidad; "Superan", recién al pasarla. Mes es el mes calendario. Bimestre,
            trimestre y cuatrimestre usan las fechas cargadas en Ciclo Lectivo (si no están, se calculan por bloques de meses).
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Controller
              name="permite_reincorporaciones"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch size="small" checked={field.value ?? true} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Permitir que el Director reincorpore a los alumnos No Regulares"
                  slotProps={{ typography: { sx: { fontSize: 13 } } }}
                />
              )}
            />
          </Box>
        </Card>

        <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" sx={titulo}>
            Asistencia por materia
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Calcula el porcentaje de asistencia de cada materia con las faltas de cada día y las materias que el horario
            del curso tiene ese día. Se muestra en la planilla y marca las que quedan por debajo del 75%. Necesita el
            horario cargado en Ciclo Lectivo.
          </Typography>
          <Controller
            name="asistencia_por_materia"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch size="small" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Calcular la asistencia por materia"
                slotProps={{ typography: { sx: { fontSize: 13 } } }}
              />
            )}
          />
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
