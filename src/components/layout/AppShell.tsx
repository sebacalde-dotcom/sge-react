import { Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import { CicloProvider } from '@/contexts/CicloContext'
import { Topbar } from './Topbar'
import { ConfigFAB } from './ConfigFAB'

export function AppShell() {
  return (
    <CicloProvider>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Topbar />
        <Box component="main" sx={{ flex: 1, overflow: 'auto', p: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Box>
        <ConfigFAB />
      </Box>
    </CicloProvider>
  )
}
