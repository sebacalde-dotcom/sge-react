import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import CircularProgress from '@mui/material/CircularProgress'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { AlumnoFichaPersonalTab } from '@/features/alumnos/tabs/AlumnoFichaPersonalTab'
import { AlumnoFichaAcademicaTab } from '@/features/alumnos/tabs/AlumnoFichaAcademicaTab'
import { AlumnoRetirosTab } from '@/features/alumnos/tabs/AlumnoRetirosTab'
import { PersonalFichaTab } from './tabs/PersonalFichaTab'
import { LegajoEncabezado } from './LegajoEncabezado'

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
  fecha_ingreso?: string | null
  colegio_procedencia?: string | null
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

  if (tab === 0) return <AlumnoFichaPersonalTab persona={persona} cicloId={cicloId} />
  if (tab === 1) return <AlumnoFichaAcademicaTab personaId={persona.id} nombre={`${persona.apellido}, ${persona.nombre}`} />
  if (tab === 2) return <Placeholder text="Ficha médica — próximamente" />
  if (tab === 3) return <Placeholder text="Boletines — próximamente" />
  if (tab === 4) return <Autorizaciones personaId={persona.id} />
  return null
}

function Autorizaciones({ personaId }: { personaId: string }) {
  return (
    <Box>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}
      >
        Personas autorizadas a retirar
      </Typography>
      <AlumnoRetirosTab alumnoId={personaId} />
    </Box>
  )
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

  const alumnoTabLabels = ['Ficha Personal', 'Ficha Académica', 'Ficha Médica', 'Boletines', 'Autorizaciones']
  const staffTabLabels = ['Ficha Personal']
  const padreTabLabels = ['Ficha Personal']

  const tabLabels = isAlumno ? alumnoTabLabels : isPadre ? padreTabLabels : staffTabLabels

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <LegajoEncabezado
        persona={isNew ? null : persona ?? null}
        titulo={title}
        tipo={tipo}
        tipoLabel={TIPO_LABELS[tipo] ?? tipo}
        esAlumno={isAlumno}
        onVolver={() => navigate('/legajos')}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        {tabLabels.map((label, i) => (
          <Tab key={label} label={label} disabled={isNew && i > 0} />
        ))}
      </Tabs>

      {isAlumno && !isNew && persona && <AlumnoTabs persona={persona} tab={tab} />}
      {isAlumno && isNew && tab === 0 && (
        <AlumnoFichaPersonalTab persona={null} cicloId={cicloId} />
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
