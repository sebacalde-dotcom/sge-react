import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Add, ContentCopy, Save } from '@mui/icons-material'
import {
  DIAS_SEMANA,
  TURNOS,
  diaDesdeModulos,
  modulosDelDia,
  modulosDesdeDia,
  type DiaEditable,
  type GrillaModulos,
  type Turno,
} from './grilla'

type Borradores = Record<Turno, Record<number, DiaEditable>>

interface PorDefecto {
  inicio: string
  duracion: number
  recreo: number
}

const INICIO_POR_DEFECTO: Record<Turno, string> = { manana: '07:30', tarde: '13:00' }

const desdeGrilla = (grilla: GrillaModulos | null | undefined): Borradores => {
  const borradores = { manana: {}, tarde: {} } as Borradores
  for (const t of TURNOS) {
    for (const d of DIAS_SEMANA) {
      borradores[t.value][d.n] = diaDesdeModulos(modulosDelDia(grilla, t.value, d.n), INICIO_POR_DEFECTO[t.value])
    }
  }
  return borradores
}

const haciaGrilla = (borradores: Borradores): GrillaModulos => {
  const grilla: GrillaModulos = {}
  for (const t of TURNOS) {
    grilla[t.value] = {}
    for (const d of DIAS_SEMANA) grilla[t.value]![String(d.n)] = modulosDesdeDia(borradores[t.value][d.n])
  }
  return grilla
}

/** Los valores para los módulos nuevos, tomados de lo que ya hay cargado en el turno. */
const porDefectoDe = (borradores: Borradores, turno: Turno): PorDefecto => {
  const dia = DIAS_SEMANA.map((d) => borradores[turno][d.n]).find((d) => d.modulos.length > 0)
  return {
    inicio: dia?.inicio ?? INICIO_POR_DEFECTO[turno],
    duracion: dia?.modulos[0].duracion ?? 60,
    recreo: dia?.modulos[1]?.recreoAntes ?? 10,
  }
}

const numero = (texto: string) => (texto === '' ? 0 : Number(texto))

interface Props {
  grilla: GrillaModulos | null | undefined
  deshabilitado?: boolean
  guardando?: boolean
  onGuardar: (grilla: GrillaModulos) => void
}

/**
 * Los espacios para módulos de cada día: en cada fila se agregan con el botón "+" y se ajusta cuánto dura cada uno y
 * el recreo que hay antes. Son la capacidad del turno; cuántos usa cada curso lo decide el horario.
 */
