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
import { ArrowBack, Add, Search, CloudUpload } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { useAuth } from '@/contexts/AuthContext'
import { AlumnoImportDialog } from './AlumnoImportDialog'

interface AlumnoRow {
  id: string
  persona_id: string
  estado: string
  curso_id: string | null
  cursos: { id: string; nombre: string; division: string | null } | null
  personas: {
    id: string
    apellido: string
    nombre: string
    dni: string | null
    foto_url: string | null
  }
}

interface Curso {
  id: string
  nombre: string
  division: string | null
}

export function AlumnosPage() {
  const navigate = useNavigate()
  const { cicloId } = useCiclo()
  const { personal } = useAuth()
  const [search, setSearch] = useState('')
  const [cursoFilter, setCursoFilter] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const isAdmin = personal?.rol === 'admin' || personal?.rol === 'directivo'

  const { data: cursos = [] } = useQuery({
    queryKey: ['cursos', cicloId],
    queryFn: async () => {
      if (!cicloId) return []
      const { data, error } = await supabase
        .from('cursos')
        .select('id, nombre, division')
        .eq('ciclo_id', cicloId)
        .order('nombre')
      if (error) throw error
      return data as Curso[]
    },
    enabled: !!cicloId,
  })

  const { data: alumnos = [], isLoading } = useQuery({
    queryKey: ['alumnos', cicloId],
    queryFn: async () => {
      if (!cicloId) return []
      const { data, error } = await supabase
        .from('alumno_datos')
        .select('id, persona_id, estado, curso_id, cursos(id, nombre, division), personas(id, apellido, nombre, dni, foto_url)')
        .eq('ciclo_id', cicloId)
        .order('created_at')
      if (error) throw error
      return (data as unknown as AlumnoRow[]).filter((a) => a.personas)
    },
    enabled: !!cicloId,
  })

  const filtered = alumnos.filter((a) => {
    const p = a.personas
    const matchSearch = !search ||
      `${p.apellido} ${p.nombre}`.toLowerCase().includes(search.toLowerCase()) ||
      (p.dni && p.dni.includes(search))
    const matchCurso = !cursoFilter || a.curso_id === cursoFilter
    return matchSearch && matchCurso
  })

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Alumnos</Typography>
          <Typography variant="body2" color="text.secondary">
            {alumnos.length} alumnos en el ciclo
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAdmin && (
            <Button variant="outlined" startIcon={<CloudUpload />} onClick={() => setImportOpen(true)}>
              Carga masiva
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/alumnos/nuevo')}>
            Nuevo alumno
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          placeholder="Buscar por nombre o DNI…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start"><Search /></InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Curso"
          value={cursoFilter}
          onChange={(e) => setCursoFilter(e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {cursos.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.nombre}{c.division ? ` ${c.division}` : ''}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">
            {alumnos.length === 0 ? 'No hay alumnos cargados' : 'No se encontraron resultados'}
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map((a) => {
            const p = a.personas
            return (
              <Card
                key={a.id}
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  transition: 'background-color 0.15s',
                }}
                onClick={() => navigate(`/alumnos/${p.id}`)}
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
                  {p.dni && (
                    <Typography variant="body2" color="text.secondary">
                      DNI: {p.dni}
                    </Typography>
                  )}
                </Box>
                {a.cursos && (
                  <Chip
                    label={`${a.cursos.nombre}${a.cursos.division ? ` ${a.cursos.division}` : ''}`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {a.estado !== 'activo' && (
                  <Chip label={a.estado} size="small" color="warning" />
                )}
              </Card>
            )
          })}
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
