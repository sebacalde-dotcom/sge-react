import { createTheme } from '@mui/material/styles'

export const theme = createTheme({
  palette: {
    primary: {
      main: '#225ba9',
      light: '#4174c4',
      dark: '#1a4a8a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#455368',
      light: '#6b7b94',
      dark: '#2d3a4e',
      contrastText: '#ffffff',
    },
    error: {
      main: '#ba1a1a',
      light: '#fee2e2',
      dark: '#93000a',
    },
    warning: {
      main: '#964400',
      light: '#fef3c7',
      dark: '#633806',
    },
    success: {
      main: '#15803d',
      light: '#dcfce7',
      dark: '#166534',
    },
    background: {
      default: '#f9f9ff',
      paper: '#ffffff',
    },
    text: {
      primary: '#181c22',
      secondary: '#414753',
      disabled: '#a0a7b4',
    },
    divider: 'rgba(113, 119, 133, 0.12)',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 700 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600, fontSize: '0.8rem' },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '8px 20px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid rgba(113, 119, 133, 0.12)',
        },
      },
    },
  },
})
