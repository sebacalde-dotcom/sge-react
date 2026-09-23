import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { supabase } from '@/lib/supabase'
import { formatNum } from '@/features/inasistencias/notificaciones/carta'
import { hoyISO } from '@/features/inasistencias/useRegularidad'
import { vigenteEn } from '@/features/config/ciclo/agrupamientos'

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
export function MateriasQueCursa({ cursos, personaId }: { cursos: CursoDelAlumno[]; personaId?: string }) {
  const ids = cursos.map((c) => c.id)

  // En qué grupo está hoy de cada materia que se divide en grupos (agrupamientos). Sin la migración 020 no hay ninguno.
  const { data: gruposPorMateria = new Map<string, { grupo: string; docente: string | null }>() } = useQuery({
    queryKey: ['alumno-grupos', personaId],
    enabled: !!personaId,
    queryFn: async () => {
      const mapa = new Map<string, { grupo: string; docente: string | null }>()
      const { data: periodos, error } = await supabase
        .from('grupo_alumnos')
        .select('agrupamiento_id, desde, hasta, grupos(nombre, personal:personas(apellido, nombre))')
        .eq('persona_id', personaId!)
      if (error || !periodos || periodos.length === 0) return mapa
      const hoy = hoyISO()
      const vigentes = (periodos as unknown as { agrupamiento_id: string; desde: string; hasta: string | null; grupos: { nombre: string; personal: { apellido: string; nombre: string } | null } | null }[]).filter(
        (p) => p.grupos && vigenteEn(p, hoy),
      )
      if (vigentes.length === 0) return mapa
      const { data: vinculos } = await supabase
        .from('agrupamiento_materias')
        .select('materia_id, agrupamiento_id')
        .in('agrupamiento_id', vigentes.map((p) => p.agrupamiento_id))
      for (const v of vinculos ?? []) {
        const periodo = vigentes.find((p) => p.agrupamiento_id === v.agrupamiento_id)
        if (periodo?.grupos) {
          mapa.set(v.materia_id as string, {
            grupo: periodo.grupos.nombre,
            docente: periodo.grupos.personal ? `${periodo.grupos.personal.apellido}, ${periodo.grupos.personal.nombre}` : null,
          })
        }
      }
      return mapa
    },
  })

  const { data: materias = [], isLoading } = useQuery({
    queryKey: ['alumno-materias', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const consultar = (columnas: string) =>
        supabase
          .from('materias')
          .select(`id, curso_id, nombre, ${columnas}personal:personas(apellido, nombre)`)
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
                    {gruposPorMateria.has(m.id)
                      ? ` · grupo ${gruposPorMateria.get(m.id)!.grupo}${gruposPorMateria.get(m.id)!.docente ? ` · ${gruposPorMateria.get(m.id)!.docente}` : ''}`
                      : m.personal
                        ? ` · ${m.personal.apellido}, ${m.personal.nombre}`
                        : ''}
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
