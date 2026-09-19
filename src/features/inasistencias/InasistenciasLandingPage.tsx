import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import {
  ArrowBack,
  EditCalendar,
  NotificationsActive,
  MenuBook,
  Description,
  Replay,
  Settings,
} from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'

const items = [
  {
    title: 'Registrar Inasistencia',
    subtitle: 'Planilla mensual por curso',
    icon: EditCalendar,
    path: '/inasistencias/registrar',
    color: '#ba1a1a',
    bgColor: '#fee2e2',
  },
  {
    title: 'Notificaciones',
    subtitle: 'Cartas a padres y firmas',
    icon: NotificationsActive,
    path: '/inasistencias/notificaciones',
    color: '#0e7490',
    bgColor: '#cffafe',
  },
  {
    title: 'Inasistencia por Materia',
    subtitle: 'Registro por asignatura',
    icon: MenuBook,
    path: '/inasistencias/materia',
    color: '#964400',
    bgColor: '#fef3c7',
  },
  {
    title: 'Boletín de Inasistencia',
    subtitle: 'Reporte individual',
    icon: Description,
    path: '/inasistencias/boletin',
    color: '#225ba9',
    bgColor: '#dbeafe',
  },
  {
    title: 'Reincorporaciones',
    subtitle: 'Gestión de reincorporaciones',
    icon: Replay,
    path: '/inasistencias/reincorporaciones',
    color: '#15803d',
    bgColor: '#dcfce7',
  },
  {
    title: 'Configuración',
    subtitle: 'Tipos, teclas y límite',
    icon: Settings,
    path: '/inasistencias/config',
    color: '#6d28d9',
    bgColor: '#ede9fe',
    adminOnly: true,
  },
]

export function InasistenciasLandingPage() {
  const navigate = useNavigate()
  const { personal } = useAuth()
  const isAdmin = personal?.rol === 'admin' || personal?.rol === 'directivo'

  const visible = items.filter((i) => !i.adminOnly || isAdmin)

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5">Inasistencias</Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 2,
        }}
      >
        {visible.map((item) => (
          <Card
            key={item.path}
            variant="outlined"
            sx={{
              borderRadius: 3.5,
              borderColor: 'rgba(0,0,0,0.12)',
              transition: 'border-color .15s, box-shadow .15s, transform .12s',
              '&:hover': {
                borderColor: 'rgba(0,0,0,0.25)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                transform: 'translateY(-2px)',
              },
              '&:active': { transform: 'translateY(0)' },
            }}
          >
            <CardActionArea
              onClick={() => navigate(item.path)}
              sx={{
                p: 3,
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
                  bgcolor: item.bgColor,
                }}
              >
                <item.icon sx={{ fontSize: 28, color: item.color }} />
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: -0.75 }}>
                {item.subtitle}
              </Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}
