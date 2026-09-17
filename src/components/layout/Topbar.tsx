import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { Logout } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'

interface InstitucionData {
  nombre?: string
  logoUrl?: string | null
}

export function Topbar() {
  const { personal, signOut } = useAuth()
  const { data: institucion } = useConfig<InstitucionData>('institucional')
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const initials = personal
    ? `${personal.nombre[0]}${personal.apellido[0]}`.toUpperCase()
    : '?'

  const instName = institucion?.nombre || 'SGE'
  const logoUrl = institucion?.logoUrl

  return (
    <AppBar position="sticky" color="inherit" sx={{ bgcolor: 'background.paper' }}>
      <Toolbar>
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          {logoUrl ? (
            <Box
              component="img"
              src={logoUrl}
              alt=""
              sx={{ width: 32, height: 32, borderRadius: 1, objectFit: 'contain' }}
            />
          ) : null}
          <Typography
            variant="h6"
            sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '-0.02em' }}
          >
            {instName}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {personal && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {personal.nombre} {personal.apellido}
            </Typography>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
              <Avatar
                src={personal.foto_url ?? undefined}
                sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.85rem' }}
              >
                {initials}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
              slotProps={{ paper: { sx: { borderRadius: 2, mt: 1 } } }}
            >
              <MenuItem onClick={() => { setAnchorEl(null); signOut() }}>
                <Logout fontSize="small" sx={{ mr: 1.5 }} />
                Cerrar sesión
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  )
}
