import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { useConfig } from '@/hooks/useConfig'
import {
  instanciaPeriodo,
  type NotificacionInasistencia,
  type PeriodoNotificacion,
} from '@/features/inasistencias/notificaciones'
import { descripcionPeriodo, resumir, type DatosCarta, type FilaInasistencia } from './carta'

export type EstadoCarta = 'impresa' | 'entregada' | 'firmada'

export interface RegistroCarta {
  id: string
  estado: EstadoCarta
  emitida_at: string
  entregada_at: string | null
  firmada_at: string | null
}

export interface NotificacionItem {
  key: string
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

interface AlumnoFila {
  persona_id: string
  personas: { apellido: string; nombre: string; dni: string | null } | null
  cursos: { nombre: string; division: string | null } | null
}

interface InasistenciaFila extends FilaInasistencia {
  persona_id: string
}

interface RegistroFila extends RegistroCarta {
  persona_id: string
  limite: number
  periodo: PeriodoNotificacion
  periodo_desde: string
  datos: DatosCarta
  personas: { apellido: string; nombre: string; dni: string | null } | null
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

export function useNotificacionesPendientes() {
  const { ciclo, cicloId } = useCiclo()
  const { data: config } = useConfig<{ notificaciones?: NotificacionInasistencia[] }>('inasistencias')

  const alumnosQ = useQuery({
    queryKey: ['tareas', 'alumnos', cicloId],
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
    queryKey: ['tareas', 'inasistencias', cicloId],
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
    queryKey: ['tareas', 'registros', cicloId],
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

  const resultado = useMemo(() => {
    const porImprimir: NotificacionItem[] = []
    const porEntregar: NotificacionItem[] = []
    const esperandoFirma: NotificacionItem[] = []
    if (!cicloId || !alumnosQ.data || !inasistenciasQ.data || !registrosQ.data) {
      return { porImprimir, porEntregar, esperandoFirma }
    }

    const reglas = (config?.notificaciones ?? [])
      .filter((n) => n.notificar_padres && n.limite > 0)
      .map((n) => ({ ...n, periodo: n.periodo ?? ('ciclo' as PeriodoNotificacion) }))

    const registradas = new Map<string, RegistroFila>()
    for (const r of registrosQ.data.filas) {
      registradas.set(`${r.persona_id}|${r.limite}|${r.periodo}|${r.periodo_desde}`, r)
    }

    const faltasPorPersona = new Map<string, InasistenciaFila[]>()
    for (const f of inasistenciasQ.data) {
      const lista = faltasPorPersona.get(f.persona_id)
      if (lista) lista.push(f)
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
          porImprimir.push({
            key,
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
      if (r.estado === 'firmada' || !r.personas) continue
      const item: NotificacionItem = {
        key: `${r.persona_id}|${r.limite}|${r.periodo}|${r.periodo_desde}`,
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
          estado: r.estado,
          emitida_at: r.emitida_at,
          entregada_at: r.entregada_at,
          firmada_at: r.firmada_at,
        },
      }
      if (r.estado === 'impresa') porEntregar.push(item)
      else esperandoFirma.push(item)
    }

    const orden = (a: NotificacionItem, b: NotificacionItem) =>
      a.apellido.localeCompare(b.apellido) || a.nombre.localeCompare(b.nombre) || a.limite - b.limite
    porImprimir.sort(orden)
    porEntregar.sort(orden)
    esperandoFirma.sort(orden)
    return { porImprimir, porEntregar, esperandoFirma }
  }, [cicloId, ciclo, config, alumnosQ.data, inasistenciasQ.data, registrosQ.data])

  const hayReglas = (config?.notificaciones ?? []).some((n) => n.notificar_padres)

  return {
    ...resultado,
    total: resultado.porImprimir.length + resultado.porEntregar.length + resultado.esperandoFirma.length,
    isLoading: alumnosQ.isLoading || inasistenciasQ.isLoading || registrosQ.isLoading,
    tablaDisponible: registrosQ.data?.disponible ?? true,
    hayReglas,
  }
}
