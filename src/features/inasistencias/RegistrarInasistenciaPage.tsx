import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import { ArrowBack, Save, Warning } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { useAuth } from '@/contexts/AuthContext'
import { useConfig } from '@/hooks/useConfig'
import { useConfigNotificaciones } from './notificaciones/useConfigNotificaciones'
import { diaInfo, TIPOS_DIA_ESPECIAL } from '@/lib/calendario'
import {
  notificacionesCruzadas,
  etiquetaPeriodo,
  RANGO_TODO,
  type NotificacionInasistencia,
  type RangoFechas,
} from './notificaciones/periodos'

interface TipoInasistencia {
  nombre: string
  valor: number
  tecla: string
}

interface InasistenciasConfig {
  tipos: TipoInasistencia[]
  doble_turno?: boolean
  limite_no_regular: number
}

interface AvisoInasistencia {
  alumno: string
  noRegular: boolean
  notificaciones: NotificacionInasistencia[]
}

interface InasistenciaRecord {
  id: string
  persona_id: string
  fecha: string
  turno: string
  tipo: string
  valor: number
  justificada: boolean
}

type CellKey = string

interface CellState {
  tipo: string | null
  justificada: boolean
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const DEFAULT_TIPOS: TipoInasistencia[] = [
  { nombre: 'Ausente', valor: 1, tecla: 'A' },
  { nombre: 'Tarde', valor: 0.5, tecla: 'T' },
]

function cellKey(personaId: string, dia: number, turno: string): CellKey {
  return `${personaId}_${dia}_${turno}`
}

export function RegistrarInasistenciaPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { cicloId, ciclo } = useCiclo()
  const { personal } = useAuth()

  const now = new Date()
  const [cursoId, setCursoId] = useState('')
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [año] = useState(now.getFullYear())
  const [changes, setChanges] = useState<Record<CellKey, CellState>>({})
  const [focusRow, setFocusRow] = useState(0)
  const [focusCol, setFocusCol] = useState(0)
  const [aviso, setAviso] = useState<AvisoInasistencia | null>(null)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const { data: configData } = useConfig<InasistenciasConfig>('inasistencias')
  const tipos: TipoInasistencia[] = configData?.tipos ?? DEFAULT_TIPOS
  // configData.doble_turno es el valor anterior a la migración 004; se usa solo si el ciclo aún no tiene la columna
  const dobleTurno: boolean = ciclo?.doble_turno ?? configData?.doble_turno ?? false
  const limiteNoRegular: number = configData?.limite_no_regular ?? 25
  const { config: configNotificaciones } = useConfigNotificaciones()
  const notificaciones = configNotificaciones.notificaciones

  const turnos = useMemo(() => (dobleTurno ? ['manana', 'tarde'] : ['unico']), [dobleTurno])

  const diasEnMes = new Date(año, mes, 0).getDate()
  const dias = useMemo(() => {
    const arr: { num: number; dow: number; cursable: boolean; especialTipo: string | null; motivo: string | null }[] = []
    for (let d = 1; d <= diasEnMes; d++) {
      const info = diaInfo(ciclo, año, mes, d)
      arr.push({
        num: d,
        dow: new Date(año, mes - 1, d).getDay(),
        cursable: info.cursable,
        especialTipo: info.especial?.tipo ?? null,
        motivo: info.motivo,
      })
    }
    return arr
  }, [año, mes, diasEnMes, ciclo])

  const editableCols = useMemo(() => {
    const cols: { dia: number; turno: string }[] = []
    for (const d of dias) {
      if (!d.cursable) continue
      for (const t of turnos) {
        cols.push({ dia: d.num, turno: t })
      }
    }
    return cols
  }, [dias, turnos])

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

  const fechaDesde = `${año}-${String(mes).padStart(2, '0')}-01`
  const fechaHasta = `${año}-${String(mes).padStart(2, '0')}-${String(diasEnMes).padStart(2, '0')}`

  const { data: registros = [] } = useQuery({
    queryKey: ['inasistencias-mes', cursoId, mes, año],
    queryFn: async () => {
      if (!cursoId || alumnos.length === 0) return []
      const ids = alumnos.map((a) => a.persona_id)
      const { data, error } = await supabase
        .from('inasistencias')
        .select('id, persona_id, fecha, turno, tipo, valor, justificada')
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .in('persona_id', ids)
      if (error) throw error
      return data as InasistenciaRecord[]
    },
    enabled: !!cursoId && alumnos.length > 0,
  })

