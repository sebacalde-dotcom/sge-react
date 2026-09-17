import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
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
import { AlumnoFichaPersonalTab } from '@/features/alumnos/tabs/AlumnoFichaPersonalTab'
import { AlumnoResponsablesTab } from '@/features/alumnos/tabs/AlumnoResponsablesTab'
import { AlumnoRetirosTab } from '@/features/alumnos/tabs/AlumnoRetirosTab'
import { PersonalFichaTab } from './tabs/PersonalFichaTab'

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

const TIPO_LABELS: Record<string, string> = {
  alumno: 'Alumno',
  docente: 'Docente',
  preceptor: 'Preceptor',
  directivo: 'Directivo',
  padre: 'Padre/Madre',
  otro: 'Otro',
}

function AlumnoTabs({ persona, tab }: { persona: Persona; tab: number }) {
  const { cicloId } = useCiclo()

  const { data: alumnoDatos } = useQuery({
    queryKey: ['alumno-datos', persona.id, cicloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alumno_datos')
        .select('*')
        .eq('persona_id', persona.id)
        .eq('ciclo_id', cicloId!)
        .maybeSingle()
      if (error) throw error
      return data as AlumnoDatos | null
    },
    enabled: !!cicloId,
  })

  if (tab === 0) return <AlumnoFichaPersonalTab persona={persona} alumnoDatos={alumnoDatos ?? null} cicloId={cicloId} />
  if (tab === 1) return <AlumnoResponsablesTab alumnoPersonaId={persona.id} />
  if (tab === 2) return <AlumnoRetirosTab alumnoId={persona.id} />
  if (tab === 3) return <Placeholder text="Ficha médica — próximamente" />
  if (tab === 4) return <Placeholder text="Boletines — próximamente" />
  if (tab === 5) return <Placeholder text="Autorizaciones — próximamente" />
  return null
}

function Placeholder({ text }: { text: string }) {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography color="text.disabled">{text}</Typography>
    </Box>
  )
}

export function LegajoPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { cicloId } = useCiclo()
  const [tab, setTab] = useState(0)
  const isNew = id === 'nuevo'
  const nuevoTipo = searchParams.get('tipo') ?? 'alumno'

  const { data: persona, isLoading } = useQuery({
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

  if (!isNew && isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const tipo = persona?.tipo ?? nuevoTipo
  const isAlumno = tipo === 'alumno'
  const isPadre = tipo === 'padre'
  const isStaff = ['docente', 'preceptor', 'directivo', 'admin'].includes(tipo)

  const title = isNew
    ? `Nuevo ${TIPO_LABELS[nuevoTipo] ?? nuevoTipo}`
    : persona
      ? `${persona.apellido}, ${persona.nombre}`
      : 'Legajo'

  const alumnoTabLabels = ['Ficha Personal', 'Responsables', 'Retiros', 'Ficha Médica', 'Boletines', 'Autorizaciones']
  const staffTabLabels = ['Ficha Personal']
  const padreTabLabels = ['Ficha Personal']

  const tabLabels = isAlumno ? alumnoTabLabels : isPadre ? padreTabLabels : staffTabLabels

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <IconButton onClick={() => navigate('/legajos')}>
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
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Chip label={TIPO_LABELS[tipo] ?? tipo} size="small" variant="outlined" />
          </Box>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {tabLabels.map((label, i) => (
          <Tab key={label} label={label} disabled={isNew && i > 0} />
        ))}
      </Tabs>

      {isAlumno && !isNew && persona && <AlumnoTabs persona={persona} tab={tab} />}
      {isAlumno && isNew && tab === 0 && (
        <AlumnoFichaPersonalTab persona={null} alumnoDatos={null} cicloId={cicloId} />
      )}
      {isStaff && (
        tab === 0 ? <PersonalFichaTab persona={isNew ? null : persona ?? null} tipo={nuevoTipo} /> : null
      )}
      {isPadre && (
        tab === 0 ? <PersonalFichaTab persona={isNew ? null : persona ?? null} tipo="padre" /> : null
      )}
    </Box>
  )
}
