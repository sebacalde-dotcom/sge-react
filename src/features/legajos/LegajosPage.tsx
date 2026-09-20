import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Menu from '@mui/material/Menu'
import { ArrowBack, Add, Search, CloudUpload } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { useAuth } from '@/contexts/AuthContext'
import { AlumnoImportDialog } from '@/features/alumnos/AlumnoImportDialog'

interface PersonaRow {
  id: string
  apellido: string
  nombre: string
  dni: string | null
  email: string | null
  telefono: string | null
  foto_url: string | null
  tipo: string
}

const TIPO_LABELS: Record<string, string> = {
  alumno: 'Alumno',
  docente: 'Docente',
  preceptor: 'Preceptor',
  directivo: 'Directivo',
  padre: 'Padre/Madre',
  otro: 'Otro',
}

const TIPO_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'default'> = {
  alumno: 'primary',
  docente: 'info',
  preceptor: 'success',
  directivo: 'secondary',
  padre: 'warning',
  otro: 'default',
}

interface PaseInfo {
  fecha: string
  colegio_destino: string | null
}

const formatFecha = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function LegajosPage() {
  const navigate = useNavigate()
  const { cicloId } = useCiclo()
  const { personal } = useAuth()
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null)
  const isAdmin = personal?.rol === 'admin' || personal?.rol === 'directivo'

  const { data: pases = {} } = useQuery({
    queryKey: ['legajos-pases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pases')
        .select('persona_id, fecha, colegio_destino')
        .is('anulado_at', null)
      if (error) return {} as Record<string, PaseInfo>
      const porPersona: Record<string, PaseInfo> = {}
      for (const p of data as { persona_id: string; fecha: string; colegio_destino: string | null }[]) {
        porPersona[p.persona_id] = { fecha: p.fecha, colegio_destino: p.colegio_destino }
      }
      return porPersona
    },
  })

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ['personas', tipoFilter === 'ex_alumno' ? 'alumno' : tipoFilter],
    queryFn: async () => {
      let query = supabase
        .from('personas')
        .select('id, apellido, nombre, dni, email, telefono, foto_url, tipo')
        .eq('eliminado', false)
        .order('apellido')
      if (tipoFilter) {
        query = query.eq('tipo', tipoFilter === 'ex_alumno' ? 'alumno' : tipoFilter)
      }
      const { data, error } = await query
      if (error) throw error
      return data as PersonaRow[]
    },
  })

  const filtered = personas.filter((p) => {
    if (tipoFilter === 'ex_alumno' && !pases[p.id]) return false
    if (tipoFilter === 'alumno' && pases[p.id]) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      `${p.apellido} ${p.nombre}`.toLowerCase().includes(s) ||
      (p.dni && p.dni.includes(s)) ||
      (p.email && p.email.toLowerCase().includes(s))
    )
  })

  const counts = personas.reduce<Record<string, number>>((acc, p) => {
    const clave = p.tipo === 'alumno' && pases[p.id] ? 'ex_alumno' : p.tipo
    acc[clave] = (acc[clave] ?? 0) + 1
    return acc
  }, {})

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Legajos</Typography>
          <Typography variant="body2" color="text.secondary">
            {personas.length} personas registradas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAdmin && (
            <Button variant="outlined" startIcon={<CloudUpload />} onClick={() => setImportOpen(true)}>
              Carga masiva
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={(e) => setAddMenuAnchor(e.currentTarget)}>
            Nuevo
          </Button>
          <Menu
            anchorEl={addMenuAnchor}
            open={!!addMenuAnchor}
            onClose={() => setAddMenuAnchor(null)}
          >
            <MenuItem onClick={() => { setAddMenuAnchor(null); navigate('/legajos/nuevo?tipo=alumno') }}>
              Alumno
            </MenuItem>
            <MenuItem onClick={() => { setAddMenuAnchor(null); navigate('/legajos/nuevo?tipo=docente') }}>
              Docente
            </MenuItem>
            <MenuItem onClick={() => { setAddMenuAnchor(null); navigate('/legajos/nuevo?tipo=preceptor') }}>
              Preceptor
            </MenuItem>
            <MenuItem onClick={() => { setAddMenuAnchor(null); navigate('/legajos/nuevo?tipo=directivo') }}>
              Directivo
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Buscar por nombre, DNI o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
            },
          }}
        />
        <TextField
          select
          label="Tipo"
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="alumno">Alumnos {counts.alumno ? `(${counts.alumno})` : ''}</MenuItem>
          <MenuItem value="docente">Docentes {counts.docente ? `(${counts.docente})` : ''}</MenuItem>
          <MenuItem value="preceptor">Preceptores {counts.preceptor ? `(${counts.preceptor})` : ''}</MenuItem>
          <MenuItem value="directivo">Directivos {counts.directivo ? `(${counts.directivo})` : ''}</MenuItem>
          <MenuItem value="padre">Padres {counts.padre ? `(${counts.padre})` : ''}</MenuItem>
          {isAdmin && (
            <MenuItem value="ex_alumno">Ex alumnos {Object.keys(pases).length ? `(${Object.keys(pases).length})` : ''}</MenuItem>
          )}
        </TextField>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">
            {personas.length === 0 ? 'No hay legajos cargados' : 'No se encontraron resultados'}
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map((p) => (
            <Card
              key={p.id}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'background-color 0.15s',
              }}
              onClick={() => navigate(`/legajos/${p.id}`)}
            >
              <Avatar
                src={p.foto_url ?? undefined}
                sx={{ width: 42, height: 42, bgcolor: 'primary.light', fontSize: '0.85rem' }}
              >
                {p.apellido[0]}{p.nombre[0]}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
                  {p.apellido}, {p.nombre}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[p.dni && `DNI: ${p.dni}`, p.email].filter(Boolean).join(' — ')}
                  {pases[p.id] && (
                    <Typography component="span" variant="body2" color="warning.main" sx={{ ml: 1 }}>
                      Pase el {formatFecha(pases[p.id].fecha)}
                      {pases[p.id].colegio_destino ? ` a ${pases[p.id].colegio_destino}` : ''}
                    </Typography>
                  )}
                </Typography>
              </Box>
              <Chip
                label={pases[p.id] ? 'Ex alumno' : (TIPO_LABELS[p.tipo] ?? p.tipo)}
                size="small"
                color={pases[p.id] ? 'warning' : (TIPO_COLORS[p.tipo] ?? 'default')}
                variant="outlined"
              />
            </Card>
          ))}
        </Box>
      )}

      {isAdmin && cicloId && (
        <AlumnoImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          cicloId={cicloId}
        />
      )}
    </Box>
  )
}
