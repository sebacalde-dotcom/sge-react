import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import { Save } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { diaInfo, toISODate, TIPOS_DIA_ESPECIAL, type DiaEspecial, type TipoDiaEspecial } from '@/lib/calendario'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DIAS_HEADER = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

export function CicloCalendarioTab() {
  const { ciclo, refresh } = useCiclo()
  const [especiales, setEspeciales] = useState<Record<string, DiaEspecial>>({})
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState<{ fecha: string; weekend: boolean } | null>(null)
  const [tipo, setTipo] = useState<TipoDiaEspecial>('feriado')
  const [descripcion, setDescripcion] = useState('')

  useEffect(() => {
    setEspeciales(ciclo?.dias_especiales ?? {})
    setDirty(false)
  }, [ciclo])

  const cfg = useMemo(
    () => (ciclo ? { inicio: ciclo.inicio, fin: ciclo.fin, dias_especiales: especiales } : null),
    [ciclo, especiales],
  )

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ciclos').update({ dias_especiales: especiales }).eq('id', ciclo!.id)
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Calendario guardado')
      await refresh()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (!ciclo) {
    return <Alert severity="info">Primero creá el ciclo lectivo en la pestaña General.</Alert>
  }

  const anio = ciclo.anio
  const sortedEspeciales = Object.entries(especiales).sort(([a], [b]) => a.localeCompare(b))

  function openDay(fecha: string, weekend: boolean) {
    const current = especiales[fecha]
    setEditing({ fecha, weekend })
    setTipo(current?.tipo ?? (weekend ? 'cursable' : 'feriado'))
    setDescripcion(current?.descripcion ?? '')
  }

  function applyDay() {
    if (!editing) return
    setEspeciales((prev) => ({ ...prev, [editing.fecha]: { tipo, descripcion: descripcion.trim() } }))
    setDirty(true)
    setEditing(null)
  }

  function removeDay(fecha: string) {
    setEspeciales((prev) => {
      const next = { ...prev }
      delete next[fecha]
      return next
    })
    setDirty(true)
    setEditing(null)
  }

  const tiposDisponibles = TIPOS_DIA_ESPECIAL.filter((t) => (editing?.weekend ? t.value === 'cursable' : t.value !== 'cursable'))

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        De lunes a viernes son días cursables. Hacé click en un día para marcarlo como feriado, asueto o sin clases,
        o en un fin de semana para habilitarlo como día cursable. Los días fuera de las fechas de inicio y fin del
        ciclo no se pueden cargar.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        {TIPOS_DIA_ESPECIAL.map((t) => (
          <Chip key={t.value} size="small" label={t.label} sx={{ bgcolor: t.bg, color: t.fg, fontWeight: 600 }} />
        ))}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          startIcon={saveMutation.isPending ? <CircularProgress size={18} /> : <Save />}
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Guardar calendario
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 2, mb: 3 }}>
        {MESES.map((nombre, mIdx) => {
          const month = mIdx + 1
          const diasEnMes = new Date(anio, month, 0).getDate()
          const offset = (new Date(anio, mIdx, 1).getDay() + 6) % 7
          return (
            <Card key={nombre} variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>{nombre}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {DIAS_HEADER.map((h, i) => (
                  <Typography key={i} sx={{ textAlign: 'center', fontSize: 10, color: 'text.disabled' }}>{h}</Typography>
                ))}
                {Array.from({ length: offset }, (_, i) => <Box key={`e${i}`} />)}
                {Array.from({ length: diasEnMes }, (_, i) => {
                  const day = i + 1
                  const fecha = toISODate(anio, month, day)
                  const info = diaInfo(cfg, anio, month, day)
                  const dow = new Date(anio, mIdx, day).getDay()
                  const weekend = dow === 0 || dow === 6
                  const fueraDeCiclo = info.motivo === 'Fuera del ciclo lectivo'
                  const style = info.especial ? TIPOS_DIA_ESPECIAL.find((t) => t.value === info.especial!.tipo) : null
                  return (
                    <Box
                      key={day}
                      role="button"
                      tabIndex={fueraDeCiclo ? -1 : 0}
                      title={info.motivo ?? undefined}
                      onClick={() => !fueraDeCiclo && openDay(fecha, weekend)}
                      onKeyDown={(e) => {
                        if (!fueraDeCiclo && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          openDay(fecha, weekend)
                        }
                      }}
                      sx={{
                        height: 26,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: info.especial ? 700 : 500,
                        borderRadius: 0.5,
                        cursor: fueraDeCiclo ? 'default' : 'pointer',
                        userSelect: 'none',
                        bgcolor: style?.bg ?? (info.cursable ? 'transparent' : 'action.hover'),
                        color: style?.fg ?? (info.cursable ? 'text.primary' : 'text.disabled'),
                        opacity: fueraDeCiclo ? 0.3 : 1,
                        '&:hover': fueraDeCiclo ? {} : { outline: '1px solid', outlineColor: 'primary.main' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                      }}
                    >
                      {day}
                    </Box>
                  )
                })}
              </Box>
            </Card>
          )
        })}
      </Box>

      {sortedEspeciales.length > 0 && (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>
            Días especiales cargados
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {sortedEspeciales.map(([fecha, d]) => {
              const t = TIPOS_DIA_ESPECIAL.find((x) => x.value === d.tipo)
              return (
                <Box key={fecha} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 13 }}>
                  <Box sx={{ width: 84, fontVariantNumeric: 'tabular-nums' }}>{formatFecha(fecha)}</Box>
                  <Chip size="small" label={t?.label ?? d.tipo} sx={{ bgcolor: t?.bg, color: t?.fg, fontWeight: 600, minWidth: 90 }} />
                  <Box sx={{ color: 'text.secondary' }}>{d.descripcion}</Box>
                </Box>
              )
            })}
          </Box>
        </Card>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? formatFecha(editing.fecha) : ''}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField select label="Tipo de día" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDiaEspecial)}>
            {tiposDisponibles.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Día de la Independencia"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {editing && especiales[editing.fecha] && (
            <Button color="error" onClick={() => removeDay(editing.fecha)} sx={{ mr: 'auto' }}>
              Quitar
            </Button>
          )}
          <Button onClick={() => setEditing(null)}>Cancelar</Button>
          <Button variant="contained" onClick={applyDay}>Aplicar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
