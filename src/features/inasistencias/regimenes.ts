import type { TipoInasistencia } from './conteo'
import type { NotificacionInasistencia } from './notificaciones/periodos'
import type { ReglaRegularidad } from './regularidad'

/** Por ahora la app sirve solo a escuelas de la Provincia de Buenos Aires y de la Ciudad de Buenos Aires. */
export type IdRegimen = 'caba' | 'pba'

/**
 * Régimen de asistencia y evaluación de una jurisdicción. Se elige la jurisdicción en Institución y el régimen
 * vigente en cada Ciclo Lectivo. Los valores de acá se cargan en la configuración al aplicarlos y después se pueden
 * ajustar: las normas cambian y cada escuela tiene sus particularidades.
 */
export interface Regimen {
  id: IdRegimen
  nombre: string
  descripcion: string
  /** Normativa de la que salen los valores. */
  fuente: string
  /** Los valores salen de textos compartidos por el usuario y todavía no se contrastaron con la resolución vigente. */
  aVerificar: boolean
  /** Lo que el régimen todavía no puede expresar en el sistema, para decirlo antes de aplicarlo. */
  limitaciones: string[]
  tipos: TipoInasistencia[]
  reglas_regularidad: ReglaRegularidad[]
  permite_reincorporaciones: boolean
  avisos: NotificacionInasistencia[]
}

export const REGIMENES: Regimen[] = [
  {
    id: 'caba',
    nombre: 'Ciudad de Buenos Aires (CABA)',
    descripcion:
      'Hasta 20 inasistencias injustificadas en el año y un tope de 5 por bimestre. Al superarlos se pierde la ' +
      'regularidad y no hay reincorporaciones por criterio institucional. Las llegadas tarde y los retiros anticipados ' +
      'valen 1/4 de falta y, en doble turno, cada turno que se falta vale 1/2.',
    fuente: 'Boletín Oficial de la Ciudad: pautas de control de inasistencias y Resolución 3732/22 (cómputos especiales)',
    aVerificar: true,
    limitaciones: [
      'Secundaria Tradicional: la pérdida de regularidad rige al cierre del cuatrimestre. Hoy se pierde apenas se supera el tope.',
      'Secundaria Aprende: hace falta ser No Regular en dos bimestres consecutivos. Todavía no se puede configurar.',
      'La recuperación obligatoria (receso de invierno o de diciembre a febrero) no se registra en el sistema.',
      'Hay que definir los 4 bimestres en Ciclo Lectivo.',
    ],
    tipos: [
      { nombre: 'Ausente', valor: 1, valor_doble_turno: 0.5, tecla: 'A' },
      { nombre: 'Ingreso tardío', valor: 0.25, tecla: 'T' },
      { nombre: 'Retiro anticipado', valor: 0.25, tecla: 'R' },
      { nombre: 'Ausente con presencia en clase', valor: 1, valor_doble_turno: 0.5, tecla: 'P' },
    ],
    reglas_regularidad: [
      { limite: 5, periodo: 'bimestre', comparacion: 'supera', cuenta: 'injustificadas' },
      { limite: 20, periodo: 'ciclo', comparacion: 'supera', cuenta: 'injustificadas' },
    ],
    permite_reincorporaciones: false,
    avisos: [],
  },
  {
    id: 'pba',
    nombre: 'Provincia de Buenos Aires (PBA)',
    descripcion:
      'Tope de 28 inasistencias institucionales por año, y cuentan todas, también las justificadas. No existe la pérdida ' +
      'de regularidad: la escuela cita a los adultos responsables a las 10 y a las 20, e interviene el equipo directivo a ' +
      'las 28. La llegada tarde vale 1/4 de falta y, en doble turno, cada turno que se falta vale 1/2.',
    fuente: 'Nuevo Régimen Académico: Resolución CGE 1650/24 y su Anexo 4 de Asistencia',
    aVerificar: true,
    limitaciones: [
      'Al llegar a las 28, se verifica con todas las inasistencias del año si el alumno llega al 75% de asistencia en cada materia. Eso necesita Materias, Horario y asistencia por materia, que todavía no existen: por ahora solo se avisa.',
      'La citación con acta y la intervención del equipo directivo se resuelven hoy con el aviso en la planilla y la carta a los padres.',
    ],
    tipos: [
      { nombre: 'Ausente', valor: 1, valor_doble_turno: 0.5, tecla: 'A' },
      { nombre: 'Llegada tarde', valor: 0.25, tecla: 'T' },
    ],
    reglas_regularidad: [],
    permite_reincorporaciones: false,
    avisos: [
      {
        limite: 10,
        periodo: 'ciclo',
        cuenta: 'todas',
        comparacion: 'alcanza',
        notificar_padres: true,
        mensaje: 'Citar formalmente a los adultos responsables para labrar un acta.',
      },
      {
        limite: 20,
        periodo: 'ciclo',
        cuenta: 'todas',
        comparacion: 'alcanza',
        notificar_padres: true,
        mensaje: 'Segunda citación a los adultos responsables y seguimiento.',
      },
      {
        limite: 28,
        periodo: 'ciclo',
        cuenta: 'todas',
        comparacion: 'alcanza',
        notificar_padres: true,
        mensaje: 'Interviene el equipo directivo y de orientación. Se verifica el 75% de asistencia por materia.',
      },
    ],
  },
]

