import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { instanciaPeriodo, type PeriodoNotificacion } from './periodos'
import { descripcionPeriodo, resumir, type DatosCarta, type FilaInasistencia } from './carta'
import { useConfigNotificaciones } from './useConfigNotificaciones'

export type EstadoCarta = 'impresa' | 'entregada' | 'firmada'
export type EstadoNotificacion = 'por_imprimir' | EstadoCarta

export const ESTADOS: { value: EstadoNotificacion; label: string; color: 'error' | 'warning' | 'info' | 'success' }[] = [
  { value: 'por_imprimir', label: 'Por imprimir', color: 'error' },
  { value: 'impresa', label: 'Impresa', color: 'warning' },
  { value: 'entregada', label: 'Entregada', color: 'info' },
  { value: 'firmada', label: 'Firmada', color: 'success' },
]

export interface RegistroCarta {
  id: string
  emitida_at: string
  entregada_at: string | null
  firmada_at: string | null
}

export interface NotificacionItem {
  key: string
  estado: EstadoNotificacion
  ciclo_id: string
  persona_id: string
  apellido: string
  nombre: string
  dni: string | null
  limite: number
  periodo: PeriodoNotificacion
  periodo_desde: string
  datos: DatosCarta
  registro: RegistroCarta | null
}

interface Persona {
  apellido: string
  nombre: string
  dni: string | null
}

interface AlumnoFila {
  persona_id: string
  personas: Persona | null
  cursos: { nombre: string; division: string | null } | null
}

interface InasistenciaFila extends FilaInasistencia {
  persona_id: string
}

interface RegistroFila extends RegistroCarta {
  persona_id: string
  estado: EstadoCarta
  limite: number
  periodo: PeriodoNotificacion
  periodo_desde: string
  datos: DatosCarta
  personas: Persona | null
}

async function traerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const tamano = 1000
  const filas: T[] = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await pagina(desde, desde + tamano - 1)
    if (error) throw error
    filas.push(...((data ?? []) as T[]))
    if (!data || data.length < tamano) break
  }
  return filas
}

const nombreCurso = (c: AlumnoFila['cursos']) => (c ? `${c.nombre}${c.division ? ` ${c.division}` : ''}` : '')

