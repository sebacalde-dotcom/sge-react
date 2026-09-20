export type AreaConfig = 'institucion' | 'ciclo' | 'inasistencias' | 'notificaciones'

export const AREAS_CONFIG: { area: AreaConfig; titulo: string; descripcion: string }[] = [
  {
    area: 'institucion',
    titulo: 'Institución',
    descripcion: 'Datos de la escuela, logo, director/a y firma.',
  },
  {
    area: 'ciclo',
    titulo: 'Ciclo lectivo',
    descripcion: 'Fechas del ciclo, turnos, calendario, secciones y cursos.',
  },
  {
    area: 'inasistencias',
    titulo: 'Configuración de inasistencias',
    descripcion: 'Tipos de inasistencia, teclas y límite de No Regular.',
  },
  {
    area: 'notificaciones',
    titulo: 'Reglas y carta de notificaciones',
    descripcion: 'Reglas de aviso por inasistencias y modelo de carta a los padres.',
  },
]

export const ROLES_DELEGABLES = [
  { rol: 'docente', label: 'Docente' },
  { rol: 'preceptor', label: 'Preceptor' },
] as const

export function esAdmin(rol: string | undefined | null): boolean {
  return rol === 'admin' || rol === 'directivo'
}