  const { data: filasCiclo = [] } = useQuery({
    queryKey: ['inasistencias-totales', cicloId, cursoId],
    queryFn: async () => {
      if (!cicloId || alumnos.length === 0) return []
      const ids = alumnos.map((a) => a.persona_id)
      const { data, error } = await supabase
        .from('inasistencias')
        .select('persona_id, fecha, valor, justificada')
        .eq('ciclo_id', cicloId)
        .in('persona_id', ids)
      if (error) throw error
      return data as { persona_id: string; fecha: string; valor: number; justificada: boolean }[]
    },
    enabled: !!cicloId && alumnos.length > 0,
  })

  const totalesAnuales = useMemo(() => {
    const totals: Record<string, { total: number; justificadas: number; injustificadas: number }> = {}
    for (const row of filasCiclo) {
      if (!totals[row.persona_id]) totals[row.persona_id] = { total: 0, justificadas: 0, injustificadas: 0 }
      const v = Number(row.valor)
      totals[row.persona_id].total += v
      if (row.justificada) totals[row.persona_id].justificadas += v
      else totals[row.persona_id].injustificadas += v
    }
    return totals
  }, [filasCiclo])

  const registroMap = useMemo(() => {
    const map: Record<CellKey, InasistenciaRecord> = {}
    for (const r of registros) {
      const dia = parseInt(r.fecha.split('-')[2])
      map[cellKey(r.persona_id, dia, r.turno)] = r
    }
    return map
  }, [registros])

  const getCell = useCallback(
    (personaId: string, dia: number, turno: string): CellState => {
      const key = cellKey(personaId, dia, turno)
      if (changes[key]) return changes[key]
      const existing = registroMap[key]
      if (existing) return { tipo: existing.tipo, justificada: existing.justificada }
      return { tipo: null, justificada: false }
    },
    [changes, registroMap],
  )

  const monthlyStats = useMemo(() => {
    if (alumnos.length === 0) return {}
    const stats: Record<string, { total: number; justificadas: number; injustificadas: number }> = {}
    for (const a of alumnos) {
      let total = 0, justificadas = 0, injustificadas = 0
      for (const d of dias) {
        if (!d.cursable) continue
        for (const t of turnos) {
          const cell = getCell(a.persona_id, d.num, t)
          if (cell.tipo) {
            const tipoConfig = tipos.find((x) => x.nombre === cell.tipo)
            const val = tipoConfig?.valor ?? 1
            total += val
            if (cell.justificada) justificadas += val
            else injustificadas += val
          }
        }
      }
      stats[a.persona_id] = { total, justificadas, injustificadas }
    }
    return stats
  }, [alumnos, dias, turnos, getCell, tipos])

  function setCellType(personaId: string, dia: number, turno: string, tipo: string | null) {
    const key = cellKey(personaId, dia, turno)
    const current = getCell(personaId, dia, turno)
    setChanges((prev) => ({ ...prev, [key]: { tipo, justificada: tipo === null ? false : current.justificada } }))
  }

  function toggleJustificada(personaId: string, dia: number, turno: string) {
    const key = cellKey(personaId, dia, turno)
    const current = getCell(personaId, dia, turno)
    if (!current.tipo) return
    setChanges((prev) => ({ ...prev, [key]: { ...current, justificada: !current.justificada } }))
  }

  function getRegularityStatus(total: number): { label: string; color: string } | null {
    if (total >= limiteNoRegular) return { label: 'No Regular', color: '#dc2626' }
    return null
  }

  function valorDe(tipo: string | null): number {
    if (!tipo) return 0
    return tipos.find((t) => t.nombre === tipo)?.valor ?? 1
  }

