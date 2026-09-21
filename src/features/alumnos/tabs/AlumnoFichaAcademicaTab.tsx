import { useEffect } from 'react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { Save, Add, Delete } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { AlumnoEgreso } from './AlumnoEgreso'
import { MateriasQueCursa, type CursoDelAlumno } from '../MateriasQueCursa'
import { textoCurso, useAlumnoAcademico } from '../useAlumnoAcademico'

interface Asignacion {
  seccion_id: string
  curso_id: string
}

interface AcademicaForm {
  fecha_ingreso: string
  colegio_procedencia: string
  asignaciones: Asignacion[]
}

interface CursoOpcion {
  id: string
  nombre: string
  division: string | null
  seccion_id: string | null
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
      {children}
    </Typography>
  )
}

export function AlumnoFichaAcademicaTab({ personaId, nombre }: { personaId: string; nombre: string }) {
  const queryClient = useQueryClient()
  const { alumnoDatos, pase, cursosAdicionales, soportaAdicionales, isLoading } = useAlumnoAcademico(personaId)
  const cicloId = alumnoDatos?.ciclo_id ?? null

  const { control, handleSubmit, reset, watch, setValue } = useForm<AcademicaForm>({
    defaultValues: { fecha_ingreso: '', colegio_procedencia: '', asignaciones: [{ seccion_id: '', curso_id: '' }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'asignaciones' })
  const asignaciones = watch('asignaciones')

  const { data: secciones = [] } = useQuery({
    queryKey: ['secciones', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const { data, error } = await supabase.from('secciones').select('id, nombre').eq('ciclo_id', cicloId!).order('nombre')
      if (error) throw error
      return data as { id: string; nombre: string }[]
    },
  })

  const { data: cursos = [] } = useQuery({
    queryKey: ['cursos-academica', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cursos')
        .select('id, nombre, division, seccion_id')
        .eq('ciclo_id', cicloId!)
        .order('nombre')
      if (error) throw error
      return data as CursoOpcion[]
    },
  })

  const soportaIngreso = !!alumnoDatos && 'fecha_ingreso' in alumnoDatos

  useEffect(() => {
    if (alumnoDatos) {
      reset({
        fecha_ingreso: alumnoDatos.fecha_ingreso ?? '',
        colegio_procedencia: alumnoDatos.colegio_procedencia ?? '',
        asignaciones: [
          { seccion_id: alumnoDatos.cursos?.seccion_id ?? '', curso_id: alumnoDatos.curso_id ?? '' },
          ...cursosAdicionales.map((a) => ({ seccion_id: a.cursos?.seccion_id ?? '', curso_id: a.curso_id })),
        ],
      })
    }
  }, [alumnoDatos, cursosAdicionales, reset])

  const saveMutation = useMutation({
    mutationFn: async (values: AcademicaForm) => {
      const [principal, ...extras] = values.asignaciones
      const idsExtra = extras.map((e) => e.curso_id).filter(Boolean)
      if (new Set(idsExtra).size !== idsExtra.length || (principal.curso_id && idsExtra.includes(principal.curso_id))) {
        throw new Error('Hay un curso repetido: cada sección y curso se puede asignar una sola vez')
      }

      const { data, error } = await supabase
        .from('alumno_datos')
        .update({
          curso_id: principal.curso_id || null,
          ...(soportaIngreso
            ? { fecha_ingreso: values.fecha_ingreso || null, colegio_procedencia: values.colegio_procedencia.trim() || null }
            : {}),
        })
        .eq('id', alumnoDatos!.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo guardar la ficha académica (sin permisos en la base)')

      if (soportaAdicionales) {
        const aBorrar = cursosAdicionales.filter((a) => !idsExtra.includes(a.curso_id)).map((a) => a.id)
        if (aBorrar.length > 0) {
          const { error: delError } = await supabase.from('alumno_cursos').delete().in('id', aBorrar)
          if (delError) throw delError
        }
        const actuales = cursosAdicionales.map((a) => a.curso_id)
        const nuevos = idsExtra
          .filter((id) => !actuales.includes(id))
          .map((curso_id) => ({ persona_id: personaId, ciclo_id: alumnoDatos!.ciclo_id, curso_id }))
        if (nuevos.length > 0) {
          const { error: insError } = await supabase.from('alumno_cursos').insert(nuevos)
          if (insError) throw insError
        }
      }
    },
    onSuccess: () => {
      toast.success('Ficha académica actualizada')
      for (const clave of [
        ['alumno-academico', personaId],
        ['alumno-cursos-adicionales', personaId],
        ['alumno-datos'],
        ['alumnos'],
        ['alumnos-curso'],
        ['ciclo-datos'],
        ['notificaciones'],
      ]) {
        queryClient.invalidateQueries({ queryKey: clave })
      }
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
  }

  if (!alumnoDatos) {
    return <Alert severity="info">Este alumno todavía no tiene datos de ciclo lectivo cargados.</Alert>
  }

  // Las materias salen de los cursos ya guardados del alumno (el principal y los adicionales)
  const etiquetaDe = (c: { nombre: string; division: string | null; secciones: { nombre: string } | null }) =>
    `${c.secciones?.nombre ?? 'Sin sección'} · ${textoCurso(c)}`
  const cursosQueCursa: CursoDelAlumno[] = [
    ...(alumnoDatos.curso_id && alumnoDatos.cursos ? [{ id: alumnoDatos.curso_id, etiqueta: etiquetaDe(alumnoDatos.cursos) }] : []),
    ...cursosAdicionales.flatMap((a) => (a.cursos ? [{ id: a.curso_id, etiqueta: etiquetaDe(a.cursos) }] : [])),
  ]

  return (
    <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
      <Card sx={{ p: 3, mb: 3 }}>
        <SectionTitle>Ingreso a la institución</SectionTitle>
        {!soportaIngreso && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Falta correr la migración 009 en Supabase para guardar la fecha de ingreso y el colegio de procedencia.
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2.5 }}>
          <Controller name="fecha_ingreso" control={control} render={({ field }) => (
            <TextField {...field} label="Fecha de ingreso" type="date" disabled={!soportaIngreso} slotProps={{ inputLabel: { shrink: true } }} />
          )} />
          <Controller name="colegio_procedencia" control={control} render={({ field }) => (
            <TextField {...field} label="Colegio de procedencia" disabled={!soportaIngreso} />
          )} />
        </Box>
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <SectionTitle>Sección y curso</SectionTitle>
        {!soportaAdicionales && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Falta correr la migración 010 en Supabase para poder asignar más de una sección y curso.
          </Alert>
        )}
        {fields.map((field, index) => {
          const seccionId = asignaciones[index]?.seccion_id ?? ''
          const cursosDeLaSeccion = seccionId ? cursos.filter((c) => c.seccion_id === seccionId) : cursos
          return (
            <Box key={field.id} sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <Controller name={`asignaciones.${index}.seccion_id`} control={control} render={({ field: f }) => (
                <TextField
                  {...f}
                  select
                  label="Sección"
                  sx={{ flex: 1 }}
                  helperText={index === 0 ? 'Principal' : undefined}
                  onChange={(e) => {
                    f.onChange(e.target.value)
                    const actual = cursos.find((c) => c.id === asignaciones[index]?.curso_id)
                    if (e.target.value && actual && actual.seccion_id !== e.target.value) setValue(`asignaciones.${index}.curso_id`, '')
                  }}
                >
                  <MenuItem value="">Todas</MenuItem>
                  {secciones.map((s) => <MenuItem key={s.id} value={s.id}>{s.nombre}</MenuItem>)}
                </TextField>
              )} />
              <Controller name={`asignaciones.${index}.curso_id`} control={control} render={({ field: f }) => (
                <TextField
                  {...f}
                  select
                  label="Curso"
                  sx={{ flex: 1 }}
                  onChange={(e) => {
                    f.onChange(e.target.value)
                    const elegido = cursos.find((c) => c.id === e.target.value)
                    if (elegido?.seccion_id) setValue(`asignaciones.${index}.seccion_id`, elegido.seccion_id)
                  }}
                >
                  <MenuItem value="">Sin asignar</MenuItem>
                  {cursosDeLaSeccion.map((c) => <MenuItem key={c.id} value={c.id}>{textoCurso(c)}</MenuItem>)}
                </TextField>
              )} />
              <Box sx={{ width: 40, flexShrink: 0 }}>
                {index > 0 && (
                  <IconButton size="small" color="error" onClick={() => remove(index)} aria-label="Quitar sección y curso">
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          )
        })}
        <Button
          size="small"
          startIcon={<Add />}
          disabled={!soportaAdicionales}
          onClick={() => append({ seccion_id: '', curso_id: '' })}
        >
          Agregar otra sección y curso
        </Button>
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <SectionTitle>Materias que cursa</SectionTitle>
        <MateriasQueCursa cursos={cursosQueCursa} />
      </Card>

      <Card sx={{ p: 3, mb: 3 }}>
        <SectionTitle>Egreso de la institución</SectionTitle>
        <AlumnoEgreso personaId={personaId} nombre={nombre} pase={pase} />
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={saveMutation.isPending}
          startIcon={saveMutation.isPending ? <CircularProgress size={18} /> : <Save />}
        >
          Guardar
        </Button>
      </Box>
    </form>
  )
}
