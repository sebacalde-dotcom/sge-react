import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { supabase } from '@/lib/supabase'
import { formatNum } from '@/features/inasistencias/notificaciones/carta'

export interface CursoDelAlumno {
  id: string
  etiqueta: string
}

interface MateriaDelCurso {
  id: string
  curso_id: string
  nombre: string
  horas_semanales?: number | null // existe después de la migración 014
  personal: { apellido: string; nombre: string } | null
}

/**
 * Las materias que cursa un alumno son las de los cursos a los que está asignado (el principal y los adicionales).
 * Se cargan en Ciclo Lectivo → Materias.
 */
export function MateriasQueCursa({ cursos }: { cursos: CursoDelAlumno[] }) {
  const ids = cursos.map((c) => c.id)

  const { data: materias = [], isLoading } = useQuery({
    queryKey: ['alumno-materias', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const consultar = (columnas: string) =>
        supabase
          .from('materias')
          .select(`id, curso_id, nombre, ${columnas}personal:personal_id(apellido, nombre)`)
          .in('curso_id', ids)
          .order('nombre')
      let { data, error } = await consultar('horas_semanales, ')
      if (error) ({ data, error } = await consultar('')) // sin la migración 014
      if (error) throw error
      return (data ?? []) as unknown as MateriaDelCurso[]
    },
  })

  if (ids.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        Asignale un curso al alumno para ver sus materias.
      </Typography>
    )
  }
  if (isLoading) return <CircularProgress size={22} />
  if (materias.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        Todavía no hay materias cargadas para {ids.length === 1 ? 'este curso' : 'estos cursos'}. Se cargan en Ciclo
        Lectivo → Materias.
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {cursos.map((curso) => {
        const delCurso = materias.filter((m) => m.curso_id === curso.id)
        if (delCurso.length === 0) return null
        return (
          <Box key={curso.id}>
            {cursos.length > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                {curso.etiqueta}
              </Typography>
            )}
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {delCurso.map((m) => (
                <Typography key={m.id} component="li" variant="body2" sx={{ py: 0.125 }}>
                  {m.nombre}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {m.horas_semanales != null ? ` · ${formatNum(m.horas_semanales)} hs` : ''}
                    {m.personal ? ` · ${m.personal.apellido}, ${m.personal.nombre}` : ''}
                  </Typography>
                </Typography>
              ))}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