  function fechaDelDia(dia: number): string {
    return `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  }

  function totalEnPeriodo(personaId: string, rango: RangoFechas, pending: Record<CellKey, CellState>): number {
    let total = 0
    for (const f of filasCiclo) {
      if (f.persona_id === personaId && f.fecha >= rango.desde && f.fecha <= rango.hasta) total += Number(f.valor)
    }
    const prefix = `${personaId}_`
    for (const [key, estado] of Object.entries(pending)) {
      if (!key.startsWith(prefix)) continue
      const fecha = fechaDelDia(parseInt(key.split('_')[1]))
      if (fecha < rango.desde || fecha > rango.hasta) continue
      total += valorDe(estado.tipo) - Number(registroMap[key]?.valor ?? 0)
    }
    return total
  }

  function applyTipo(
    alumno: { persona_id: string; apellido: string; nombre: string },
    col: { dia: number; turno: string },
    tipo: TipoInasistencia,
  ) {
    const key = cellKey(alumno.persona_id, col.dia, col.turno)
    const current = getCell(alumno.persona_id, col.dia, col.turno)
    const nextTipo = current.tipo === tipo.nombre ? null : tipo.nombre
    const despuesCambios = { ...changes, [key]: { tipo: nextTipo, justificada: current.justificada } }
    const contar = (rango: RangoFechas) => ({
      antes: totalEnPeriodo(alumno.persona_id, rango, changes),
      despues: totalEnPeriodo(alumno.persona_id, rango, despuesCambios),
    })
    setCellType(alumno.persona_id, col.dia, col.turno, nextTipo)
    const totalCiclo = contar(RANGO_TODO)
    const noRegular = totalCiclo.despues >= limiteNoRegular && totalCiclo.antes < limiteNoRegular
    const cruzadas = notificacionesCruzadas(notificaciones, contar, fechaDelDia(col.dia), ciclo)
    if (noRegular || cruzadas.length > 0) {
      setAviso({ alumno: `${alumno.apellido}, ${alumno.nombre}`, noRegular, notificaciones: cruzadas })
    }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (alumnos.length === 0 || editableCols.length === 0) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    const maxRow = alumnos.length - 1
    const maxCol = editableCols.length - 1

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setFocusCol((c) => Math.min(c + 1, maxCol))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setFocusCol((c) => Math.max(c - 1, 0))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusRow((r) => Math.min(r + 1, maxRow))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusRow((r) => Math.max(r - 1, 0))
    } else if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (focusCol > 0) {
          e.preventDefault()
          setFocusCol(focusCol - 1)
        } else if (focusRow > 0) {
          e.preventDefault()
          setFocusRow(focusRow - 1)
          setFocusCol(maxCol)
        }
      } else if (focusCol < maxCol) {
        e.preventDefault()
        setFocusCol(focusCol + 1)
      } else if (focusRow < maxRow) {
        e.preventDefault()
        setFocusRow(focusRow + 1)
        setFocusCol(0)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      setFocusRow((r) => Math.min(r + 1, maxRow))
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const col = editableCols[focusCol]
      const alumno = alumnos[focusRow]
      if (col && alumno) setCellType(alumno.persona_id, col.dia, col.turno, null)
    } else {
      const key = e.key.toUpperCase()
      if (key === 'J') {
        e.preventDefault()
        const col = editableCols[focusCol]
        const alumno = alumnos[focusRow]
        if (col && alumno) toggleJustificada(alumno.persona_id, col.dia, col.turno)
      } else {
        const tipo = tipos.find((t) => t.tecla.toUpperCase() === key)
        if (tipo) {
          e.preventDefault()
          const col = editableCols[focusCol]
          const alumno = alumnos[focusRow]
          if (col && alumno) applyTipo(alumno, col, tipo)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnos, editableCols, focusRow, focusCol, tipos, getCell, changes, totalesAnuales, registroMap, limiteNoRegular])

  function handleCellClick(rowIdx: number, colIdx: number) {
    setFocusRow(rowIdx)
    setFocusCol(colIdx)
    tableRef.current?.focus()
  }

  const hasChanges = Object.keys(changes).length > 0

  function guard(action: () => void) {
    if (hasChanges) setPendingAction(() => action)
    else action()
  }

  useEffect(() => {
    if (!hasChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  useEffect(() => {
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-r="${focusRow}"][data-c="${focusCol}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [focusRow, focusCol, alumnos.length])

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, estado] of Object.entries(changes)) {
        const [personaId, diaStr, turno] = key.split('_')
        const dia = parseInt(diaStr)
        const fecha = `${año}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        const existing = registroMap[key]

        if (estado.tipo === null) {
          if (existing) {
            const { data, error } = await supabase.from('inasistencias').delete().eq('id', existing.id).select('id')
            if (error) throw error
            if (!data || data.length === 0) throw new Error('No se pudo borrar el registro (sin permisos en la base)')
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
            const { data, error } = await supabase.from('inasistencias').update(row).eq('id', existing.id).select('id')
            if (error) throw error
            if (!data || data.length === 0) throw new Error('No se pudo actualizar el registro (sin permisos en la base)')
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
      queryClient.invalidateQueries({ queryKey: ['inasistencias-mes'] })
      queryClient.invalidateQueries({ queryKey: ['inasistencias-totales'] })
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function cellColor(tipo: string | null, justificada: boolean) {
    if (!tipo) return { bg: 'transparent', text: 'transparent' }
    if (justificada) return { bg: '#dcfce7', text: '#15803d' }
    const t = tipos.find((x) => x.nombre === tipo)
    if (!t) return { bg: '#fee2e2', text: '#ba1a1a' }
    if (t.valor >= 1) return { bg: '#fee2e2', text: '#ba1a1a' }
    if (t.valor > 0) return { bg: '#fef3c7', text: '#964400' }
    return { bg: '#f1f5f9', text: '#64748b' }
  }

  function cellLabel(tipo: string | null): string {
    if (!tipo) return ''
    const t = tipos.find((x) => x.nombre === tipo)
    return t?.tecla?.toUpperCase() ?? tipo.charAt(0).toUpperCase()
  }

  const hoy = new Date()
  const esMesActual = hoy.getFullYear() === año && hoy.getMonth() + 1 === mes
  const diaHoy = esMesActual ? hoy.getDate() : -1

  const colWidth = dobleTurno ? 30 : 22

  const focusedAlumno = alumnos[focusRow] ?? null
  const focusedMonthly = focusedAlumno ? monthlyStats[focusedAlumno.persona_id] : null
  const focusedAnnual = focusedAlumno ? totalesAnuales[focusedAlumno.persona_id] : null
  const focusedRegularity = focusedAnnual ? getRegularityStatus(focusedAnnual.total) : null

  const editableColIndex = useMemo(() => {
    const map: Record<string, number> = {}
    let idx = 0
    for (const d of dias) {
      if (!d.cursable) continue
      for (const t of turnos) {
        map[`${d.num}_${t}`] = idx
        idx++
      }
    }
    return map
  }, [dias, turnos])

  function especialBg(tipo: string | null): string | undefined {
    return tipo ? TIPOS_DIA_ESPECIAL.find((t) => t.value === tipo)?.bg : undefined
  }

  const especialesDelMes = dias.filter((d) => d.especialTipo && d.motivo && d.motivo !== 'Fuera del ciclo lectivo')

  function formatNum(n: number): string {
    return n % 1 === 0 ? String(n) : n.toFixed(2)
  }

  return (
    <Box sx={{ mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => guard(() => navigate('/inasistencias'))}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>Registro de Inasistencias mensual</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          label="Curso"
          value={cursoId}
          onChange={(e) => {
            const value = e.target.value
            guard(() => { setCursoId(value); setChanges({}); setFocusRow(0); setFocusCol(0) })
          }}
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
          select
          label="Mes"
          value={mes}
          onChange={(e) => {
            const value = parseInt(e.target.value)
            guard(() => { setMes(value); setChanges({}); setFocusRow(0); setFocusCol(0) })
          }}
          sx={{ minWidth: 150 }}
        >
          {MESES.map((m, i) => (
            <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
          ))}
        </TextField>
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
            <Button
              key={t.tecla}
              size="small"
              variant="outlined"
              onClick={() => {
                const col = editableCols[focusCol]
                const alumno = alumnos[focusRow]
                if (col && alumno) applyTipo(alumno, col, t)
                tableRef.current?.focus()
              }}
              sx={{ textTransform: 'none', gap: 0.5 }}
            >
              <Chip label={t.tecla} size="small" sx={{ fontWeight: 700, height: 20, minWidth: 20 }} />
              {t.nombre}
            </Button>
          ))}
          <Button
            size="small"
            variant="outlined"
            color="success"
            onClick={() => {
              const col = editableCols[focusCol]
              const alumno = alumnos[focusRow]
              if (col && alumno) toggleJustificada(alumno.persona_id, col.dia, col.turno)
              tableRef.current?.focus()
            }}
            sx={{ textTransform: 'none', gap: 0.5 }}
          >
            <Chip label="J" size="small" sx={{ fontWeight: 700, height: 20, minWidth: 20 }} />
            Justificar
          </Button>
        </Box>
      )}

