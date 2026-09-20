import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { esAdmin } from '@/lib/permisos'

export function AdminRoute() {
  const { personal } = useAuth()
  if (!esAdmin(personal?.rol)) return <Navigate to="/" replace />
  return <Outlet />
}
