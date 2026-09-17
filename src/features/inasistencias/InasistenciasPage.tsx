import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, Settings, CheckCircle, Save } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'
import { InasistenciasConfigDialog } from './InasistenciasConfigDialog'

interface AlumnoRow {
  persona_id: string
  apellido: string
  nombre: string
  foto_url: string | null
}

interface InasistenciaRow {
  id: string
  persona_id: string
  tipo: string
  valor: number
  justificada: boolean
  turno: string
  observaciones: string | null
}

interface TipoInasistencia {
  nombre: string
  valor: number
}

type EstadoAlumno = {
  tipo: string | null
  justificada: boolean
}

export function InasistenciasPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { cicloId } = useCiclo()
  const { personal } = useAuth()
  const isAdmin = personal?.rol === 'admin' || personal?.rol === 'directivo'

  const [cursoId, setCursoId] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0])
  const [configOpen, setConfigOpen] = useState(false)
  const [changes, setChanges] = useState<Record<string, EstadoAlumno>>({})

  const { data: configData } = useConfig('inasistencias')
  const tipos: TipoInasistencia[] = configData?.tipos ?? [
    { nombre: 'Ausente', valor: 1 },
    { nombre: 'Tarde', valor: 0.5 },
  ]
  const limiteAnual: number = configData?.limite_anual ?? 25
  const dobleTurno: boolean = configData?.doble_turno ?? false

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
      return data as { id: string; nombre: string; division: string | null }[]
    },
    enabled: !!cicloId,
  })

  const { data: alumnos = [], isLoading: loadingAlumnos } = useQuery({
    queryKey: ['alumnos-curso', cursoId],
    queryFn: async () => {
      if (!cursoId) return []
      const { data, error } = await supabase
        .from('alumno_datos')
        .select('persona_id, personas!alumno_datos_persona_id_fkey(id, apellido, nombre, foto_url)')
        .eq('curso_id', cursoId)
        .eq('estado', 'activo')
      if (error) {
        console.error('Error cargando alumnos del curso:', error)
        throw error
      }
      console.log('Alumnos raw data:', data)
      return (data as unknown as { persona_id: string; personas: { id: string; apellido: string; nombre: string; foto_url: string | null } }[])
        .filter((a) => a.personas)
        .map((a) => ({
          persona_id: a.persona_id,
          apellido: a.personas.apellido,
          nombre: a.personas.nombre,
          foto_url: a.personas.foto_url,
        }))
        .sort((a, b) => a.apellido.localeCompare(b.apellido))
    },
    enabled: !!cursoId,
  })

  const { data: inasistenciasDia = [] } = useQuery({
    queryKey: ['inasistencias-dia', cursoId, fecha],
    queryFn: async () => {
      if (!cursoId || !fecha || alumnos.length === 0) return []
      const personaIds = alumnos.map((a) => a.persona_id)
      const { data, error } = await supabase
        .from('inasistencias')
        .select('id, persona_id, tipo, valor, justificada, turno, observaciones')
        .eq('fecha', fecha)
        .in('persona_id', personaIds)
      if (error) throw error
      return data as InasistenciaRow[]
    },
    enabled: !!cursoId && !!fecha && alumnos.length > 0,
  })

  const { data: totalesAnuales = {} } = useQuery({
    queryKey: ['inasistencias-totales', cicloId, cursoId],
    queryFn: async () => {
      if (!cicloId || alumnos.length === 0) return {}
      const personaIds = alumnos.map((a) => a.persona_id)
      const { data, error } = await supabase
        .from('inasistencias')
        .select('persona_id, valor')
        .eq('ciclo_id', cicloId)
        .in('persona_id', personaIds)
      if (error) throw error
      const totals: Record<string, number> = {}
      for (const row of data) {
        totals[row.persona_id] = (totals[row.persona_id] ?? 0) + Number(row.valor)
      }
      return totals
    },
    enabled: !!cicloId && alumnos.length > 0,
  })

  const inasistenciaMap = useMemo(() => {
    const map: Record<string, InasistenciaRow> = {}
    for (const i of inasistenciasDia) {
      map[`${i.persona_id}_${i.turno}`] = i
    }
    return map
  }, [inasistenciasDia])

  function getEstado(personaId: string, turno: string): EstadoAlumno {
    const key = `${personaId}_${turno}`
    if (changes[key]) return changes[key]
    const existing = inasistenciaMap[key]
    if (existing) return { tipo: existing.tipo, justificada: existing.justificada }
    return { tipo: null, justificada: false }
  }

  function toggleTipo(personaId: string, turno: string) {
    const key = `${personaId}_${turno}`
    const current = getEstado(personaId, turno)
    const tipoNames = tipos.map((t) => t.nombre)

    let nextTipo: string | null
    if (current.tipo === null) {
      nextTipo = tipoNames[0] ?? 'Ausente'
    } else {
      const idx = tipoNames.indexOf(current.tipo)
      if (idx < tipoNames.length - 1) {
        nextTipo = tipoNames[idx + 1]
      } else {
        nextTipo = null
      }
    }

    setChanges((prev) => ({
      ...prev,
      [key]: { tipo: nextTipo, justificada: current.justificada },
    }))
  }

  function toggleJustificada(personaId: string, turno: string) {
    const key = `${personaId}_${turno}`
    const current = getEstado(personaId, turno)
    if (!current.tipo) return
    setChanges((prev) => ({
      ...prev,
      [key]: { ...current, justificada: !current.justificada },
    }))
  }

  const hasChanges = Object.keys(changes).length > 0

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, estado] of Object.entries(changes)) {
        const [personaId, turno] = key.split('_')
        const existing = inasistenciaMap[key]

        if (estado.tipo === null) {
          if (existing) {
            await supabase.from('inasistencias').delete().eq('id', existing.id)
          }
        } else {
          const tipoConfig = tipos.find((t) => t.nombre === estado.tipo)
          const row = {
            persona_id: personaId,
            ciclo_id: cicloId!,
            fecha,
            turno,
            tipo: estado.tipo,
            valor: tipoConfig?.valor ?? 1,
            justificada: estado.justificada,
            registrado_por: personal?.id ?? null,
          }

          if (existing) {
            const { error } = await supabase.from('inasistencias').update(row).eq('id', existing.id)
            if (error) throw error
          } else {
            const { error } = await supabase.from('inasistencias').insert(row)
            if (error) throw error
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Inasistencias guardadas')
      setChanges({})
      queryClient.invalidateQueries({ queryKey: ['inasistencias-dia', cursoId, fecha] })
      queryClient.invalidateQueries({ queryKey: ['inasistencias-totales'] })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const turnos = dobleTurno ? ['manana', 'tarde'] : ['unico']
  const turnoLabel: Record<string, string> = { unico: '', manana: 'M', tarde: 'T' }

  function chipColor(tipo: string | null, justificada: boolean) {
    if (!tipo) return undefined
    if (justificada) return 'success' as const
    if (tipo === 'Ausente') return 'error' as const
    return 'warning' as const
  }

  function chipLabel(tipo: string | null, justificada: boolean) {
    if (!tipo) return null
    return justificada ? `${tipo} (J)` : tipo
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Inasistencias</Typography>
        </Box>
        {isAdmin && (
          <IconButton onClick={() => setConfigOpen(true)}>
            <Settings />
          </IconButton>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          select
          label="Curso"
          value={cursoId}
          onChange={(e) => { setCursoId(e.target.value); setChanges({}) }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">Seleccionar curso</MenuItem>
          {cursos.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.nombre}{c.division ? ` ${c.division}` : ''}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          label="Fecha"
          value={fecha}
          onChange={(e) => { setFecha(e.target.value); setChanges({}) }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {hasChanges && (
          <Button
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={18} /> : <Save />}
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Guardar
          </Button>
        )}
      </Box>

      {!cursoId ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">Seleccioná un curso para tomar asistencia</Typography>
        </Card>
      ) : loadingAlumnos ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : alumnos.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">No hay alumnos en este curso</Typography>
        </Card>
      ) : (
        <>
          {dobleTurno && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: 'center' }}>Mañana</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 80, textAlign: 'center' }}>Tarde</Typography>
              <Box sx={{ width: 32 }} />
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {alumnos.map((a) => {
              const total = totalesAnuales[a.persona_id] ?? 0
              const nearLimit = total >= limiteAnual * 0.8
              const overLimit = total >= limiteAnual

              return (
                <Card key={a.persona_id} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Avatar
                    src={a.foto_url ?? undefined}
                    sx={{ width: 36, height: 36, bgcolor: 'primary.light', fontSize: '0.8rem' }}
                  >
                    {a.apellido[0]}{a.nombre[0]}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                      {a.apellido}, {a.nombre}
                    </Typography>
                  </Box>
                  <Tooltip title={`${total} / ${limiteAnual} inasistencias`}>
                    <Chip
                      label={total}
                      size="small"
                      color={overLimit ? 'error' : nearLimit ? 'warning' : 'default'}
                      variant={overLimit || nearLimit ? 'filled' : 'outlined'}
                      sx={{ minWidth: 36 }}
                    />
                  </Tooltip>
                  {turnos.map((turno) => {
                    const estado = getEstado(a.persona_id, turno)
                    const label = chipLabel(estado.tipo, estado.justificada)
                    return (
                      <Box key={turno} sx={{ display: 'flex', gap: 0.5 }}>
                        <Chip
                          label={label ?? (dobleTurno ? turnoLabel[turno] : <CheckCircle sx={{ fontSize: 16 }} />)}
                          size="small"
                          color={estado.tipo ? chipColor(estado.tipo, estado.justificada) : 'default'}
                          variant={estado.tipo ? 'filled' : 'outlined'}
                          onClick={() => toggleTipo(a.persona_id, turno)}
                          sx={{ minWidth: 70, cursor: 'pointer' }}
                        />
                        {estado.tipo && (
                          <Tooltip title={estado.justificada ? 'Quitar justificación' : 'Justificar'}>
                            <Chip
                              label="J"
                              size="small"
                              color={estado.justificada ? 'success' : 'default'}
                              variant={estado.justificada ? 'filled' : 'outlined'}
                              onClick={() => toggleJustificada(a.persona_id, turno)}
                              sx={{ cursor: 'pointer', minWidth: 28 }}
                            />
                          </Tooltip>
                        )}
                      </Box>
                    )
                  })}
                </Card>
              )
            })}
          </Box>
        </>
      )}

      <InasistenciasConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </Box>
  )
}
