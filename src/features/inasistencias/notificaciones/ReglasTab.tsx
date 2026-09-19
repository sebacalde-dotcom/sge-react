import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import CircularProgress from '@mui/material/CircularProgress'
import { Add, Delete, Save } from '@mui/icons-material'
import { useConfig, useConfigMutation } from '@/hooks/useConfig'
import { CartaHoja, ESTILOS_CARTA, type InstitucionCarta } from './CartaHoja'
import { DEFAULT_TEXTO_CARTA, VARIABLES_CARTA } from './carta'
import { PERIODOS, etiquetaPeriodo } from './periodos'
import { CONFIG_NOTIFICACIONES, useConfigNotificaciones, type ConfigNotificaciones } from './useConfigNotificaciones'
import type { NotificacionItem } from './useNotificaciones'

const ESCALA_VISTA_PREVIA = 0.5

const ITEM_EJEMPLO: NotificacionItem = {
  key: 'ejemplo',
  estado: 'por_imprimir',
  ciclo_id: '',
  persona_id: '',
  apellido: 'Fernández',
  nombre: 'Camila',
  dni: '45456789',
  limite: 10,
  periodo: 'mes',
  periodo_desde: '2026-09-01',
  registro: null,
  datos: {
    curso: '1er año A',
    anio: 2026,
    periodo_texto: 'el mes de septiembre de 2026',
    periodo: { total: 11, justificadas: 3, injustificadas: 8 },
    ciclo: { total: 14.5, justificadas: 4, injustificadas: 10.5 },
    fechas: [
      { fecha: '2026-09-01', tipo: 'Ausente', valor: 1, justificada: false },
      { fecha: '2026-09-02', tipo: 'Ausente', valor: 1, justificada: true },
      { fecha: '2026-09-03', tipo: 'Tarde', valor: 0.5, justificada: false },
    ],
  },
}

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const

