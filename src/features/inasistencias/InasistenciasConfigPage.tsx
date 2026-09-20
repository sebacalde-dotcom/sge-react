import { useEffect, useState } from 'react'
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
import Alert from '@mui/material/Alert'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import RadioGroup from '@mui/material/RadioGroup'
import Radio from '@mui/material/Radio'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Add, Delete, Save, Keyboard, Gavel } from '@mui/icons-material'
import MenuItem from '@mui/material/MenuItem'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'
import { useAuth } from '@/contexts/AuthContext'
import { useCiclo } from '@/contexts/CicloContext'
import { esAdmin } from '@/lib/permisos'
import { PERIODOS, etiquetaPeriodo, periodoSinDefinir } from './notificaciones/periodos'
import { CONFIG_NOTIFICACIONES, useConfigNotificaciones } from './notificaciones/useConfigNotificaciones'
import { reglasDesdeConfig } from './useRegularidad'
import { COMPARACIONES, CUENTAS, type TipoInasistencia } from './conteo'
import { REGIMENES, regimenPorId, type PlantillaRegimen } from './regimenes'
import type { ReglaRegularidad } from './regularidad'

interface InasistenciasConfig {
  tipos: TipoInasistencia[]
  reglas_regularidad: ReglaRegularidad[]
  permite_reincorporaciones?: boolean
  regimen?: string
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
  const { personal } = useAuth()
  const { ciclo } = useCiclo()
  const { data: config, isLoading } = useConfig<InasistenciasConfig>('inasistencias')
  const mutation = useConfigMutation('inasistencias')
  const mutationAvisos = useConfigMutation(CONFIG_NOTIFICACIONES)
  const { config: configAvisos } = useConfigNotificaciones()
  const puedeAplicarRegimen = esAdmin(personal?.rol)

  const [eligiendoRegimen, setEligiendoRegimen] = useState(false)
  const [regimenElegido, setRegimenElegido] = useState<PlantillaRegimen>(REGIMENES[0])
  const [aplicando, setAplicando] = useState(false)

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

  async function aplicarRegimen(plantilla: PlantillaRegimen) {
    setAplicando(true)
    try {
      await mutation.mutateAsync({
        ...config,
        tipos: plantilla.tipos,
        reglas_regularidad: plantilla.reglas_regularidad,
        permite_reincorporaciones: plantilla.permite_reincorporaciones,
        regimen: plantilla.id,
      } as unknown as Record<string, unknown>)
      // Las reglas de aviso viven en su propia configuración; se conservan los textos de la carta
      await mutationAvisos.mutateAsync({ ...configAvisos, notificaciones: plantilla.avisos } as unknown as Record<string, unknown>)
      toast.success(`Se aplicó el régimen de ${plantilla.nombre}`)
      setEligiendoRegimen(false)
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setAplicando(false)
    }
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  const regimenAplicado = regimenPorId(config?.regimen)

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => navigate('/inasistencias')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5">Configuración de Inasistencias</Typography>
      </Box>

      {puedeAplicarRegimen && (
        <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Typography variant="subtitle2" sx={titulo}>Régimen de asistencia</Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Cada jurisdicción tiene sus propias reglas de inasistencias. Elegí una plantilla para cargar de una vez los
            tipos, los valores, las reglas de regularidad y los avisos, y después ajustá lo que haga falta.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<Gavel />} onClick={() => setEligiendoRegimen(true)}>
              Aplicar un régimen…
            </Button>
            {regimenAplicado && (
              <Chip size="small" variant="outlined" label={`Última plantilla aplicada: ${regimenAplicado.nombre}`} />
            )}
          </Box>
        </Card>
      )}

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

      <Dialog open={eligiendoRegimen} onClose={() => !aplicando && setEligiendoRegimen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Aplicar un régimen de asistencia</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <RadioGroup
            value={regimenElegido.id}
            onChange={(e) => setRegimenElegido(REGIMENES.find((r) => r.id === e.target.value) ?? REGIMENES[0])}
          >
            {REGIMENES.map((r) => (
              <FormControlLabel key={r.id} value={r.id} control={<Radio size="small" />} label={r.nombre} />
            ))}
          </RadioGroup>
          <Typography variant="body2">{regimenElegido.descripcion}</Typography>
          <Alert severity="info">
            Reemplaza los tipos de inasistencia, las reglas de regularidad y las reglas de aviso que hay ahora. No cambia
            los textos de la carta ni las fechas de Ciclo Lectivo. Los valores salen de la normativa: verificalos con la
            resolución vigente antes de usarlos.
          </Alert>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Todavía no cubre</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {regimenElegido.limitaciones.map((l) => (
                <Typography key={l} component="li" variant="body2" color="text.secondary">{l}</Typography>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEligiendoRegimen(false)} disabled={aplicando}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={aplicando}
            startIcon={aplicando ? <CircularProgress size={18} /> : undefined}
            onClick={() => aplicarRegimen(regimenElegido)}
          >
            Aplicar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