      {ciclo && ciclo.anio !== año && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          El ciclo lectivo activo es {ciclo.anio} pero la planilla muestra {año}: el calendario de feriados y las fechas del ciclo no coinciden.
        </Alert>
      )}
      {cursoId && alumnos.length > 0 && editableCols.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {MESES[mes - 1]} no tiene días cursables según el ciclo lectivo (inicio/fin y calendario), por eso no se puede cargar nada.
        </Alert>
      )}
      {cursoId && alumnos.length > 0 && especialesDelMes.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
          {especialesDelMes.map((d) => (
            <Chip
              key={d.num}
              size="small"
              label={`${d.num} · ${d.motivo}`}
              sx={{ bgcolor: especialBg(d.especialTipo), fontSize: 11 }}
            />
          ))}
        </Box>
      )}

      {!cursoId ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
          <Typography>Seleccioná un curso para cargar inasistencias</Typography>
        </Box>
      ) : loadingAlumnos ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : alumnos.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
          <Typography>No hay alumnos en este curso</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box
            ref={tableRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            sx={{
              flex: 1,
              overflow: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0,
              outline: 'none',
              scrollPaddingLeft: '190px',
              '&:focus': { borderColor: 'primary.main', boxShadow: '0 0 0 2px rgba(34,91,169,0.15)' },
            }}
          >
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc',
                    padding: '8px 4px', width: 28, minWidth: 28, textAlign: 'center',
                    borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                    fontSize: 10, color: '#94a3b8',
                  }}>#</th>
                  <th style={{
                    position: 'sticky', left: 28, zIndex: 10, background: '#f8fafc',
                    padding: '8px 10px', minWidth: 150, textAlign: 'left',
                    borderBottom: '2px solid #e2e8f0', boxShadow: 'inset -2px 0 0 #e2e8f0',
                    fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>Alumno</th>
                  {dias.map((d) => (
                    <th
                      key={d.num}
                      colSpan={dobleTurno ? 2 : 1}
                      title={d.motivo ?? undefined}
                      style={{
                        padding: '4px 0',
                        textAlign: 'center',
                        borderBottom: '2px solid #e2e8f0',
                        borderLeft: '1px solid #e2e8f0',
                        minWidth: colWidth,
                        opacity: d.cursable ? 1 : d.especialTipo ? 0.85 : 0.35,
                        background: d.num === diaHoy ? '#eff6ff' : (especialBg(d.especialTipo) ?? '#f8fafc'),
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: d.num === diaHoy ? '#1d4ed8' : '#334155' }}>{d.num}</div>
                      <div style={{ fontSize: 9, color: '#94a3b8' }}>{DIAS_SEMANA[d.dow]}</div>
                    </th>
                  ))}
                  <th style={{
                    padding: '8px 6px', minWidth: 44, textAlign: 'center',
                    borderBottom: '2px solid #e2e8f0', borderLeft: '2px solid #e2e8f0',
                    background: '#f8fafc', fontSize: 10, fontWeight: 700, color: '#64748b',
                  }}>Total</th>
                </tr>
                {dobleTurno && (
                  <tr>
                    <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }} />
                    <th style={{ position: 'sticky', left: 28, zIndex: 10, background: '#f8fafc', borderBottom: '1px solid #e2e8f0', boxShadow: 'inset -2px 0 0 #e2e8f0' }} />
                    {dias.map((d) => (
                      <React.Fragment key={d.num}>
                        <th style={{ fontSize: 9, color: '#94a3b8', padding: '2px 0', borderBottom: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', opacity: d.cursable ? 1 : 0.35 }}>M</th>
                        <th style={{ fontSize: 9, color: '#94a3b8', padding: '2px 0', borderBottom: '1px solid #e2e8f0', borderLeft: '0.5px solid #f1f5f9', opacity: d.cursable ? 1 : 0.35 }}>T</th>
                      </React.Fragment>
                    ))}
                    <th style={{ borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #e2e8f0' }} />
                  </tr>
                )}
              </thead>
              <tbody>
                {alumnos.map((a, rowIdx) => {
                  const annual = totalesAnuales[a.persona_id]
                  const total = annual?.total ?? 0
                  const regularity = getRegularityStatus(total)
                  const nearLimit = total >= limiteNoRegular * 0.8
                  const overLimit = total >= limiteNoRegular
                  const rowBg = overLimit ? '#fef2f2' : nearLimit ? '#fffbeb' : '#fff'
                  const isSelectedRow = rowIdx === focusRow

                  return (
                    <tr key={a.persona_id} style={{ background: isSelectedRow ? '#eff6ff' : rowBg }}>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 5, background: isSelectedRow ? '#eff6ff' : rowBg,
                        padding: '0 4px', textAlign: 'center', fontSize: 10, color: '#94a3b8',
                        borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0',
                      }}>{rowIdx + 1}</td>
                      <td style={{
                        position: 'sticky', left: 28, zIndex: 5, background: isSelectedRow ? '#eff6ff' : rowBg,
                        padding: '0 10px', borderBottom: '1px solid #e2e8f0',
                        boxShadow: 'inset -2px 0 0 #e2e8f0', whiteSpace: 'nowrap',
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span style={{ fontSize: 12, fontWeight: isSelectedRow ? 700 : 500, color: '#334155' }}>
                            {a.apellido}, {a.nombre}
                          </span>
                          {regularity && (
                            <Chip label={regularity.label} size="small" sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: regularity.color, color: '#fff' }} />
                          )}
                        </Box>
                      </td>
                      {dias.map((d) =>
                        turnos.map((turno) => {
                          const cell = getCell(a.persona_id, d.num, turno)
                          const colors = cellColor(cell.tipo, cell.justificada)
                          const label = cellLabel(cell.tipo)
                          const isWeekend = !d.cursable
                          const colIdx = isWeekend ? -1 : editableColIndex[`${d.num}_${turno}`]
                          const isFocused = isSelectedRow && colIdx === focusCol && !isWeekend

                          return (
                            <td
                              key={`${d.num}_${turno}`}
                              onClick={() => !isWeekend && handleCellClick(rowIdx, colIdx)}
                              style={{
                                padding: 0,
                                borderBottom: '1px solid #e2e8f0',
                                borderLeft: turno === turnos[0] ? '1px solid #e2e8f0' : '0.5px solid #f1f5f9',
                                background: isWeekend
                                  ? (especialBg(d.especialTipo) ?? undefined)
                                  : d.num === diaHoy && !isFocused ? '#eff6ff' : undefined,
                              }}
                            >
                              <Tooltip
                                title={isWeekend ? (d.motivo ?? '') : cell.tipo ? `${cell.tipo}${cell.justificada ? ' (Justificada)' : ''}` : ''}
                                enterDelay={400}
                              >
                                <div
                                  data-r={isWeekend ? undefined : rowIdx}
                                  data-c={isWeekend ? undefined : colIdx}
                                  style={{
                                    scrollMarginTop: 70,
                                    scrollMarginBottom: 20,
                                    width: colWidth,
                                    height: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    cursor: isWeekend ? 'default' : 'pointer',
                                    opacity: isWeekend ? 0.2 : 1,
                                    background: isFocused ? '#225ba9' : (isWeekend ? 'transparent' : colors.bg),
                                    color: isFocused ? '#fff' : colors.text,
                                    position: 'relative',
                                    userSelect: 'none',
                                    outline: isFocused ? '2px solid #225ba9' : 'none',
                                    outlineOffset: -1,
                                    borderRadius: isFocused ? 2 : 0,
                                  }}
                                >
                                  {label}
                                  {cell.justificada && cell.tipo && !isFocused && (
                                    <span style={{
                                      position: 'absolute', top: 2, right: 1,
                                      width: 5, height: 5, borderRadius: '50%',
                                      background: '#22c55e',
                                    }} />
                                  )}
                                  {cell.justificada && cell.tipo && isFocused && (
                                    <span style={{
                                      position: 'absolute', top: 2, right: 1,
                                      width: 5, height: 5, borderRadius: '50%',
                                      background: '#86efac',
                                    }} />
                                  )}
                                </div>
                              </Tooltip>
                            </td>
                          )
                        }),
                      )}
                      <td style={{
                        padding: '0 6px', textAlign: 'center', fontSize: 12, fontWeight: 700,
                        borderBottom: '1px solid #e2e8f0', borderLeft: '2px solid #e2e8f0',
                        color: overLimit ? '#ba1a1a' : nearLimit ? '#964400' : total > 0 ? '#ba1a1a' : '#94a3b8',
                      }}>
                        {total > 0 ? formatNum(total) : '0'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Box>

          {focusedAlumno && (
            <Box sx={{
              width: 220,
              flexShrink: 0,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 0,
              p: 2,
              alignSelf: 'flex-start',
              position: 'sticky',
              top: 80,
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 0.5 }}>
                {focusedAlumno.apellido}, {focusedAlumno.nombre}
              </Typography>
              {focusedRegularity && (
                <Chip
                  icon={<Warning sx={{ fontSize: 14 }} />}
                  label={focusedRegularity.label}
                  size="small"
                  sx={{ mb: 1.5, fontWeight: 700, bgcolor: focusedRegularity.color, color: '#fff', '& .MuiChip-icon': { color: '#fff' } }}
                />
              )}

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mt: 1, mb: 0.5 }}>
                {MESES[mes - 1]}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mb: 1.5 }}>
                <StatRow label="Total" value={focusedMonthly?.total ?? 0} />
                <StatRow label="Justificadas" value={focusedMonthly?.justificadas ?? 0} color="#15803d" />
                <StatRow label="Injustificadas" value={focusedMonthly?.injustificadas ?? 0} color="#ba1a1a" />
              </Box>

              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.5 }}>
                Anual
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <StatRow label="Total" value={focusedAnnual?.total ?? 0} bold />
                <StatRow label="Justificadas" value={focusedAnnual?.justificadas ?? 0} color="#15803d" />
                <StatRow label="Injustificadas" value={focusedAnnual?.injustificadas ?? 0} color="#ba1a1a" />
              </Box>

              <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                  Límite: {limiteNoRegular}
                </Typography>
                <Box sx={{
                  mt: 0.5,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#f1f5f9',
                  overflow: 'hidden',
                }}>
                  <Box sx={{
                    height: '100%',
                    borderRadius: 3,
                    width: `${Math.min(((focusedAnnual?.total ?? 0) / limiteNoRegular) * 100, 100)}%`,
                    bgcolor: (focusedAnnual?.total ?? 0) >= limiteNoRegular ? '#dc2626' : (focusedAnnual?.total ?? 0) >= limiteNoRegular * 0.8 ? '#f59e0b' : '#225ba9',
                    transition: 'width 0.3s',
                  }} />
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      <Dialog open={!!pendingAction} onClose={() => setPendingAction(null)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" /> Cambios sin guardar
        </DialogTitle>
        <DialogContent>
          <Typography>
            Tenés inasistencias cargadas que todavía no se guardaron. Si continuás, <strong>esos cambios no se van a guardar</strong>.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingAction(null)} autoFocus>Seguir editando</Button>
          <Button
            color="error"
            onClick={() => {
              const action = pendingAction
              setPendingAction(null)
              setChanges({})
              action?.()
            }}
          >
            Descartar y continuar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!aviso} onClose={() => setAviso(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color={aviso?.noRegular ? 'error' : 'warning'} /> {aviso?.noRegular ? 'Alumno No Regular' : 'Aviso de inasistencias'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {aviso?.noRegular && (
            <Typography>
              <strong>{aviso.alumno}</strong> ha alcanzado el límite de {limiteNoRegular} inasistencias y queda en condición de <strong>No Regular</strong>.
            </Typography>
          )}
          {aviso?.notificaciones.map((n) => (
            <Box key={`${n.periodo}_${n.limite}`}>
              <Typography>
                <strong>{aviso.alumno}</strong> llegó a las <strong>{n.limite}</strong> inasistencias en {etiquetaPeriodo(n.periodo)}.
              </Typography>
              {n.mensaje && <Typography variant="body2" color="text.secondary">{n.mensaje}</Typography>}
              {n.notificar_padres && (
                <Chip
                  size="small"
                  color="info"
                  label="Corresponde notificar a los padres"
                  sx={{ mt: 0.75 }}
                />
              )}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAviso(null)} variant="contained">Entendido</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function StatRow({ label, value, color, bold }: { label: string; value: number; color?: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: bold ? 700 : 500, color: color ?? 'text.primary' }}>
        {value % 1 === 0 ? value : value.toFixed(2)}
      </Typography>
    </Box>
  )
}
