import { Navigate, Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { usePermisos } from '@/hooks/usePermisos'
import type { AreaConfig } from '@/lib/permisos'

export function AreaRoute({ area }: { area: AreaConfig }) {
  const { puedeEditar, decidiendo } = usePermisos()

  if (decidiendo) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }
  if (!puedeEditar(area)) return <Navigate to="/" replace />
  return <Outlet />
}
