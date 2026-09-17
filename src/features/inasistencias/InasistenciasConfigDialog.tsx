import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { Add, Delete } from '@mui/icons-material'
import { useConfig } from '@/hooks/useConfig'

interface TipoInasistencia {
  nombre: string
  valor: number
}

interface InasistenciasConfig {
  tipos: TipoInasistencia[]
  limite_anual: number
  doble_turno: boolean
}

const DEFAULT_CONFIG: InasistenciasConfig = {
  tipos: [
    { nombre: 'Ausente', valor: 1 },
    { nombre: 'Tarde', valor: 0.5 },
  ],
  limite_anual: 25,
  doble_turno: false,
}

interface Props {
  open: boolean
  onClose: () => void
}

export function InasistenciasConfigDialog({ open, onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: config } = useConfig('inasistencias')

  const { control, handleSubmit, reset } = useForm<InasistenciasConfig>({
    defaultValues: DEFAULT_CONFIG,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'tipos' })

  useEffect(() => {
    if (config) {
      reset({
        tipos: config.tipos ?? DEFAULT_CONFIG.tipos,
        limite_anual: config.limite_anual ?? DEFAULT_CONFIG.limite_anual,
        doble_turno: config.doble_turno ?? DEFAULT_CONFIG.doble_turno,
      })
    }
  }, [config, reset])

  const saveMutation = useMutation({
    mutationFn: async (values: InasistenciasConfig) => {
      const { data: existing } = await (await import('@/lib/supabase')).supabase
        .from('config')
        .select('id')
        .eq('clave', 'inasistencias')
        .maybeSingle()

      const supabase = (await import('@/lib/supabase')).supabase

      if (existing) {
        const { error } = await supabase
          .from('config')
          .update({ valor: values })
          .eq('clave', 'inasistencias')
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('config')
          .insert({ clave: 'inasistencias', valor: values })
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Configuración guardada')
      queryClient.invalidateQueries({ queryKey: ['config', 'inasistencias'] })
      onClose()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
        <DialogTitle>Configuración de Inasistencias</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '16px !important' }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
              Tipos de inasistencia
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
                      sx={{ width: 100 }}
                      slotProps={{ htmlInput: { step: 0.25, min: 0, max: 2 } }}
                      onChange={(e) => f.onChange(parseFloat(e.target.value))}
                    />
                  )}
                />
                <IconButton size="small" color="error" onClick={() => remove(index)} disabled={fields.length <= 1}>
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<Add />} onClick={() => append({ nombre: '', valor: 0.5 })}>
              Agregar tipo
            </Button>
          </Box>

          <Controller name="limite_anual" control={control} render={({ field }) => (
            <TextField
              {...field}
              label="Límite anual de inasistencias"
              type="number"
              onChange={(e) => field.onChange(parseInt(e.target.value))}
              helperText="Se mostrará una alerta cuando el alumno se acerque a este límite"
            />
          )} />

          <Controller name="doble_turno" control={control} render={({ field }) => (
            <TextField
              select
              label="Turnos por día"
              value={field.value ? 'doble' : 'simple'}
              onChange={(e) => field.onChange(e.target.value === 'doble')}
              helperText="Doble turno divide cada día en mañana y tarde"
            >
              <MenuItem value="simple">Turno simple</MenuItem>
              <MenuItem value="doble">Doble turno</MenuItem>
            </TextField>
          )} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <CircularProgress size={20} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