export function GrillaModulosEditor({ grilla, deshabilitado = false, guardando = false, onGuardar }: Props) {
  const [turno, setTurno] = useState<Turno>('manana')
  const [borradores, setBorradores] = useState<Borradores>(() => desdeGrilla(grilla))
  const [porDefecto, setPorDefecto] = useState<Record<Turno, PorDefecto>>(() => {
    const b = desdeGrilla(grilla)
    return { manana: porDefectoDe(b, 'manana'), tarde: porDefectoDe(b, 'tarde') }
  })
  const [edicion, setEdicion] = useState<{ dia: number; indice: number; ancla: HTMLElement } | null>(null)

  useEffect(() => {
    const b = desdeGrilla(grilla)
    setBorradores(b)
    setPorDefecto({ manana: porDefectoDe(b, 'manana'), tarde: porDefectoDe(b, 'tarde') })
  }, [grilla])

  const valores = porDefecto[turno]

  function cambiarDia(dia: number, cambio: (actual: DiaEditable) => DiaEditable) {
    setBorradores((b) => ({ ...b, [turno]: { ...b[turno], [dia]: cambio(b[turno][dia]) } }))
  }

  function agregarModulo(dia: number) {
    cambiarDia(dia, (d) => ({
      ...d,
      modulos: [...d.modulos, { duracion: valores.duracion, recreoAntes: d.modulos.length === 0 ? 0 : valores.recreo }],
    }))
  }

  function cambiarModulo(dia: number, indice: number, cambio: Partial<DiaEditable['modulos'][number]>) {
    cambiarDia(dia, (d) => ({ ...d, modulos: d.modulos.map((m, i) => (i === indice ? { ...m, ...cambio } : m)) }))
  }

  function quitarModulo(dia: number, indice: number) {
    cambiarDia(dia, (d) => ({ ...d, modulos: d.modulos.filter((_, i) => i !== indice) }))
    setEdicion(null)
  }

  function copiarALosDemasDias(dia: number) {
    setBorradores((b) => {
      const origen = b[turno][dia]
      const copia = { ...b[turno] }
      for (const d of DIAS_SEMANA) {
        if (d.n !== dia && d.n <= 5) copia[d.n] = { inicio: origen.inicio, modulos: origen.modulos.map((m) => ({ ...m })) }
      }
      return { ...b, [turno]: copia }
    })
  }

  function cambiarPorDefecto(cambio: Partial<PorDefecto>) {
    setPorDefecto((p) => ({ ...p, [turno]: { ...p[turno], ...cambio } }))
    // La hora de inicio también se aplica a los días que todavía no tienen módulos
    if (cambio.inicio !== undefined) {
      setBorradores((b) => {
        const dias = { ...b[turno] }
        for (const d of DIAS_SEMANA) if (dias[d.n].modulos.length === 0) dias[d.n] = { ...dias[d.n], inicio: cambio.inicio! }
        return { ...b, [turno]: dias }
      })
    }
  }

  const diaEnEdicion = edicion ? borradores[turno][edicion.dia] : null
  const moduloEnEdicion = diaEnEdicion && edicion ? diaEnEdicion.modulos[edicion.indice] : null

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={turno} onChange={(_, v) => v && setTurno(v)}>
          {TURNOS.map((t) => (
            <ToggleButton key={t.value} value={t.value} sx={{ textTransform: 'none', px: 2 }}>{t.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          size="small"
          type="time"
          label="Empieza a las"
          value={valores.inicio}
          disabled={deshabilitado}
          onChange={(e) => cambiarPorDefecto({ inicio: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 140 }}
        />
        <TextField
          size="small"
          type="number"
          label="Módulo nuevo (min)"
          value={valores.duracion}
          disabled={deshabilitado}
          onChange={(e) => cambiarPorDefecto({ duracion: numero(e.target.value) })}
          slotProps={{ htmlInput: { min: 10, max: 180, step: 5 } }}
          sx={{ width: 150 }}
        />
        <TextField
          size="small"
          type="number"
          label="Recreo nuevo (min)"
          value={valores.recreo}
          disabled={deshabilitado}
          onChange={(e) => cambiarPorDefecto({ recreo: numero(e.target.value) })}
          slotProps={{ htmlInput: { min: 0, max: 60, step: 5 } }}
          sx={{ width: 150 }}
        />
      </Box>

      <Box>
        {DIAS_SEMANA.map((d) => {
          const dia = borradores[turno][d.n]
          const modulos = modulosDesdeDia(dia)
          return (
            <Box key={d.n} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ width: 84, flexShrink: 0, fontWeight: 600, fontSize: 14 }}>{d.label}</Typography>
              <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
                {modulos.map((m, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {i > 0 && dia.modulos[i].recreoAntes > 0 && (
                      <Tooltip title={`Recreo de ${dia.modulos[i].recreoAntes} minutos`}>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{dia.modulos[i].recreoAntes}′</Typography>
                      </Tooltip>
                    )}
                    <ButtonBase
                      disabled={deshabilitado}
                      onClick={(e) => setEdicion({ dia: d.n, indice: i, ancla: e.currentTarget })}
                      aria-label={`Editar el módulo ${i + 1} del ${d.label}`}
                      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5, bgcolor: 'action.hover', '&:hover': { borderColor: 'primary.main' } }}
                    >
                      <Typography sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        <strong>{i + 1}°</strong> {m.inicio}–{m.fin}
                      </Typography>
                    </ButtonBase>
                  </Box>
                ))}
                <Tooltip title="Agregar un módulo">
                  <span>
                    <IconButton
                      size="small"
                      color="primary"
                      disabled={deshabilitado}
                      onClick={() => agregarModulo(d.n)}
                      aria-label={`Agregar un módulo el ${d.label}`}
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                {modulos.length === 0 && <Typography variant="caption" color="text.disabled">Sin clases</Typography>}
              </Box>
              {d.n <= 5 && (
                <Tooltip title="Copiar este día a los demás días de lunes a viernes">
                  <span>
                    <IconButton
                      size="small"
                      disabled={deshabilitado || dia.modulos.length === 0}
                      onClick={() => copiarALosDemasDias(d.n)}
                      aria-label={`Copiar el ${d.label} a los demás días`}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          )
        })}
      </Box>

      <Popover
        open={!!edicion && !!moduloEnEdicion}
        anchorEl={edicion?.ancla}
        onClose={() => setEdicion(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {edicion && diaEnEdicion && moduloEnEdicion && (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, width: 230 }}>
            <Typography variant="subtitle2">
              Módulo {edicion.indice + 1} del {DIAS_SEMANA.find((d) => d.n === edicion.dia)?.label}
            </Typography>
            {edicion.indice === 0 && (
              <TextField
                size="small"
                type="time"
                label="El día empieza a las"
                value={diaEnEdicion.inicio}
                onChange={(e) => cambiarDia(edicion.dia, (d) => ({ ...d, inicio: e.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            )}
            {edicion.indice > 0 && (
              <TextField
                size="small"
                type="number"
                label="Recreo antes (min)"
                value={moduloEnEdicion.recreoAntes}
                onChange={(e) => cambiarModulo(edicion.dia, edicion.indice, { recreoAntes: numero(e.target.value) })}
                slotProps={{ htmlInput: { min: 0, max: 120, step: 5 } }}
              />
            )}
            <TextField
              size="small"
              type="number"
              label="Duración (min)"
              value={moduloEnEdicion.duracion}
              onChange={(e) => cambiarModulo(edicion.dia, edicion.indice, { duracion: numero(e.target.value) })}
              slotProps={{ htmlInput: { min: 10, max: 180, step: 5 } }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button size="small" color="error" onClick={() => quitarModulo(edicion.dia, edicion.indice)}>Quitar</Button>
              <Button size="small" onClick={() => setEdicion(null)}>Listo</Button>
            </Box>
          </Box>
        )}
      </Popover>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          disabled={deshabilitado || guardando}
          startIcon={guardando ? <CircularProgress size={18} /> : <Save />}
          onClick={() => onGuardar(haciaGrilla(borradores))}
        >
          Guardar los espacios
        </Button>
      </Box>
    </Box>
  )
}
