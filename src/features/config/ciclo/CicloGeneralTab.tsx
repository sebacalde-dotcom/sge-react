import { useEffect } from 'react'
import { useForm, Controller, useFieldArray, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import { Save, Add, Delete, AutoFixHigh } from '@mui/icons-material'
import { useCiclo } from '@/contexts/CicloContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { sugerirBimestres, sugerirTrimestres, validarPeriodos } from './sugerirPeriodos'

interface PeriodoForm {
  desde: string
  hasta: string
}

interface CicloForm {
  anio: number
  inicio: string
  fin: string
  c1_desde: string
  c1_hasta: string
  c2_desde: string
  c2_hasta: string
  doble_turno: boolean
  bimestres: PeriodoForm[]
  trimestres: PeriodoForm[]
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
  bimestres: [],
  trimestres: [],
}

const tituloSeccion = {
  mb: 2,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: '0.7rem',
  color: 'text.secondary',
} as const

interface ListaPeriodosProps {
  titulo: string
  singular: string
  name: 'bimestres' | 'trimestres'
  control: Control<CicloForm>
  campos: { id: string }[]
  deshabilitado: boolean
  onAgregar: () => void
  onQuitar: (indice: number) => void
  onSugerir: () => void
}

function ListaPeriodos({ titulo, singular, name, control, campos, deshabilitado, onAgregar, onQuitar, onSugerir }: ListaPeriodosProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>{titulo}</Typography>
      {campos.length === 0 && (
        <Typography variant="body2" sx={{ mb: 1.5, color: 'text.disabled' }}>
          Sin cargar: se calculan por bloques de meses.
        </Typography>
      )}
      {campos.map((campo, index) => (
        <Box key={campo.id} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ width: 110, color: 'text.secondary' }}>{index + 1}° {singular}</Typography>
          <Controller
            name={`${name}.${index}.desde`}
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Desde" type="date" size="small" disabled={deshabilitado} slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
          <Controller
            name={`${name}.${index}.hasta`}
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Hasta" type="date" size="small" disabled={deshabilitado} slotProps={{ inputLabel: { shrink: true } }} />
            )}
          />
          <IconButton size="small" color="error" disabled={deshabilitado} onClick={() => onQuitar(index)} aria-label={`Quitar el ${index + 1}° ${singular}`}>
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" startIcon={<Add />} disabled={deshabilitado} onClick={onAgregar}>Agregar {singular}</Button>
        <Button size="small" startIcon={<AutoFixHigh />} disabled={deshabilitado} onClick={onSugerir}>
          Sugerir fechas
        </Button>
      </Box>
    </Box>
  )
}

export function CicloGeneralTab() {
  const { ciclo, isLoading } = useCiclo()
  const queryClient = useQueryClient()

  const { control, handleSubmit, reset, getValues } = useForm<CicloForm>({ defaultValues: EMPTY })
  const bimestres = useFieldArray({ control, name: 'bimestres' })
  const trimestres = useFieldArray({ control, name: 'trimestres' })
  // Sin la migración 012 la columna no existe y los períodos no se pueden guardar
  const soportaPeriodos = !ciclo || 'periodos' in ciclo

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
        bimestres: ciclo.periodos?.bimestres ?? [],
        trimestres: ciclo.periodos?.trimestres ?? [],
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
        ...(soportaPeriodos ? { periodos: periodosParaGuardar(values) } : {}),
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

  const sinFilasVacias = (lista: PeriodoForm[]) => lista.filter((p) => p.desde || p.hasta)

  function periodosParaGuardar(values: CicloForm) {
    const b = sinFilasVacias(values.bimestres)
    const t = sinFilasVacias(values.trimestres)
    return b.length > 0 || t.length > 0 ? { bimestres: b, trimestres: t } : null
  }

  function onSubmit(values: CicloForm) {
    if (soportaPeriodos) {
      const limites = { inicio: values.inicio, fin: values.fin }
      const problema =
        validarPeriodos('bimestre', sinFilasVacias(values.bimestres), limites) ??
        validarPeriodos('trimestre', sinFilasVacias(values.trimestres), limites)
      if (problema) {
        toast.error(problema)
        return
      }
    }
    saveMutation.mutate(values)
  }

  function sugerir(tipo: 'bimestres' | 'trimestres') {
    const v = getValues()
    const calendario = { inicio: v.inicio || null, fin: v.fin || null, dias_especiales: ciclo?.dias_especiales ?? null }
    const sugeridos = tipo === 'bimestres' ? sugerirBimestres(v, calendario) : sugerirTrimestres(v, calendario)
    if (!sugeridos) {
      toast.error(
        tipo === 'bimestres'
          ? 'Cargá primero el inicio y el fin del ciclo (y, si los tenés, los cuatrimestres)'
          : 'Cargá primero el inicio y el fin del ciclo',
      )
      return
    }
    ;(tipo === 'bimestres' ? bimestres : trimestres).replace(sugeridos)
    toast.success('Fechas sugeridas: revisalas y ajustalas si hace falta')
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

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" sx={tituloSeccion}>
          Bimestres y trimestres
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Son los tramos en los que se cuentan las inasistencias (por ejemplo, un tope por bimestre). Cargalos con las
          fechas reales del calendario escolar. Si no los cargás, se calculan por bloques de meses desde el inicio del
          ciclo, y eso casi nunca coincide con el calendario. Cambiar estas fechas después de haber generado
          notificaciones puede hacer que se repitan.
        </Typography>
        {!soportaPeriodos && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Falta correr la migración 012 en Supabase para guardar los bimestres y trimestres.
          </Alert>
        )}
        <ListaPeriodos
          titulo="Bimestres"
          singular="bimestre"
          name="bimestres"
          control={control}
          campos={bimestres.fields}
          deshabilitado={!soportaPeriodos}
          onAgregar={() => bimestres.append({ desde: '', hasta: '' })}
          onQuitar={bimestres.remove}
          onSugerir={() => sugerir('bimestres')}
        />
        <ListaPeriodos
          titulo="Trimestres"
          singular="trimestre"
          name="trimestres"
          control={control}
          campos={trimestres.fields}
          deshabilitado={!soportaPeriodos}
          onAgregar={() => trimestres.append({ desde: '', hasta: '' })}
          onQuitar={trimestres.remove}
          onSugerir={() => sugerir('trimestres')}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          "Sugerir fechas" reparte los días de clase en partes iguales, sin contar feriados ni asuetos del calendario. Los
          bimestres se sugieren dentro de cada cuatrimestre (dos por cuatrimestre); los trimestres, entre el inicio y el
          fin del ciclo.
        </Typography>
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
