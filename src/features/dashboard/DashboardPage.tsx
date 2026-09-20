import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import {
  EventBusy,
  People,
  Grade,
  Gavel,
  Domain,
  CalendarToday,
  AdminPanelSettings,
} from '@mui/icons-material'
import type { SvgIconComponent } from '@mui/icons-material'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { Assignment } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { usePermisos } from '@/hooks/usePermisos'
import { esAdmin, type AreaConfig } from '@/lib/permisos'
import { useNotificaciones } from '@/features/inasistencias/notificaciones/useNotificaciones'
import { RUTA_NOTIFICACIONES } from '@/features/inasistencias/notificaciones/rutas'

interface ModuleCard {
  title: string
  subtitle: string
  icon: SvgIconComponent
  path: string
  color: string
  bgColor: string
  area?: AreaConfig
  soloAdmin?: boolean
}

const allModules: ModuleCard[] = [
  {
    title: 'Legajos',
    subtitle: 'Legajos y datos',
    icon: People,
    path: '/legajos',
    color: '#225ba9',
    bgColor: '#dbeafe',
  },
  {
    title: 'Calificaciones',
    subtitle: 'Notas y planilla',
    icon: Grade,
    path: '/calificaciones',
    color: '#964400',
    bgColor: '#fef3c7',
  },
  {
    title: 'Inasistencias',
    subtitle: 'Planilla y boletín',
    icon: EventBusy,
    path: '/inasistencias',
    color: '#ba1a1a',
    bgColor: '#fee2e2',
  },
  {
    title: 'Sanciones',
    subtitle: 'Carga y boletín',
    icon: Gavel,
    path: '/sanciones',
    color: '#15803d',
    bgColor: '#dcfce7',
  },
  {
    title: 'Institución',
    subtitle: 'Datos y logo',
    icon: Domain,
    path: '/config/institucion',
    color: '#6d28d9',
    bgColor: '#ede9fe',
    area: 'institucion',
  },
  {
    title: 'Ciclo Lectivo',
    subtitle: 'Año y calendario',
    icon: CalendarToday,
    path: '/config/ciclo',
    color: '#0e7490',
    bgColor: '#cffafe',
    area: 'ciclo',
  },
  {
    title: 'Permisos',
    subtitle: 'Quién configura qué',
    icon: AdminPanelSettings,
    path: '/config/permisos',
    color: '#b45309',
    bgColor: '#fef3c7',
    soloAdmin: true,
  },
]

function NotificacionesPendientes() {
  const navigate = useNavigate()
  const { conteos, pendientes, isLoading } = useNotificaciones()
  if (isLoading || pendientes === 0) return null

  const partes = [
    { cantidad: conteos.por_imprimir, texto: 'por imprimir', color: 'error' as const },
    { cantidad: conteos.impresa, texto: 'para entregar', color: 'warning' as const },
    { cantidad: conteos.entregada, texto: 'esperando firma', color: 'info' as const },
  ].filter((p) => p.cantidad > 0)

  return (
    <Card
      variant="outlined"
      sx={{ width: '100%', maxWidth: 620, mb: 4, borderRadius: 3.5, borderColor: 'rgba(0,0,0,0.15)', p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
    >
      <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Assignment sx={{ color: '#ba1a1a' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
          Notificaciones pendientes ({pendientes})
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
          {partes.map((p) => (
            <Chip key={p.texto} size="small" color={p.color} variant="outlined" label={`${p.cantidad} ${p.texto}`} />
          ))}
        </Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
          Notificaciones de inasistencias a los padres
        </Typography>
      </Box>
      <Button variant="contained" onClick={() => navigate(RUTA_NOTIFICACIONES)}>Ver notificaciones</Button>
    </Card>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { personal } = useAuth()
  const { puedeEditar } = usePermisos()
  const nombre = personal?.nombre?.toUpperCase() ?? ''
  const visibleModules = allModules.filter((m) => (m.soloAdmin ? esAdmin(personal?.rol) : !m.area || puedeEditar(m.area)))

  return (
    <Box
      sx={{
        maxWidth: 900,
        mx: 'auto',
        py: 6,
        px: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
        Bienvenido, {nombre}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Seleccioná un módulo para comenzar
      </Typography>

      <NotificacionesPendientes />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 140px)',
            sm: `repeat(${Math.min(visibleModules.length, 4)}, 140px)`,
          },
          gap: 2,
          justifyContent: 'center',
        }}
      >
        {visibleModules.map((mod) => (
          <Card
            key={mod.path}
            variant="outlined"
            sx={{
              borderRadius: 3.5,
              borderColor: 'rgba(0,0,0,0.15)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              transition: 'border-color .15s, box-shadow .15s, transform .12s',
              '&:hover': {
                borderColor: 'rgba(0,0,0,0.25)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                transform: 'translateY(-2px)',
              },
              '&:active': { transform: 'translateY(0)' },
            }}
          >
            <CardActionArea
              onClick={() => navigate(mod.path)}
              sx={{
                p: '24px 16px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 3.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: mod.bgColor,
                }}
              >
                <mod.icon sx={{ fontSize: 28, color: mod.color }} />
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                {mod.title}
              </Typography>
              <Typography
                sx={{ fontSize: 11, color: 'text.secondary', mt: -0.75, lineHeight: 1.3 }}
              >
                {mod.subtitle}
              </Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
