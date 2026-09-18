import { useState, useMemo, useRef } from 'react'
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
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { ArrowBack, Settings, Save } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'
import { InasistenciasConfigDialog } from './InasistenciasConfigDialog'

interface AlumnoRow {
  persona_id: string
  apellido: string
  nombre: string
}

interface InasistenciaRow {
  id: string
  persona_id: string
  fecha: string
  tipo: string
  valor: number
  justificada: boolean
  turno: string
  observaciones: string | null
}

interface TipoInasistencia {
  nombre: string
  valor: number
  tecla: string
}

type EstadoAlumno = {
  tipo: string | null
  justificada: boolean
}

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

export function InasistenciasPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { cicloId } = useCiclo()
  const { personal } = useAuth()
  const isAdmin = personal?.rol === 'admin' || personal?.rol === 'directivo'

  const [cursoId, setCursoId] = useState('')
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [configOpen, setConfigOpen] = useState(false)
  const [changes, setChanges] = useState<Record<string, EstadoAlumno>>({})
  const cellRefs = useRef<(HTMLDivElement | null)[][]>([])

  const { data: configData } = useConfig<{ tipos?: TipoInasistencia[]; limite_anual?: number; doble_turno?: boolean }>('inasistencias')
  const tipos: TipoInasistencia[] = configData?.tipos ?? [
    { nombre: 'Ausente', valor: 1, tecla: 'A' },
    { nombre: 'Tarde', valor: 0.5, tecla: 'T' },
  ]
  const limiteAnual: number = configData?.limite_anual ?? 25
  const dobleTurno: boolean = configData?.doble_turno ?? false
  const turnosList = useMemo(() => (dobleTurno ? ['manana', 'tarde'] : ['unico']), [dobleTurno])

  const [year, monthNum] = mes.split('-').map(Number)
  const totalDias = daysInMonth(year, monthNum)
  const dias = useMemo(() => Array.from({ length: totalDias }, (_, i) => i + 1), [totalDias])
  const fechaForDay = (d: number) => `${mes}-${String(d).padStart(2, '0')}`
  const primerDia = fechaForDay(1)
  const ultimoDia = fechaForDay(totalDias)

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
        .select('persona_id, personas!alumno_datos_persona_id_fkey(id, apellido, nombre)')
        .eq('curso_id', cursoId)
        .eq('estado', 'activo')
      if (error) throw error
      return (data as unknown as { persona_id: string; personas: { id: string; apellido: string; nombre: string } }[])
        .filter((a) => a.personas)
        .map((a) => ({
          persona_id: a.persona_id,
          apellido: a.personas.apellido,
          nombre: a.personas.nombre,
        }))
        .sort((a, b) => a.apellido.localeCompare(b.apellido))
    },
    enabled: !!cursoId,
  })

  const { data: inasistenciasMes = [] } = useQuery({
    queryKey: ['inasistencias-mes', cursoId, mes],
    queryFn: async () => {
      if (!cursoId || alumnos.length === 0) return []
      const personaIds = alumnos.map((a) => a.persona_id)
      const { data, error } = await supabase
        .from('inasistencias')
        .select('id, persona_id, fecha, tipo, valor, justificada, turno, observaciones')
        .gte('fecha', primerDia)
        .lte('fecha', ultimoDia)
        .in('persona_id', personaIds)
      if (error) throw error
      return data as InasistenciaRow[]
    },
    enabled: !!cursoId && !!mes && alumnos.length > 0,
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
    for (const i of inasistenciasMes) {
      map[`${i.persona_id}_${i.fecha}_${i.turno}`] = i
    }
    return map
  }, [inasistenciasMes])

  function getEstado(personaId: string, fecha: string, turno: string): EstadoAlumno {
    const key = `${personaId}_${fecha}_${turno}`
    if (changes[key]) return changes[key]
    const existing = inasistenciaMap[key]
    if (existing) return { tipo: existing.tipo, justificada: existing.justificada }
    return { tipo: null, justificada: false }
  }

  function setEstado(personaId: string, fecha: string, turno: string, tipo: string | null, justificada: boolean) {
    const key = `${personaId}_${fecha}_${turno}`
    setChanges((prev) => ({ ...prev, [key]: { tipo, justificada } }))
  }

  function handleCellClick(personaId: string, fecha: string, turno: string, shiftKey: boolean) {
    const current = getEstado(personaId, fecha, turno)
    if (shiftKey) {
      if (!current.tipo) return
      setEstado(personaId, fecha, turno, current.tipo, !current.justificada)
      return
    }
    const tipoNames = tipos.map((t) => t.nombre)
    let nextTipo: string | null
    if (current.tipo === null) {
      nextTipo = tipoNames[0] ?? null
    } else {
      const idx = tipoNames.indexOf(current.tipo)
      nextTipo = idx < tipoNames.length - 1 ? tipoNames[idx + 1] : null
    }
    setEstado(personaId, fecha, turno, nextTipo, current.justificada)
  }

  function focusCell(row: number, col: number) {
    const target = cellRefs.current[row]?.[col]
    if (target) target.focus()
  }

  function handleCellKeyDown(
    e: React.KeyboardEvent,
    row: number,
    col: number,
    personaId: string,
    fecha: string,
    turno: string
  ) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusCell(row, col + 1)
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusCell(row, col - 1)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusCell(row + 1, col)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusCell(row - 1, col)
      return
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      setEstado(personaId, fecha, turno, null, false)
      return
    }
    const tipo = tipos.find((t) => t.tecla && t.tecla.toUpperCase() === e.key.toUpperCase())
    if (tipo) {
      e.preventDefault()
      setEstado(personaId, fecha, turno, tipo.nombre, e.shiftKey)
      focusCell(row, col + 1)
    }
  }

  const hasChanges = Object.keys(changes).length > 0

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, estado] of Object.entries(changes)) {
        const [personaId, fecha, turno] = key.split('_')
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
      queryClient.invalidateQueries({ queryKey: ['inasistencias-mes', cursoId, mes] })
      queryClient.invalidateQueries({ queryKey: ['inasistencias-totales'] })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function tipoColor(tipoNombre: string): string {
    return tipoNombre === 'Ausente' ? 'error.main' : 'warning.main'
  }

  const flatRows = useMemo(
    () => alumnos.flatMap((a) => turnosList.map((turno, i) => ({ alumno: a, turno, isFirst: i === 0 }))),
    [alumnos, turnosList]
  )

  const NAME_COL_W = 180
  const TOTAL_COL_W = 56
  const TURNO_COL_W = 40

  return (
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
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

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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
          type="month"
          label="Mes"
          value={mes}
          onChange={(e) => { setMes(e.target.value); setChanges({}) }}
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

      {cursoId && alumnos.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {tipos.map((t) => (
            <Chip
              key={t.nombre}
              size="small"
              label={`${t.tecla} = ${t.nombre}`}
              sx={{ bgcolor: tipoColor(t.nombre), color: '#fff', fontWeight: 600 }}
            />
          ))}
          <Typography variant="caption" color="text.secondary">
            Shift+tecla = justificada · Backspace = borrar · flechas/Tab = moverse
          </Typography>
        </Box>
      )}

      {!cursoId ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">Seleccioná un curso para ver la planilla</Typography>
        </Card>
      ) : loadingAlumnos ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : alumnos.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">No hay alumnos en este curso</Typography>
        </Card>
      ) : (
        <TableContainer component={Card} sx={{ maxHeight: '70vh' }}>
          <Table size="small" stickyHeader sx={{ borderCollapse: 'separate' }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{ fontWeight: 700, position: 'sticky', left: 0, top: 0, zIndex: 4, bgcolor: 'background.paper', minWidth: NAME_COL_W }}
                >
                  Alumno
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, position: 'sticky', left: NAME_COL_W, top: 0, zIndex: 4, bgcolor: 'background.paper', minWidth: TOTAL_COL_W }}
                >
                  Total
                </TableCell>
                {dobleTurno && (
                  <TableCell
                    align="center"
                    sx={{ fontWeight: 700, position: 'sticky', left: NAME_COL_W + TOTAL_COL_W, top: 0, zIndex: 4, bgcolor: 'background.paper', minWidth: TURNO_COL_W }}
                  >
                    Turno
                  </TableCell>
                )}
                {dias.map((d) => (
                  <TableCell
                    key={d}
                    align="center"
                    sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 34, px: 0.5 }}
                  >
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, lineHeight: 1.1 }}>{d}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                      {WEEKDAY_LABELS[new Date(year, monthNum - 1, d).getDay()]}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {flatRows.map((r, rowIdx) => {
                const a: AlumnoRow = r.alumno
                const total = totalesAnuales[a.persona_id] ?? 0
                const nearLimit = total >= limiteAnual * 0.8
                const overLimit = total >= limiteAnual

                return (
                  <TableRow key={`${a.persona_id}_${r.turno}`}>
                    {r.isFirst && (
                      <TableCell
                        rowSpan={turnosList.length}
                        sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {a.apellido}, {a.nombre}
                        </Typography>
                      </TableCell>
                    )}
                    {r.isFirst && (
                      <TableCell
                        align="center"
                        rowSpan={turnosList.length}
                        sx={{ position: 'sticky', left: NAME_COL_W, zIndex: 1, bgcolor: 'background.paper' }}
                      >
                        <Chip
                          label={total}
                          size="small"
                          color={overLimit ? 'error' : nearLimit ? 'warning' : 'default'}
                          variant={overLimit || nearLimit ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                    )}
                    {dobleTurno && (
                      <TableCell
                        align="center"
                        sx={{ position: 'sticky', left: NAME_COL_W + TOTAL_COL_W, zIndex: 1, bgcolor: 'background.paper' }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {r.turno === 'manana' ? 'M' : 'T'}
                        </Typography>
                      </TableCell>
                    )}
                    {dias.map((d, colIdx) => {
                      const fecha = fechaForDay(d)
                      const estado = getEstado(a.persona_id, fecha, r.turno)
                      const tecla = tipos.find((t) => t.nombre === estado.tipo)?.tecla ?? ''
                      return (
                        <TableCell key={d} align="center" sx={{ p: 0.25 }}>
                          <Box
                            ref={(el: HTMLDivElement | null) => {
                              if (!cellRefs.current[rowIdx]) cellRefs.current[rowIdx] = []
                              cellRefs.current[rowIdx][colIdx] = el
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`${a.apellido} ${a.nombre}, día ${d}${estado.tipo ? `, ${estado.tipo}${estado.justificada ? ' justificada' : ''}` : ''}`}
                            onClick={(e) => handleCellClick(a.persona_id, fecha, r.turno, e.shiftKey)}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx, a.persona_id, fecha, r.turno)}
                            sx={{
                              width: 30,
                              height: 30,
                              mx: 'auto',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 1,
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              border: '1px solid',
                              borderColor: 'divider',
                              userSelect: 'none',
                              bgcolor: estado.tipo ? (estado.justificada ? 'success.main' : tipoColor(estado.tipo)) : 'transparent',
                              color: estado.tipo ? '#fff' : 'text.disabled',
                              '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
                            }}
                          >
                            {tecla}
                          </Box>
                        </TableCell>
                      )
                    })}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <InasistenciasConfigDialog open={configOpen} onClose={() => setConfigOpen(false)} />
    </Box>
  )
}