export function useNotificaciones() {
  const { ciclo, cicloId } = useCiclo()
  const { config, isLoading: cargandoConfig } = useConfigNotificaciones()

  const alumnosQ = useQuery({
    queryKey: ['notificaciones', 'alumnos', cicloId],
    enabled: !!cicloId,
    queryFn: () =>
      traerTodo<AlumnoFila>((desde, hasta) =>
        supabase
          .from('alumno_datos')
          .select(
            'persona_id, personas!alumno_datos_persona_id_fkey(apellido, nombre, dni), cursos!alumno_datos_curso_id_fkey(nombre, division)',
          )
          .eq('ciclo_id', cicloId!)
          .eq('estado', 'activo')
          .order('persona_id')
          .range(desde, hasta),
      ),
  })

  const inasistenciasQ = useQuery({
    queryKey: ['notificaciones', 'inasistencias', cicloId],
    enabled: !!cicloId,
    queryFn: () =>
      traerTodo<InasistenciaFila>((desde, hasta) =>
        supabase
          .from('inasistencias')
          .select('persona_id, fecha, tipo, valor, justificada')
          .eq('ciclo_id', cicloId!)
          .order('id')
          .range(desde, hasta),
      ),
  })

  const registrosQ = useQuery({
    queryKey: ['notificaciones', 'registros', cicloId],
    enabled: !!cicloId,
    queryFn: async () => {
      try {
        const filas = await traerTodo<RegistroFila>((desde, hasta) =>
          supabase
            .from('notificaciones_inasistencia')
            .select('*, personas(apellido, nombre, dni)')
            .eq('ciclo_id', cicloId!)
            .order('emitida_at')
            .range(desde, hasta),
        )
        return { disponible: true, filas }
      } catch {
        return { disponible: false, filas: [] as RegistroFila[] }
      }
    },
  })

  const items = useMemo(() => {
    const lista: NotificacionItem[] = []
    if (!cicloId || !alumnosQ.data || !inasistenciasQ.data || !registrosQ.data) return lista

    const reglas = config.notificaciones.filter((n) => n.notificar_padres && n.limite > 0)

    const registradas = new Set<string>()
    for (const r of registrosQ.data.filas) {
      registradas.add(`${r.persona_id}|${r.limite}|${r.periodo}|${r.periodo_desde}`)
    }

    const faltasPorPersona = new Map<string, InasistenciaFila[]>()
    for (const f of inasistenciasQ.data) {
      const faltas = faltasPorPersona.get(f.persona_id)
      if (faltas) faltas.push(f)
      else faltasPorPersona.set(f.persona_id, [f])
    }

    for (const alumno of alumnosQ.data) {
      const p = alumno.personas
      const faltas = faltasPorPersona.get(alumno.persona_id)
      if (!p || !faltas) continue
      const curso = nombreCurso(alumno.cursos)

      for (const regla of reglas) {
        const grupos = new Map<string, { desde: string; hasta: string; filas: InasistenciaFila[] }>()
        for (const f of faltas) {
          const inst = instanciaPeriodo(regla.periodo, f.fecha, ciclo)
          const g = grupos.get(inst.clave)
          if (g) g.filas.push(f)
          else grupos.set(inst.clave, { desde: inst.desde, hasta: inst.hasta, filas: [f] })
        }

        for (const [clave, g] of grupos) {
          const resumenPeriodo = resumir(g.filas)
          if (resumenPeriodo.total < regla.limite) continue
          const key = `${alumno.persona_id}|${regla.limite}|${regla.periodo}|${clave}`
          if (registradas.has(key)) continue
          const desde = regla.periodo === 'ciclo' ? (ciclo?.inicio ?? clave) : g.desde
          const hasta = regla.periodo === 'ciclo' ? (ciclo?.fin ?? clave) : g.hasta
          lista.push({
            key,
            estado: 'por_imprimir',
            ciclo_id: cicloId,
            persona_id: alumno.persona_id,
            apellido: p.apellido,
            nombre: p.nombre,
            dni: p.dni,
            limite: regla.limite,
            periodo: regla.periodo,
            periodo_desde: clave,
            registro: null,
            datos: {
              curso,
              anio: ciclo?.anio ?? null,
              periodo_texto: descripcionPeriodo(regla.periodo, desde, hasta, ciclo),
              periodo: resumenPeriodo,
              ciclo: resumir(faltas),
              fechas: [...g.filas]
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .map((f) => ({ fecha: f.fecha, tipo: f.tipo, valor: Number(f.valor), justificada: f.justificada })),
            },
          })
        }
      }
    }

    for (const r of registrosQ.data.filas) {
      if (!r.personas) continue
      lista.push({
        key: `${r.persona_id}|${r.limite}|${r.periodo}|${r.periodo_desde}`,
        estado: r.estado,
        ciclo_id: cicloId,
        persona_id: r.persona_id,
        apellido: r.personas.apellido,
        nombre: r.personas.nombre,
        dni: r.personas.dni,
        limite: Number(r.limite),
        periodo: r.periodo,
        periodo_desde: r.periodo_desde,
        datos: r.datos,
        registro: {
          id: r.id,
          emitida_at: r.emitida_at,
          entregada_at: r.entregada_at,
          firmada_at: r.firmada_at,
        },
      })
    }

    return lista.sort(
      (a, b) => a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre) || a.limite - b.limite,
    )
  }, [cicloId, ciclo, config.notificaciones, alumnosQ.data, inasistenciasQ.data, registrosQ.data])

  const conteos = useMemo(() => {
    const c: Record<EstadoNotificacion, number> = { por_imprimir: 0, impresa: 0, entregada: 0, firmada: 0 }
    for (const i of items) c[i.estado]++
    return c
  }, [items])

  return {
    items,
    conteos,
    pendientes: conteos.por_imprimir + conteos.impresa + conteos.entregada,
    isLoading: cargandoConfig || alumnosQ.isLoading || inasistenciasQ.isLoading || registrosQ.isLoading,
    tablaDisponible: registrosQ.data?.disponible ?? true,
    hayReglas: config.notificaciones.some((n) => n.notificar_padres),
  }
}
