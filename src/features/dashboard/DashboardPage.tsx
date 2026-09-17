import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import {
  EventBusy,
  People,
  Grade,
  Gavel,
  Domain,
  CalendarToday,
} from '@mui/icons-material'
import type { SvgIconComponent } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { ROLES } from '@/lib/constants'

interface ModuleCard {
  title: string
  description: string
  icon: SvgIconComponent
  path: string
  color: string
  bgColor: string
}

const modules: ModuleCard[] = [
  {
    title: 'Inasistencias',
    description: 'Planilla diaria, boletín y configuración de tipos',
    icon: EventBusy,
    path: '/inasistencias',
    color: '#ba1a1a',
    bgColor: '#fee2e2',
  },
  {
    title: 'Legajos',
    description: 'Alumnos, docentes, preceptores y directivos',
    icon: People,
    path: '/legajos',
    color: '#225ba9',
    bgColor: '#dbeafe',
  },
  {
    title: 'Calificaciones',
    description: 'Planilla de notas por materia y cuatrimestre',
    icon: Grade,
    path: '/calificaciones',
    color: '#964400',
    bgColor: '#fef3c7',
  },
  {
    title: 'Sanciones',
    description: 'Registro de sanciones disciplinarias',
    icon: Gavel,
    path: '/sanciones',
    color: '#15803d',
    bgColor: '#dcfce7',
  },
]

const configModules: ModuleCard[] = [
  {
    title: 'Institución',
    description: 'Datos generales y logo',
    icon: Domain,
    path: '/config/institucion',
    color: '#6d28d9',
    bgColor: '#ede9fe',
  },
  {
    title: 'Ciclo Lectivo',
    description: 'Año, cuatrimestres y días especiales',
    icon: CalendarToday,
    path: '/config/ciclo',
    color: '#0e7490',
    bgColor: '#cffafe',
  },
]

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function ModuleGrid({ items }: { items: ModuleCard[] }) {
  const navigate = useNavigate()
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 2.5,
      }}
    >
      {items.map((mod) => (
        <Card key={mod.path} sx={{ overflow: 'hidden' }}>
          <CardActionArea
            onClick={() => navigate(mod.path)}
            sx={{ p: 3, display: 'flex', alignItems: 'flex-start', gap: 2.5 }}
          >
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: mod.bgColor,
                flexShrink: 0,
              }}
            >
              <mod.icon sx={{ fontSize: 26, color: mod.color }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontSize: '1.05rem', mb: 0.5 }}>
                {mod.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mod.description}
              </Typography>
            </Box>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  )
}

export function DashboardPage() {
  const { personal } = useAuth()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const rolLabel = personal ? ROLES[personal.rol]?.label ?? personal.rol : ''
  const isAdmin = personal?.rol === 'admin' || personal?.rol === 'directivo'

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 5 }}>
        <Box>
          <Typography variant="h4" color="text.primary">
            {rolLabel}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Sistema de Gestión Escolar
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">
            {formatDate(now)}
          </Typography>
          <Typography variant="h6" color="text.primary" sx={{ fontSize: '1.1rem' }}>
            {formatTime(now)}
          </Typography>
        </Box>
      </Box>

      <ModuleGrid items={modules} />

      {isAdmin && (
        <>
          <Divider sx={{ my: 4 }} />
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Configuración
          </Typography>
          <ModuleGrid items={configModules} />
        </>
      )}
    </Box>
  )
}
