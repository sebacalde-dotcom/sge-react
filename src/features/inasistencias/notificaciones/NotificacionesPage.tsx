import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { ArrowBack } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { puedeConfigurar } from '@/lib/permisos'
import { SeguimientoTab } from './SeguimientoTab'
import { ReglasTab } from './ReglasTab'

export function NotificacionesPage() {
  const navigate = useNavigate()
  const { personal } = useAuth()
  const configura = puedeConfigurar(personal?.rol)
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton onClick={() => navigate('/inasistencias')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h5">Notificaciones de inasistencias</Typography>
          <Typography variant="body2" color="text.secondary">
            Cartas a los padres: impresión, entrega y seguimiento de firmas
          </Typography>
        </Box>
      </Box>

      {configura && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Seguimiento" />
          <Tab label="Reglas y carta" />
        </Tabs>
      )}
      {!configura && <Box sx={{ mb: 3 }} />}

      {tab === 0 || !configura ? (
        <SeguimientoTab puedeConfigurar={configura} alIrAReglas={() => setTab(1)} />
      ) : (
        <ReglasTab />
      )}
    </Box>
  )
}
