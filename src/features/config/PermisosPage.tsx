import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { ArrowBack } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { usePermisos } from '@/hooks/usePermisos'
import { AREAS_CONFIG, ROLES_DELEGABLES, type AreaConfig } from '@/lib/permisos'

export function PermisosPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { permisos, cargando, tablaDisponible } = usePermisos()

  const toggleMutation = useMutation({
    mutationFn: async ({ area, rol, puede_editar }: { area: AreaConfig; rol: string; puede_editar: boolean }) => {
      const { data, error } = await supabase
        .from('permisos_configuracion')
        .upsert({ area, rol, puede_editar, updated_at: new Date().toISOString() }, { onConflict: 'area,rol' })
        .select('area')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo guardar el permiso (sin permisos en la base)')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['permisos'] }),
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const habilitado = (area: AreaConfig, rol: string) =>
    permisos.some((p) => p.area === area && p.rol === rol && p.puede_editar)

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}><ArrowBack /></IconButton>
        <Box>
          <Typography variant="h5">Permisos de configuración</Typography>
          <Typography variant="body2" color="text.secondary">
            Qué roles pueden modificar cada configuración
          </Typography>
        </Box>
      </Box>

      {!tablaDisponible && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta crear la tabla de permisos en Supabase (migración 006). Hasta entonces solo administradores y directivos
          pueden modificar configuraciones.
        </Alert>
      )}

      <Alert severity="info" sx={{ mb: 3 }}>
        Los administradores y el equipo directivo siempre pueden modificar todo. Acá elegís qué configuraciones puede
        modificar además cada rol. El permiso también lo hace cumplir la base de datos, no solo la pantalla.
      </Alert>

      {cargando ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Configuración</TableCell>
                <TableCell align="center">Administrador</TableCell>
                <TableCell align="center">Eq. Directivo</TableCell>
                {ROLES_DELEGABLES.map((r) => (
                  <TableCell key={r.rol} align="center">{r.label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {AREAS_CONFIG.map((a) => (
                <TableRow key={a.area} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{a.titulo}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.descripcion}</Typography>
                  </TableCell>
                  <TableCell align="center"><Chip size="small" label="Siempre" color="success" variant="outlined" /></TableCell>
                  <TableCell align="center"><Chip size="small" label="Siempre" color="success" variant="outlined" /></TableCell>
                  {ROLES_DELEGABLES.map((r) => (
                    <TableCell key={r.rol} align="center">
                      <Switch
                        checked={habilitado(a.area, r.rol)}
                        disabled={!tablaDisponible || toggleMutation.isPending}
                        onChange={(e) => toggleMutation.mutate({ area: a.area, rol: r.rol, puede_editar: e.target.checked })}
                        slotProps={{ input: { 'aria-label': `${a.titulo}: ${r.label}` } }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Esta pantalla y el alta o cambio de roles del personal son siempre solo de administradores y directivos: no se pueden delegar.
      </Typography>
    </Box>
  )
}
