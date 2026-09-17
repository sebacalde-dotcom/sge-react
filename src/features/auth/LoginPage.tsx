import { Navigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { Google } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'

export function LoginPage() {
  const { isAuthorized, isLoading, signIn } = useAuth()

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (isAuthorized) return <Navigate to="/" replace />

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', bgcolor: 'background.default' }}>
      <Card sx={{ textAlign: 'center', p: 5, maxWidth: 400, width: '100%' }}>
        <Typography variant="h4" color="primary" sx={{ mb: 0.5 }}>
          SGE
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Sistema de Gestión Escolar
        </Typography>

        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<Google />}
          onClick={signIn}
          sx={{ borderRadius: 3, py: 1.5 }}
        >
          Iniciar sesión con Google
        </Button>

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 3 }}>
          Solo usuarios autorizados del personal
        </Typography>
      </Card>
    </Box>
  )
}