export function ReglasTab() {
  const { config, isLoading } = useConfigNotificaciones()
  const { data: institucion } = useConfig<InstitucionCarta>('institucional')
  const mutation = useConfigMutation(CONFIG_NOTIFICACIONES)

  const { control, handleSubmit, reset, watch, setValue } = useForm<ConfigNotificaciones>({ defaultValues: config })
  const { fields, append, remove } = useFieldArray({ control, name: 'notificaciones' })

  useEffect(() => {
    reset(config)
  }, [config, reset])

  const texto = watch('carta.texto')
  const incluirDetalle = watch('carta.incluir_detalle')

  function onSubmit(values: ConfigNotificaciones) {
    if (values.notificaciones.some((n) => !Number.isFinite(n.limite) || n.limite <= 0)) {
      toast.error('Cada regla necesita una cantidad de inasistencias mayor a 0')
      return
    }
    const claves = values.notificaciones.map((n) => `${n.limite}_${n.periodo}`)
    const repetida = values.notificaciones.find((n, i) => claves.indexOf(`${n.limite}_${n.periodo}`) !== i)
    if (repetida) {
      toast.error(`Ya hay una regla de ${repetida.limite} inasistencias en ${etiquetaPeriodo(repetida.periodo)}`)
      return
    }
    const ordenadas: ConfigNotificaciones = {
      ...values,
      notificaciones: [...values.notificaciones].sort(
        (a, b) => PERIODOS.findIndex((p) => p.value === a.periodo) - PERIODOS.findIndex((p) => p.value === b.periodo) || a.limite - b.limite,
      ),
    }
    mutation.mutate(ordenadas as unknown as Record<string, unknown>, {
      onSuccess: () => toast.success('Reglas y carta guardadas'),
      onError: (e) => toast.error('Error: ' + e.message),
    })
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: `minmax(0, 1fr) calc(210mm * ${ESCALA_VISTA_PREVIA})` },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box>
          <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="subtitle2" sx={titulo}>Reglas de notificación</Typography>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Cada regla dice cuántas inasistencias, dentro de qué período. Al cargar una inasistencia, si el alumno llega
              a esa cantidad en el período, la planilla muestra un aviso. Si además está activado "Notificar a los
              padres", se genera una carta imprimible en Seguimiento.
            </Typography>
            {fields.length === 0 && (
              <Typography variant="body2" sx={{ mb: 2, color: 'text.disabled' }}>Todavía no hay reglas.</Typography>
            )}
            {fields.map((field, index) => (
              <Box key={field.id} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Controller
                  name={`notificaciones.${index}.limite`}
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
                  name={`notificaciones.${index}.periodo`}
                  control={control}
                  render={({ field: f }) => (
                    <TextField {...f} select label="Período" size="small" sx={{ width: 150 }}>
                      {PERIODOS.map((p) => (
                        <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <Controller
                  name={`notificaciones.${index}.mensaje`}
                  control={control}
                  render={({ field: f }) => (
                    <TextField {...f} label="Mensaje (opcional)" size="small" sx={{ flex: 1, minWidth: 180 }} />
                  )}
                />
                <Controller
                  name={`notificaciones.${index}.notificar_padres`}
                  control={control}
                  render={({ field: f }) => (
                    <FormControlLabel
                      control={<Switch size="small" checked={!!f.value} onChange={(e) => f.onChange(e.target.checked)} />}
                      label="Notificar a los padres"
                      slotProps={{ typography: { sx: { fontSize: 13 } } }}
                    />
                  )}
                />
                <IconButton size="small" color="error" onClick={() => remove(index)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => append({ limite: 10, periodo: 'ciclo', mensaje: '', notificar_padres: false })}
            >
              Agregar regla
            </Button>
            <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}>
              Mes: mes calendario. Bimestre y trimestre: se cuentan desde el mes de inicio del ciclo. Cuatrimestre: usa las
              fechas cargadas en Ciclo Lectivo. El mensaje de cada regla se muestra en el aviso de la planilla.
            </Typography>
          </Card>

          <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="subtitle2" sx={titulo}>Modelo de carta a los padres</Typography>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Los datos entre llaves se completan solos con los del alumno. Separá los párrafos con una línea en blanco.
              La vista previa se actualiza mientras escribís.
            </Typography>
            <Controller
              name="carta.texto"
              control={control}
              render={({ field }) => <TextField {...field} multiline minRows={9} fullWidth />}
            />
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
              {VARIABLES_CARTA.map((v) => (
                <Chip key={v.nombre} size="small" variant="outlined" label={`${v.nombre} · ${v.descripcion}`} />
              ))}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              <Controller
                name="carta.incluir_detalle"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch size="small" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                    label="Incluir el detalle de fechas de las inasistencias"
                    slotProps={{ typography: { sx: { fontSize: 13 } } }}
                  />
                )}
              />
              <Button size="small" onClick={() => setValue('carta.texto', DEFAULT_TEXTO_CARTA, { shouldDirty: true })}>
                Restablecer texto
              </Button>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
              El encabezado (logo y nombre de la escuela) y la firma del director se cargan en Institución.
            </Typography>
          </Card>

          <Button
            type="submit"
            variant="contained"
            startIcon={mutation.isPending ? <CircularProgress size={18} /> : <Save />}
            disabled={mutation.isPending}
          >
            Guardar reglas y carta
          </Button>
        </Box>

        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary' }}>
            Vista previa con datos de ejemplo
          </Typography>
          <style>{ESTILOS_CARTA}</style>
          <Box
            sx={{
              width: `calc(210mm * ${ESCALA_VISTA_PREVIA})`,
              maxWidth: '100%',
              height: `calc(296mm * ${ESCALA_VISTA_PREVIA})`,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#e5e7eb',
            }}
          >
            <Box sx={{ transform: `scale(${ESCALA_VISTA_PREVIA})`, transformOrigin: 'top left', width: '210mm', pointerEvents: 'none' }}>
              <CartaHoja item={ITEM_EJEMPLO} institucion={institucion} texto={texto ?? ''} incluirDetalle={!!incluirDetalle} />
            </Box>
          </Box>
        </Box>
      </Box>
    </form>
  )
}