export const regimenPorId = (id: string | null | undefined) => REGIMENES.find((r) => r.id === id)

/** El régimen que rige: el elegido para el ciclo o, si no eligió, el de la jurisdicción de la institución. */
export function regimenEfectivo(delCiclo: string | null | undefined, jurisdiccion: string | null | undefined): Regimen | undefined {
  return regimenPorId(delCiclo) ?? regimenPorId(jurisdiccion)
}

/** De dónde sale el régimen que rige, para decírselo a quien lo mira. */
export function origenDelRegimen(
  delCiclo: string | null | undefined,
  jurisdiccion: string | null | undefined,
): 'ciclo' | 'institucion' | null {
  if (regimenPorId(delCiclo)) return 'ciclo'
  return regimenPorId(jurisdiccion) ? 'institucion' : null
}

/**
 * Al aplicar un régimen se conservan las teclas que la escuela ya eligió para los tipos que siguen existiendo
 * (las teclas son una preferencia, no parte del régimen). Si eso dejara una tecla repetida, se usan las del régimen.
 */
export function tiposConTeclasDeLaEscuela(tipos: TipoInasistencia[], actuales: TipoInasistencia[]): TipoInasistencia[] {
  const conTeclasPrevias = tipos.map((t) => ({ ...t, tecla: actuales.find((a) => a.nombre === t.nombre)?.tecla || t.tecla }))
  const teclas = conTeclasPrevias.map((t) => t.tecla.toUpperCase())
  return new Set(teclas).size === teclas.length && !teclas.includes('J') ? conTeclasPrevias : tipos
}

/** Al aplicar un régimen se conservan el mensaje y el "notificar a los padres" de los avisos que la escuela ya tenía. */
export function avisosConAjustesDeLaEscuela(
  avisos: NotificacionInasistencia[],
  actuales: NotificacionInasistencia[],
): NotificacionInasistencia[] {
  return avisos.map((aviso) => {
    const previo = actuales.find((a) => a.limite === aviso.limite && a.periodo === aviso.periodo)
    return previo ? { ...aviso, mensaje: previo.mensaje, notificar_padres: previo.notificar_padres } : aviso
  })
}

/** Lo que hoy está configurado en el sistema y que un régimen puede fijar. */
export interface ConfigAsistencia {
  tipos: TipoInasistencia[]
  reglas_regularidad: ReglaRegularidad[]
  permite_reincorporaciones: boolean
  avisos: NotificacionInasistencia[]
}

export type AreaDelRegimen = 'Tipos de inasistencia' | 'Reglas de regularidad' | 'Reglas de aviso' | 'Reincorporaciones'

type ReglaComparable = { limite: number; periodo: string; cuenta?: string; comparacion?: string }

// Las teclas y los mensajes de los avisos son preferencias de la escuela: no forman parte del régimen.
const claveTipo = (t: TipoInasistencia) => `${t.nombre}|${t.valor}|${t.valor_doble_turno ?? t.valor}`
const claveRegla = (r: ReglaComparable) => `${r.limite}|${r.periodo}|${r.cuenta ?? 'todas'}|${r.comparacion ?? 'alcanza'}`
const mismosElementos = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/** En qué se aparta la configuración actual de los valores del régimen (lista vacía si coincide). */
export function diferenciasConRegimen(regimen: Regimen, actual: ConfigAsistencia): AreaDelRegimen[] {
  const diferencias: AreaDelRegimen[] = []
  if (!mismosElementos(regimen.tipos.map(claveTipo), actual.tipos.map(claveTipo))) diferencias.push('Tipos de inasistencia')
  if (!mismosElementos(regimen.reglas_regularidad.map(claveRegla), actual.reglas_regularidad.map(claveRegla))) {
    diferencias.push('Reglas de regularidad')
  }
  if (!mismosElementos(regimen.avisos.map(claveRegla), actual.avisos.map(claveRegla))) diferencias.push('Reglas de aviso')
  if (regimen.permite_reincorporaciones !== actual.permite_reincorporaciones) diferencias.push('Reincorporaciones')
  return diferencias
}
