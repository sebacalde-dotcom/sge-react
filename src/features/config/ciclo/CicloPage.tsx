import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { ArrowBack } from '@mui/icons-material'
import { useCiclo } from '@/contexts/CicloContext'
import { CicloGeneralTab } from './CicloGeneralTab'
import { CicloCalendarioTab } from './CicloCalendarioTab'
import { SeccionesTab } from './SeccionesTab'
import { CursosTab } from './CursosTab'
import { MateriasTab } from './MateriasTab'
import { HorarioTab } from './HorarioTab'

export function CicloPage() {
  const navigate = useNavigate()
  const { ciclo } = useCiclo()
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h5">Ciclo Lectivo</Typography>
          <Typography variant="body2" color="text.secondary">
            {ciclo ? `Año ${ciclo.anio}` : 'Sin ciclo activo'}
          </Typography>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="General" />
        <Tab label="Calendario" />
        <Tab label="Secciones" />
        <Tab label="Cursos" />
        <Tab label="Materias" />
        <Tab label="Horario" />
      </Tabs>

      {tab === 0 && <CicloGeneralTab />}
      {tab === 1 && <CicloCalendarioTab />}
      {tab === 2 && <SeccionesTab />}
      {tab === 3 && <CursosTab />}
      {tab === 4 && <MateriasTab />}
      {tab === 5 && <HorarioTab />}
    </Box>
  )
}
