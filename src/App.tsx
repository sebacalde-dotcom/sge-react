import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { Construction } from '@mui/icons-material'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { InstitucionPage } from '@/features/config/InstitucionPage'
import { CicloPage } from '@/features/config/ciclo/CicloPage'
import { LegajosPage } from '@/features/legajos/LegajosPage'
import { LegajoPage } from '@/features/legajos/LegajoPage'
import { InasistenciasLandingPage } from '@/features/inasistencias/InasistenciasLandingPage'
import { RegistrarInasistenciaPage } from '@/features/inasistencias/RegistrarInasistenciaPage'
import { InasistenciasConfigPage } from '@/features/inasistencias/InasistenciasConfigPage'
import { ReincorporacionesPage } from '@/features/inasistencias/ReincorporacionesPage'
import { NotificacionesPage } from '@/features/inasistencias/notificaciones/NotificacionesPage'
import { ImprimirNotificacionesPage } from '@/features/inasistencias/notificaciones/ImprimirNotificacionesPage'
import { RUTA_IMPRIMIR_NOTIFICACIONES } from '@/features/inasistencias/notificaciones/rutas'
import { AdminRoute } from '@/components/layout/AdminRoute'
import { AreaRoute } from '@/components/layout/AreaRoute'
import { PermisosPage } from '@/features/config/PermisosPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

function Placeholder({ title }: { title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <Box sx={{ textAlign: 'center', color: 'text.disabled' }}>
        <Construction sx={{ fontSize: 48, opacity: 0.4, mb: 1 }} />
        <Typography variant="body2">{title} — próximamente</Typography>
      </Box>
    </Box>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path={RUTA_IMPRIMIR_NOTIFICACIONES.slice(1)} element={<ImprimirNotificacionesPage />} />
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="legajos" element={<LegajosPage />} />
                <Route path="legajos/:id" element={<LegajoPage />} />
                <Route path="calificaciones" element={<Placeholder title="Calificaciones" />} />
                <Route path="inasistencias" element={<InasistenciasLandingPage />} />
                <Route path="inasistencias/registrar" element={<RegistrarInasistenciaPage />} />
                <Route path="inasistencias/materia" element={<Placeholder title="Registro de Inasistencias por materia" />} />
                <Route path="inasistencias/boletin" element={<Placeholder title="Boletín de Inasistencias" />} />
                <Route path="inasistencias/reincorporaciones" element={<ReincorporacionesPage />} />
                <Route path="inasistencias/notificaciones" element={<NotificacionesPage />} />
                <Route path="sanciones" element={<Placeholder title="Sanciones" />} />
                <Route element={<AreaRoute area="inasistencias" />}>
                  <Route path="inasistencias/config" element={<InasistenciasConfigPage />} />
                </Route>
                <Route element={<AreaRoute area="institucion" />}>
                  <Route path="config/institucion" element={<InstitucionPage />} />
                </Route>
                <Route element={<AreaRoute area="ciclo" />}>
                  <Route path="config/ciclo" element={<CicloPage />} />
                </Route>
                <Route element={<AdminRoute />}>
                  <Route path="config/permisos" element={<PermisosPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
