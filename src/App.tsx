import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'

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
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-tertiary)' }}>
      <div className="text-center">
        <span className="material-symbols-outlined text-5xl block mb-2 opacity-40">construction</span>
        <p className="text-sm">{title} — próximamente</p>
      </div>
    </div>
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
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/config/institucion" replace />} />
                <Route path="alumnos" element={<Placeholder title="Alumnos" />} />
                <Route path="alumnos/:id" element={<Placeholder title="Ficha Alumno" />} />
                <Route path="personal" element={<Placeholder title="Personal" />} />
                <Route path="personal/:id" element={<Placeholder title="Ficha Personal" />} />
                <Route path="ciclo" element={<Placeholder title="Ciclo Lectivo" />} />
                <Route path="materias" element={<Placeholder title="Materias" />} />
                <Route path="inasistencias" element={<Placeholder title="Inasistencias" />} />
                <Route path="inasistencias/boletin" element={<Placeholder title="Boletín Inasistencias" />} />
                <Route path="sanciones" element={<Placeholder title="Sanciones" />} />
                <Route path="sanciones/boletin" element={<Placeholder title="Boletín Sanciones" />} />
                <Route path="config/institucion" element={<Placeholder title="Institución" />} />
                <Route path="config/inasistencias" element={<Placeholder title="Cfg. Inasistencias" />} />
                <Route path="config/sanciones" element={<Placeholder title="Cfg. Sanciones" />} />
                <Route path="config/notas" element={<Placeholder title="Cfg. Calificaciones" />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  )
}
