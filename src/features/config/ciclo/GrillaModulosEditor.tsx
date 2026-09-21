import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { ContentCopy, Save } from '@mui/icons-material'
import {
  DIAS_SEMANA,
  TURNOS,
  generarModulos,
  modulosDelDia,
  parametrosDeModulos,
  type GrillaModulos,
  type ParametrosDia,
  type Turno,
} from './grilla'

type Borradores = Record<Turno, Record<number, ParametrosDia>>

const INICIO_POR_DEFECTO: Record<Turno, string> = { manana: '07:30', tarde: '13:00' }

const desdeGrilla = (grilla: GrillaModulos | null | undefined): Borradores => {
  const borradores = { manana: {}, tarde: {} } as Borradores
  for (const t of TURNOS) {
    for (const d of DIAS_SEMANA) {
      borradores[t.value][d.n] = parametrosDeModulos(modulosDelDia(grilla, t.value, d.n), INICIO_POR_DEFECTO[t.value])
    }
  }
  return borradores
}

const haciaGrilla = (borradores: Borradores): GrillaModulos => {
  const grilla: GrillaModulos = {}
  for (const t of TURNOS) {
    grilla[t.value] = {}
    for (const d of DIAS_SEMANA) {
      const p = borradores[t.value][d.n]
      grilla[t.value]![String(d.n)] = generarModulos(p.inicio, p.cantidad, p.duracion, p.descanso)
    }
  }
  return grilla
}

interface Props {
  grilla: GrillaModulos | null | undefined
  deshabilitado?: boolean
  guardando?: boolean
  onGuardar: (grilla: GrillaModulos) => void
}

/** Cuántos módulos tiene cada día de cada turno, a qué hora empiezan y cuánto duran. Cada día puede ser distinto. */
export function GrillaModulosEditor({ grilla, deshabilitado = false, guardando = false, onGuardar }: Props) {
  const [turno, setTurno] = useState<Turno>('manana')
  const [borradores, setBorradores] = useState<Borradores>(() => desdeGrilla(grilla))

  useEffect(() => {
    setBorradores(desdeGrilla(grilla))
  }, [grilla])

  function cambiar(dia: number, cambio: Partial<ParametrosDia>) {
    setBorradores((b) => ({ ...b, [turno]: { ...b[turno], [dia]: { ...b[turno][dia], ...cambio } } }))
  }

  function copiarLunes() {
    setBorradores((b) => ({
      ...b,
      [turno]: Object.fromEntries(DIAS_SEMANA.map((d) => [d.n, { ...b[turno][1] }])) as Record<number, ParametrosDia>,
    }))
  }

  const numero = (texto: string) => (texto === '' ? 0 : Number(texto))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={turno} onChange={(_, v) => v && setTurno(v)}>
          {TURNOS.map((t) => (
            <ToggleButton key={t.value} value={t.value} sx={{ textTransform: 'none', px: 2 }}>{t.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button size="small" startIcon={<ContentCopy />} disabled={deshabilitado} onClick={copiarLunes}>
          Copiar el lunes a todos los días
        </Button>
      </Box>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Día</TableCell>
              <TableCell>Módulos</TableCell>
              <TableCell>Empieza a las</TableCell>
              <TableCell>Duración (min)</TableCell>
              <TableCell>Recreo (min)</TableCell>
              <TableCell>Horarios</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {DIAS_SEMANA.map((d) => {
              const p = borradores[turno][d.n]
              const modulos = generarModulos(p.inicio, p.cantidad, p.duracion, p.descanso)
              return (
                <TableRow key={d.n}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{d.label}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={p.cantidad}
                      disabled={deshabilitado}
                      onChange={(e) => cambiar(d.n, { cantidad: Math.min(12, Math.max(0, numero(e.target.value))) })}
                      slotProps={{ htmlInput: { min: 0, max: 12, 'aria-label': `Módulos del ${d.label}` } }}
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="time"
                      value={p.inicio}
                      disabled={deshabilitado || p.cantidad === 0}
                      onChange={(e) => cambiar(d.n, { inicio: e.target.value })}
                      slotProps={{ htmlInput: { 'aria-label': `Hora de inicio del ${d.label}` } }}
                      sx={{ width: 130 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={p.duracion}
                      disabled={deshabilitado || p.cantidad === 0}
                      onChange={(e) => cambiar(d.n, { duracion: numero(e.target.value) })}
                      slotProps={{ htmlInput: { min: 10, max: 180, step: 5, 'aria-label': `Duración del módulo del ${d.label}` } }}
                      sx={{ width: 90 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={p.descanso}
                      disabled={deshabilitado || p.cantidad < 2}
                      onChange={(e) => cambiar(d.n, { descanso: numero(e.target.value) })}
                      slotProps={{ htmlInput: { min: 0, max: 60, step: 5, 'aria-label': `Recreo del ${d.label}` } }}
                      sx={{ width: 90 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color={modulos.length > 0 ? 'text.secondary' : 'text.disabled'}>
                      {modulos.length > 0 ? modulos.map((m) => `${m.inicio}–${m.fin}`).join(' · ') : 'Sin clases'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          disabled={deshabilitado || guardando}
          startIcon={guardando ? <CircularProgress size={18} /> : <Save />}
          onClick={() => onGuardar(haciaGrilla(borradores))}
        >
          Guardar los módulos
        </Button>
      </Box>
    </Box>
  )
}
