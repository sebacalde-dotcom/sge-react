import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRegularidad } from '@/features/inasistencias/useRegularidad'
import { formatFecha, formatNum } from '@/features/inasistencias/notificaciones/carta'
import { etiquetaPeriodo } from '@/features/inasistencias/notificaciones/periodos'

export interface CursoConSeccion {
  id: string
  nombre: string
  division: string | null
  seccion_id: string | null
  secciones: { id: string; nombre: string; seccion: string | null } | null
}

export interface Progenitor {
  nombre: string
  apellido: string
  dni: string
  rol: string
}

export interface CursoAdicional {
  id: string
  curso_id: string
  cursos: CursoConSeccion | null
}

export interface AlumnoAcademico {
  id: string
  persona_id: string
  ciclo_id: string
  curso_id: string | null
  ingles_id: string | null
  estado: string
  // Existen solo después de la migración 009
  fecha_ingreso?: string | null
  colegio_procedencia?: string | null
  progenitores?: Progenitor[] | null
  cursos: CursoConSeccion | null
}

export interface PaseRegistrado {
  id: string
  fecha: string
  colegio_destino: string | null
  motivo: string | null
}

export interface ContactoEmergencia {
  nombre: string
  relacion: string
  telefono: string | null
}

export interface Situacion {
  etiqueta: string
  color: 'success' | 'error' | 'warning' | 'default'
  detalle: string | null
}

// Referencia estable: se usa como dependencia de efectos y una lista nueva en cada render los dispararía sin fin
const SIN_ADICIONALES: CursoAdicional[] = []

export const textoCurso = (c: Pick<CursoConSeccion, 'nombre' | 'division'>) => `${c.nombre}${c.division ? ` ${c.division}` : ''}`

export function useAlumnoAcademico(personaId: string | undefined) {
  const regularidad = useRegularidad()

  const datosQ = useQuery({
    queryKey: ['alumno-academico', personaId],
    enabled: !!personaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alumno_datos')
        .select('*, cursos!alumno_datos_curso_id_fkey(id, nombre, division, seccion_id, secciones(id, nombre, seccion))')
        .eq('persona_id', personaId!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as AlumnoAcademico | null
    },
  })

  const paseQ = useQuery({
    queryKey: ['alumno-pase', personaId],
    enabled: !!personaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pases')
        .select('id, fecha, colegio_destino, motivo')
        .eq('persona_id', personaId!)
        .is('anulado_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) return null
      return (data?.[0] ?? null) as PaseRegistrado | null
    },
  })

  // Falla si todavía no se corrió la migración 010
  const adicionalesQ = useQuery({
    queryKey: ['alumno-cursos-adicionales', personaId],
    enabled: !!personaId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alumno_cursos')
        .select('id, curso_id, cursos(id, nombre, division, seccion_id, secciones(id, nombre, seccion))')
        .eq('persona_id', personaId!)
      if (error) throw error
      return data as unknown as CursoAdicional[]
    },
  })

  const emergenciaQ = useQuery({
    queryKey: ['alumno-emergencia', personaId],
    enabled: !!personaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alumno_responsables')
        .select('relacion, es_contacto_emergencia, personas:responsable_persona_id(apellido, nombre, telefono)')
        .eq('alumno_persona_id', personaId!)
        .eq('es_contacto_emergencia', true)
        .limit(1)
      if (error) return null
      const fila = (data as unknown as { relacion: string; personas: { apellido: string; nombre: string; telefono: string | null } }[] | null)?.[0]
      if (!fila) return null
      return {
        nombre: `${fila.personas.apellido}, ${fila.personas.nombre}`,
        relacion: fila.relacion,
        telefono: fila.personas.telefono,
      } as ContactoEmergencia
    },
  })

  const alumnoDatos = datosQ.data ?? null
  const pase = paseQ.data ?? null
  const enRegularidad = regularidad.alumnos.find((a) => a.persona_id === personaId)
  const reincorporaciones = regularidad.reincorporaciones
    .filter((r) => r.persona_id === personaId)
    .map((r) => r.fecha)
    .sort()

  let situacion: Situacion | null = null
  if (alumnoDatos) {
    if (alumnoDatos.estado === 'pase' || pase) {
      situacion = {
        etiqueta: 'Pase',
        color: 'warning',
        detalle: pase ? `${formatFecha(pase.fecha)}${pase.colegio_destino ? ` a ${pase.colegio_destino}` : ''}` : null,
      }
    } else if (alumnoDatos.estado === 'inactivo') {
      situacion = { etiqueta: 'Inactivo', color: 'default', detalle: null }
    } else if (alumnoDatos.estado === 'egresado') {
      situacion = { etiqueta: 'Egresado', color: 'default', detalle: null }
    } else if (enRegularidad) {
      const infr = enRegularidad.estado.infracciones[0]
      situacion = enRegularidad.estado.noRegular
        ? {
            etiqueta: 'No Regular',
            color: 'error',
            detalle: infr
              ? `desde el ${formatFecha(enRegularidad.estado.noRegularDesde ?? infr.fecha)} · ${formatNum(infr.regla.limite)} inasistencias en ${etiquetaPeriodo(infr.regla.periodo)}`
              : null,
          }
        : { etiqueta: 'Regular', color: 'success', detalle: null }
    } else if (!regularidad.isLoading) {
      situacion = { etiqueta: 'Regular', color: 'success', detalle: null }
    }
  }

  return {
    alumnoDatos,
    pase,
    emergencia: emergenciaQ.data ?? null,
    cursosAdicionales: adicionalesQ.data ?? SIN_ADICIONALES,
    soportaAdicionales: !adicionalesQ.isError,
    reincorporaciones,
    situacion,
    isLoading: datosQ.isLoading,
  }
}
