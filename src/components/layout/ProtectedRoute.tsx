import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { isLoading, isAuthorized, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--surface-page)' }}>
        <div className="text-center" style={{ color: 'var(--text-tertiary)' }}>
          <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full mx-auto mb-3" />
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAuthorized) return <Navigate to="/login" replace />

  return <Outlet />
}
