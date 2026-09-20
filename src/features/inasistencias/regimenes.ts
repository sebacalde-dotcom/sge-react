import type { TipoInasistencia } from './conteo'
import type { NotificacionInasistencia } from './notificaciones/periodos'
import type { ReglaRegularidad } from './regularidad'

export type IdRegimen = 'caba' | 'pba'

/**
 * Configuración de inasistencias precargada según la normativa de cada jurisdicción. Se aplica desde Configuración de
 * Inasistencias y después se puede ajustar: las normas cambian y cada escuela tiene sus particularidades.
 * Los valores salen de la normativa compartida por el usuario y hay que verificarlos con la resolución vigente.
 */
export interface PlantillaRegimen {
  id: IdRegimen
  nombre: string
  descripcion: string
  /** Lo que la plantilla todavía no puede expresar, para decirlo antes de aplicarla. */
  limitaciones: string[]
  tipos: TipoInasistencia[]
  reglas_regularidad: ReglaRegularidad[]
  permite_reincorporaciones: boolean
  avisos: NotificacionInasistencia[]
}

export const REGIMENES: PlantillaRegimen[] = [
  {
    id: 'caba',
    nombre: 'Ciudad de Buenos Aires (CABA)',
    descripcion:
      'Hasta 20 inasistencias injustificadas en el año y un tope de 5 por bimestre. Al superarlos se pierde la ' +
      'regularidad y no hay reincorporaciones por criterio institucional. Las llegadas tarde y los retiros anticipados ' +
      'valen 1/4 de falta y, en doble turno, cada turno que se falta vale 1/2.',
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
    limitaciones: [
      'Al superar las 28, el alumno pasa a asistencia por materia (75% para acreditar cada una). Eso necesita registrar la asistencia por materia, que todavía no existe: por ahora solo se avisa.',
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
        mensaje: 'Interviene el equipo directivo y de orientación. Pasa a asistencia por materia (75%).',
      },
    ],
  },
]

export const regimenPorId = (id: string | undefined) => REGIMENES.find((r) => r.id === id)
