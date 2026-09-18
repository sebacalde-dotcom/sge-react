import { useState } from 'react'
import Fab from '@mui/material/Fab'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import {
  Settings,
  LightMode,
  DarkMode,
  SettingsBrightness,
} from '@mui/icons-material'

type ThemeMode = 'light' | 'dark' | 'system'

export function ConfigFAB() {
  const [open, setOpen] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>('system')

  function handleThemeChange(_: unknown, value: ThemeMode | null) {
    if (!value) return
    setThemeMode(value)
  }

  return (
    <>
      <Fab
        size="medium"
        onClick={() => setOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1200,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <Settings />
      </Fab>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: { sx: { width: 300, borderRadius: '16px 0 0 16px', p: 3 } },
        }}
      >
        <Typography variant="h6" sx={{ mb: 3 }}>
          Ajustes
        </Typography>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
          Tema
        </Typography>
        <ToggleButtonGroup
          value={themeMode}
          exclusive
          onChange={handleThemeChange}
          fullWidth
          size="small"
          sx={{ mb: 4 }}
        >
          <ToggleButton value="light" sx={{ gap: 0.5, textTransform: 'none' }}>
            <LightMode fontSize="small" /> Claro
          </ToggleButton>
          <ToggleButton value="dark" sx={{ gap: 0.5, textTransform: 'none' }}>
            <DarkMode fontSize="small" /> Oscuro
          </ToggleButton>
          <ToggleButton value="system" sx={{ gap: 0.5, textTransform: 'none' }}>
            <SettingsBrightness fontSize="small" /> Sistema
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ mt: 'auto' }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Sistema de Gestión Escolar
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
            Versión 1.0
          </Typography>
        </Box>
      </Drawer>
    </>
  )
}
