import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import { Save, Add } from '@mui/icons-material'
import { useCiclo } from '@/contexts/CicloContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface CicloForm {
  anio: number
  inicio: string
  fin: string
  c1_desde: string
  c1_hasta: string
  c2_desde: string
  c2_hasta: string
  doble_turno: boolean
}

const EMPTY: CicloForm = {
  anio: new Date().getFullYear(),
  inicio: '',
  fin: '',
  c1_desde: '',
  c1_hasta: '',
  c2_desde: '',
  c2_hasta: '',
  doble_turno: false,
}

export function CicloGeneralTab() {
  const { ciclo, isLoading } = useCiclo()
  const queryClient = useQueryClient()

  const { control, handleSubmit, reset } = useForm<CicloForm>({ defaultValues: EMPTY })

  useEffect(() => {
    if (ciclo) {
      reset({
        anio: ciclo.anio,
        inicio: ciclo.inicio ?? '',
        fin: ciclo.fin ?? '',
        c1_desde: ciclo.c1_desde ?? '',
        c1_hasta: ciclo.c1_hasta ?? '',
        c2_desde: ciclo.c2_desde ?? '',
        c2_hasta: ciclo.c2_hasta ?? '',
        doble_turno: ciclo.doble_turno ?? false,
      })
    }
  }, [ciclo, reset])

  const saveMutation = useMutation({
    mutationFn: async (values: CicloForm) => {
      const row = {
        anio: values.anio,
        inicio: values.inicio || null,
        fin: values.fin || null,
        c1_desde: values.c1_desde || null,
        c1_hasta: values.c1_hasta || null,
        c2_desde: values.c2_desde || null,
        c2_hasta: values.c2_hasta || null,
        doble_turno: values.doble_turno,
      }
      if (ciclo) {
        const { error } = await supabase.from('ciclos').update(row).eq('id', ciclo.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ciclos').insert(row)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Ciclo lectivo guardado')
      queryClient.invalidateQueries({ queryKey: ['ciclos'] })
      window.location.reload()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function onSubmit(values: CicloForm) {
    saveMutation.mutate(values)
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {!ciclo && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No hay un ciclo lectivo creado. Completá los datos para crear uno nuevo.
        </Alert>
      )}

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
          Datos del ciclo
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2.5 }}>
          <Controller
            name="anio"
            control={control}
            rules={{ required: 'Requerido' }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Año"
                type="number"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="inicio"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Inicio" type="date" slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
          <Controller
            name="fin"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Fin" type="date" slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
        </Box>
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
          Turnos
        </Typography>
        <Controller
          name="doble_turno"
          control={control}
          render={({ field }) => (
            <TextField
              select
              fullWidth
              label="Turnos por día"
              value={field.value ? 'doble' : 'simple'}
              onChange={(e) => field.onChange(e.target.value === 'doble')}
              helperText="Doble turno divide cada día en mañana y tarde (por ejemplo en la planilla de inasistencias)"
            >
              <MenuItem value="simple">Turno simple</MenuItem>
              <MenuItem value="doble">Doble turno</MenuItem>
            </TextField>
          )}
        />
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
          1° Cuatrimestre
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
          <Controller
            name="c1_desde"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Desde" type="date" slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
          <Controller
            name="c1_hasta"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Hasta" type="date" slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
        </Box>
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
          2° Cuatrimestre
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>
          <Controller
            name="c2_desde"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Desde" type="date" slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
          <Controller
            name="c2_hasta"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Hasta" type="date" slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
        </Box>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={18} /> : ciclo ? <Save /> : <Add />}
        >
          {ciclo ? 'Guardar' : 'Crear ciclo'}
        </Button>
      </Box>
    </form>
  )
}
