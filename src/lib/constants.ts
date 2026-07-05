export const ROLES = {
  admin:     { label: 'Administrador',  bg: '#FCEBEB', color: '#791F1F' },
  directivo: { label: 'Eq. Directivo',  bg: '#EEEDFE', color: '#3C3489' },
  docente:   { label: 'Docente',         bg: '#EAF3DE', color: '#27500A' },
  preceptor: { label: 'Preceptor',       bg: '#E6F1FB', color: '#0C447C' },
} as const

export type UserRole = keyof typeof ROLES

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

export const DIAS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
] as const

export const AVATAR_COLORS = [
  { bg: '#B5D4F4', text: '#0C447C' },
  { bg: '#9FE1CB', text: '#085041' },
  { bg: '#FAC775', text: '#633806' },
  { bg: '#F4C0D1', text: '#72243E' },
  { bg: '#C4B5FD', text: '#3C3489' },
  { bg: '#FCA5A5', text: '#791F1F' },
] as const
