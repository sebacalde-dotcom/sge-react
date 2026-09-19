import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { puedeConfigurar } from '@/lib/permisos'

export function AdminRoute() {
  const { personal } = useAuth()
  if (!puedeConfigurar(personal?.rol)) return <Navigate to="/" replace />
  return <Outlet />
}
