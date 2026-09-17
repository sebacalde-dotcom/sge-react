import { Navigate, Outlet } from 'react-router-dom'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { isLoading, isAuthorized, user } = useAuth()

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!user || !isAuthorized) return <Navigate to="/login" replace />

  return <Outlet />
}
