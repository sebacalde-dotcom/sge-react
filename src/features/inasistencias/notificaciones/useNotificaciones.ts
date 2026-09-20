import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { instanciaPeriodo, type PeriodoNotificacion } from './periodos'
import {
  nombreCurso,
  traerTodo,
  useAlumnosCiclo,
  useFaltasCiclo,
  type FaltaCiclo,
  type PersonaBasica,
} from '../datosCiclo'
import { descripcionPeriodo, resumir, type DatosCarta } from './carta'
import { useConfigNotificaciones } from './useConfigNotificaciones'
import { useRegularidad } from '../useRegularidad'

export type EstadoCarta = 'impresa' | 'entregada' | 'firmada'
export type EstadoNotificacion = 'por_imprimir' | EstadoCarta
export type TipoNotificacion = 'inasistencias' | 'no_regular'
export type PeriodoRegistro = PeriodoNotificacion | 'no_regular'

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
  tipo: TipoNotificacion
  ciclo_id: string
  persona_id: string
  apellido: string
  nombre: string
  dni: string | null
  limite: number
  periodo: PeriodoRegistro
  periodo_desde: string
  datos: DatosCarta
  registro: RegistroCarta | null
}

interface RegistroFila extends RegistroCarta {
  persona_id: string
  estado: EstadoCarta
  limite: number
  periodo: PeriodoRegistro
  periodo_desde: string
  datos: DatosCarta
  personas: PersonaBasica | null
}

export function useNotificaciones() {
  const { ciclo, cicloId } = useCiclo()
  const { config, isLoading: cargandoConfig } = useConfigNotificaciones()

  const alumnosQ = useAlumnosCiclo()
  const inasistenciasQ = useFaltasCiclo()
  const regularidad = useRegularidad()

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

    const faltasPorPersona = new Map<string, FaltaCiclo[]>()
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
        const grupos = new Map<string, { desde: string; hasta: string; filas: FaltaCiclo[] }>()
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
            tipo: 'inasistencias',
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

    const avisoNoRegular = config.no_regular
    if (avisoNoRegular.activa && avisoNoRegular.notificar_padres) {
      for (const a of regularidad.alumnos) {
        const infr = a.estado.infracciones[0]
        if (!a.estado.noRegular || !infr) continue
        const base = a.ultimaReincorporacion ?? `${ciclo?.anio ?? new Date().getFullYear()}-01-01`
        const key = `${a.persona_id}|0|no_regular|${base}`
        if (registradas.has(key)) continue
        const faltasPeriodo = a.faltas.filter(
          (f) => f.fecha >= infr.desde && f.fecha <= infr.hasta && (!a.ultimaReincorporacion || f.fecha >= a.ultimaReincorporacion),
        )
        lista.push({
          key,
          estado: 'por_imprimir',
          tipo: 'no_regular',
          ciclo_id: cicloId,
          persona_id: a.persona_id,
          apellido: a.apellido,
          nombre: a.nombre,
          dni: a.dni,
          limite: 0,
          periodo: 'no_regular',
          periodo_desde: base,
          registro: null,
          datos: {
            curso: a.curso,
            anio: ciclo?.anio ?? null,
            periodo_texto: descripcionPeriodo(infr.regla.periodo, infr.desde, infr.hasta, ciclo),
            periodo: resumir(faltasPeriodo),
            ciclo: resumir(a.faltas),
            fechas: [...faltasPeriodo]
              .sort((x, y) => x.fecha.localeCompare(y.fecha))
              .map((f) => ({ fecha: f.fecha, tipo: f.tipo, valor: Number(f.valor), justificada: f.justificada })),
            no_regular_desde: infr.fecha,
            regla_limite: infr.regla.limite,
            regla_periodo: infr.regla.periodo,
          },
        })
      }
    }

    for (const r of registrosQ.data.filas) {
      if (!r.personas) continue
      lista.push({
        key: `${r.persona_id}|${r.limite}|${r.periodo}|${r.periodo_desde}`,
        estado: r.estado,
        tipo: r.periodo === 'no_regular' ? 'no_regular' : 'inasistencias',
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
  }, [cicloId, ciclo, config.notificaciones, config.no_regular, regularidad.alumnos, alumnosQ.data, inasistenciasQ.data, registrosQ.data])

  const conteos = useMemo(() => {
    const c: Record<EstadoNotificacion, number> = { por_imprimir: 0, impresa: 0, entregada: 0, firmada: 0 }
    for (const i of items) c[i.estado]++
    return c
  }, [items])

  return {
    items,
    conteos,
    pendientes: conteos.por_imprimir + conteos.impresa + conteos.entregada,
    isLoading: cargandoConfig || regularidad.isLoading || alumnosQ.isLoading || inasistenciasQ.isLoading || registrosQ.isLoading,
    tablaDisponible: registrosQ.data?.disponible ?? true,
    hayReglas: config.notificaciones.some((n) => n.notificar_padres) || (config.no_regular.activa && config.no_regular.notificar_padres),
  }
}
