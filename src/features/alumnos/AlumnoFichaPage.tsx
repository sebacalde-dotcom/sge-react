import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import { ArrowBack } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { AlumnoFichaPersonalTab } from './tabs/AlumnoFichaPersonalTab'
import { AlumnoResponsablesTab } from './tabs/AlumnoResponsablesTab'
import { AlumnoRetirosTab } from './tabs/AlumnoRetirosTab'

export interface Persona {
  id: string
  apellido: string
  nombre: string
  dni: string | null
  fecha_nac: string | null
  sexo: string | null
  nacionalidad: string | null
  calle: string | null
  numero: string | null
  piso: string | null
  depto: string | null
  localidad: string | null
  barrio: string | null
  cp: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
  foto_url: string | null
  tipo: string
}

export interface AlumnoDatos {
  id: string
  persona_id: string
  ciclo_id: string
  curso_id: string | null
  ingles_id: string | null
  estado: string
}

export function AlumnoFichaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { cicloId } = useCiclo()
  const [tab, setTab] = useState(0)
  const isNew = id === 'nuevo'

  const { data: persona, isLoading: loadingPersona } = useQuery({
    queryKey: ['persona', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personas')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Persona
    },
    enabled: !isNew && !!id,
  })

  const { data: alumnoDatos } = useQuery({
    queryKey: ['alumno-datos', id, cicloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alumno_datos')
        .select('*')
        .eq('persona_id', id!)
        .eq('ciclo_id', cicloId!)
        .maybeSingle()
      if (error) throw error
      return data as AlumnoDatos | null
    },
    enabled: !isNew && !!id && !!cicloId,
  })

  if (!isNew && loadingPersona) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const title = isNew
    ? 'Nuevo alumno'
    : persona
      ? `${persona.apellido}, ${persona.nombre}`
      : 'Legajo'

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <IconButton onClick={() => navigate('/alumnos')}>
          <ArrowBack />
        </IconButton>
        {!isNew && persona && (
          <Avatar
            src={persona.foto_url ?? undefined}
            sx={{ width: 48, height: 48, bgcolor: 'primary.light' }}
          >
            {persona.apellido[0]}{persona.nombre[0]}
          </Avatar>
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">{title}</Typography>
          {!isNew && alumnoDatos && (
            <Chip label={alumnoDatos.estado} size="small" sx={{ mt: 0.5 }} />
          )}
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Ficha Personal" />
        <Tab label="Responsables" disabled={isNew} />
        <Tab label="Retiros" disabled={isNew} />
        <Tab label="Ficha Médica" disabled={isNew} />
        <Tab label="Boletines" disabled={isNew} />
        <Tab label="Autorizaciones" disabled={isNew} />
      </Tabs>

      {tab === 0 && (
        <AlumnoFichaPersonalTab
          persona={isNew ? null : persona ?? null}
          cicloId={cicloId}
        />
      )}
      {tab === 1 && !isNew && persona && <AlumnoResponsablesTab alumnoPersonaId={persona.id} />}
      {tab === 2 && !isNew && persona && <AlumnoRetirosTab alumnoId={persona.id} />}
      {tab === 3 && !isNew && (
        <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.disabled">Ficha médica — próximamente</Typography></Box>
      )}
      {tab === 4 && !isNew && (
        <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.disabled">Boletines — próximamente</Typography></Box>
      )}
      {tab === 5 && !isNew && (
        <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.disabled">Autorizaciones — próximamente</Typography></Box>
      )}
    </Box>
  )
}
