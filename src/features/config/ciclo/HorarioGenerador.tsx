import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormLabel from '@mui/material/FormLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { AutoFixHigh, Save } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { docentesDelAgrupamiento } from './agrupamientos'
import { agruparPorDocente } from './disponibilidad'
import { GeneradorConIntentos, type EntradaGenerador, type ReglasHorario, type ResultadoGenerador } from './generador'
import { etiquetaCurso } from './materias'
import { formDesdeReglas, mismasReglas, reglasDesdeForm, type FormReglas } from './reglasHorario'
import { useAgrupamientosCiclo } from './useAgrupamientosCiclo'
import { useCursosCiclo } from './useCursosCiclo'
import { useDisponibilidadCiclo } from './useDisponibilidadCiclo'
import { esFijo, useHorarioCiclo } from './useHorarioCiclo'
import { useMateriasCiclo } from './useMateriasCiclo'

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const
const TODOS = 'todos'

type Modo = 'completar' | 'rearmar'

interface CriteriosProps {
  soportaReglas: boolean
  form: FormReglas
  guardadas: FormReglas
  reglas: ReglasHorario
  error: string | null
  onChange: (form: FormReglas) => void
}

function CriteriosDelHorario({ soportaReglas, form, guardadas, reglas, error, onChange }: CriteriosProps) {
  const { ciclo, refresh } = useCiclo()
  const sinGuardar = !mismasReglas(form, guardadas)

  const guardar = useMutation({
    mutationFn: async () => {
      const { data, error: e } = await supabase.from('ciclos').update({ reglas_horario: reglas }).eq('id', ciclo!.id).select('id')
      if (e) throw e
      if (!data || data.length === 0) throw new Error('No se pudo guardar (sin permisos en la base)')
    },
    onSuccess: async () => {
      toast.success('Criterios guardados')
      await refresh()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const campo = (clave: keyof FormReglas, etiqueta: string, ayuda?: string) => (
    <TextField
      size="small"
      type="number"
      label={etiqueta}
      value={form[clave] as string}
      onChange={(e) => onChange({ ...form, [clave]: e.target.value })}
      disabled={!soportaReglas}
      helperText={ayuda}
      slotProps={{ htmlInput: { min: 0, max: 12, step: 1 } }}
      sx={{ width: 190 }}
    />
  )

  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <Typography variant="subtitle2" sx={titulo}>Criterios del horario</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Son las reglas con las que el sistema arma el horario. Lo que no se completa no se limita. Las superposiciones de
        docentes y los horarios fuera de su disponibilidad nunca se aceptan: no dependen de estos criterios.
      </Typography>
      {!soportaReglas && (
        <Alert severity="warning" sx={{ mb: 2 }}>Falta correr la migración 019 en Supabase para guardar los criterios.</Alert>
      )}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Turno mañana: módulos por día de cada curso</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {campo('minManana', 'Mínimo')}
            {campo('maxManana', 'Máximo')}
          </Box>
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Turno tarde: módulos por día de cada curso</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {campo('minTarde', 'Mínimo')}
            {campo('maxTarde', 'Máximo')}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        {campo('maxMateria', 'Módulos de una materia por día', 'Máximo en un mismo día')}
        <FormControlLabel
          control={<Checkbox checked={form.sinHuecos} disabled={!soportaReglas} onChange={(e) => onChange({ ...form, sinHuecos: e.target.checked })} />}
          label="Evitar módulos libres de los docentes entre sus clases"
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        El mínimo y el máximo valen para todos los cursos del turno. Los días de un curso siempre se llenan desde el primer
        módulo, sin huecos. Si una materia se dicta en bloques dobles, se indica en la materia.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Button
          variant="outlined"
          size="small"
          disabled={!soportaReglas || !sinGuardar || !!error || guardar.isPending}
          onClick={() => guardar.mutate()}
        >
          Guardar criterios
        </Button>
        {sinGuardar && <Chip size="small" color="warning" variant="outlined" label="Sin guardar: igual se usan para generar" />}
      </Box>
    </Card>
  )
}

export function HorarioGenerador() {
  const { ciclo, cicloId } = useCiclo()
  const queryClient = useQueryClient()
  const { data: cursos = [] } = useCursosCiclo()
  const { data: materiasCiclo } = useMateriasCiclo()
  const { data: horario } = useHorarioCiclo()
  const { data: disponibilidadCiclo } = useDisponibilidadCiclo()
  const { agrupamientos, nombresDeDocentes } = useAgrupamientosCiclo()

  // Los criterios de la pantalla se usan para generar aunque todavía no estén guardados
  const guardadas = useMemo(() => formDesdeReglas(ciclo?.reglas_horario), [ciclo?.reglas_horario])
  const [formReglas, setFormReglas] = useState<FormReglas>(guardadas)
  useEffect(() => setFormReglas(guardadas), [guardadas])
  const { reglas, error: errorReglas } = reglasDesdeForm(formReglas)

  const [alcance, setAlcance] = useState(TODOS)
  const [modo, setModo] = useState<Modo>('completar')
  const [corriendo, setCorriendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState<ResultadoGenerador | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const temporizador = useRef<number | null>(null)

  const detener = useCallback(() => {
    if (temporizador.current !== null) window.clearTimeout(temporizador.current)
    temporizador.current = null
  }, [])
  useEffect(() => detener, [detener])

  const cursosOrdenados = useMemo(
    () => [...cursos].sort((a, b) => etiquetaCurso(a).localeCompare(etiquetaCurso(b), 'es', { numeric: true })),
    [cursos],
  )
  const filasMaterias = useMemo(() => materiasCiclo?.filas ?? [], [materiasCiclo])
  const franjasPorDocente = useMemo(() => agruparPorDocente(disponibilidadCiclo?.filas ?? []), [disponibilidadCiclo])

  const soportaReglas = !!ciclo && 'reglas_horario' in ciclo
  const listo = !!ciclo && soportaReglas && !!materiasCiclo?.soportaGenerador && !!horario?.disponible && horario.soportaFijo

  const cursosAArmar = useMemo(
    () => (alcance === TODOS ? cursosOrdenados.map((c) => c.id) : cursosOrdenados.filter((c) => c.id === alcance).map((c) => c.id)),
    [alcance, cursosOrdenados],
  )

  function generar() {
    if (!ciclo) return
    const nombres = new Map<string, string>(nombresDeDocentes)
    for (const m of filasMaterias) if (m.personal_id && m.personal) nombres.set(m.personal_id, `${m.personal.apellido}, ${m.personal.nombre}`)
    const entrada: EntradaGenerador = {
      grilla: ciclo.grilla_modulos ?? null,
      cursos: cursosOrdenados.map((c) => ({ id: c.id, nombre: etiquetaCurso(c), turno: c.turno ?? null })),
      materias: filasMaterias.map((m) => ({
        id: m.id,
        curso_id: m.curso_id,
        nombre: m.nombre,
        horas_semanales: m.horas_semanales != null ? Number(m.horas_semanales) : null,
        personal_id: m.personal_id,
        turno: m.turno ?? null,
        bloque_doble: m.bloque_doble ?? false,
      })),
      agrupamientos: agrupamientos.map((a) => ({ id: a.id, nombre: a.nombre, materias: a.materias, docentes: docentesDelAgrupamiento(a) })),
      disponibilidad: (id) => franjasPorDocente.get(id) ?? [],
      nombreDocente: (id) => nombres.get(id) ?? 'Un docente',
      reglas,
      existente: (horario?.filas ?? []).map((f) => ({ curso_id: f.curso_id, materia_id: f.materia_id, dia: f.dia, turno: f.turno, modulo: f.modulo, fijo: esFijo(f) })),
      cursosAArmar,
      modo,
    }
    detener()
    const generador = new GeneradorConIntentos(entrada, { semilla: Math.floor(Math.random() * 2 ** 31) })
    setResultado(null)
    setProgreso(generador.progreso)
    setCorriendo(true)
    // Se trabaja de a ratos para que la pantalla no se congele y se pueda cancelar
    const paso = () => {
      const terminado = generador.avanzar(40)
      setProgreso(generador.progreso)
      if (terminado) {
        temporizador.current = null
        setResultado(generador.resultado())
        setCorriendo(false)
      } else temporizador.current = window.setTimeout(paso, 0)
    }
    temporizador.current = window.setTimeout(paso, 0)
  }

  function cancelar() {
    detener()
    setCorriendo(false)
  }

  // Lo que se reemplaza al guardar: en "rearmar", los módulos no fijos que ya estaban cargados
  const reemplazados = useMemo(() => {
    if (!resultado || modo !== 'rearmar') return 0
    const armados = new Set(resultado.cursosArmados)
    return (horario?.filas ?? []).filter((f) => armados.has(f.curso_id) && !esFijo(f)).length
  }, [resultado, modo, horario])

  const nuevos = useMemo(() => {
    if (!resultado) return 0
    const antes = new Set((horario?.filas ?? []).map((f) => `${f.curso_id}|${f.turno}|${f.dia}|${f.modulo}|${f.materia_id}`))
    return resultado.asignaciones.filter((a) => !antes.has(`${a.curso_id}|${a.turno}|${a.dia}|${a.modulo}|${a.materia_id}`)).length
  }, [resultado, horario])

  const guardar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('guardar_horario_cursos', { p_cursos: resultado!.cursosArmados, p_filas: resultado!.asignaciones })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Horario guardado. Revisalo en "Horario por curso".')
      setResultado(null)
      setConfirmando(false)
      await queryClient.invalidateQueries({ queryKey: ['horario', cicloId] })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function pedirGuardado() {
    if (reemplazados > 0) setConfirmando(true)
    else guardar.mutate()
  }

  if (!ciclo) return <Alert severity="warning">Primero creá un ciclo lectivo en la pestaña General.</Alert>

  const errores = resultado?.problemas.filter((p) => p.gravedad === 'error') ?? []
  const avisos = resultado?.problemas.filter((p) => p.gravedad === 'aviso') ?? []
  const hayHorario = (resultado?.asignaciones.length ?? 0) > 0

  return (
    <>
      {!listo && materiasCiclo && horario && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {!horario.disponible
            ? 'Falta correr la migración 016 en Supabase para guardar el horario de los cursos.'
            : 'Falta correr la migración 019 en Supabase para usar el generador de horarios.'}
        </Alert>
      )}

      <CriteriosDelHorario
        soportaReglas={soportaReglas}
        form={formReglas}
        guardadas={guardadas}
        reglas={reglas}
        error={errorReglas}
        onChange={setFormReglas}
      />

      <Card sx={{ p: 3 }}>
        <Typography variant="subtitle2" sx={titulo}>Generar el horario</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          El sistema ubica las materias de los cursos según los espacios de cada turno, la disponibilidad de los docentes y
          los criterios de arriba. Si con lo cargado no se puede armar, te explica por qué. Si se puede, el horario queda
          editable en "Horario por curso".
        </Typography>

        <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 2 }}>
          <TextField select size="small" label="Cursos" value={alcance} onChange={(e) => setAlcance(e.target.value)} disabled={corriendo} sx={{ minWidth: 260 }}>
            <MenuItem value={TODOS}>Todos los cursos</MenuItem>
            {cursosOrdenados.map((c) => (
              <MenuItem key={c.id} value={c.id}>{etiquetaCurso(c)}</MenuItem>
            ))}
          </TextField>
          <FormControl disabled={corriendo}>
            <FormLabel sx={{ fontSize: 13 }}>Qué hacer con lo que ya está cargado</FormLabel>
            <RadioGroup value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
              <FormControlLabel value="completar" control={<Radio size="small" />} label="Completar: respetar todo lo cargado y armar lo que falta" />
              <FormControlLabel value="rearmar" control={<Radio size="small" />} label="Rearmar: respetar solo los módulos fijos (con candado) y volver a armar el resto" />
            </RadioGroup>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={corriendo ? <CircularProgress size={18} color="inherit" /> : <AutoFixHigh />}
            disabled={!listo || corriendo || cursosAArmar.length === 0 || !!errorReglas}
            onClick={generar}
          >
            {resultado ? 'Generar de nuevo' : 'Generar horario'}
          </Button>
          {corriendo && <Button onClick={cancelar}>Cancelar</Button>}
        </Box>
        {corriendo && <LinearProgress variant="determinate" value={progreso * 100} sx={{ mt: 2 }} />}

        {resultado && !corriendo && (
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {resultado.exito ? (
              <Alert severity="success">
                {hayHorario
                  ? `Se armó el horario de ${resultado.cursosArmados.length} ${resultado.cursosArmados.length === 1 ? 'curso' : 'cursos'}: ${nuevos} ${nuevos === 1 ? 'módulo nuevo' : 'módulos nuevos'}, sin superposiciones ni horarios fuera de la disponibilidad de los docentes.`
                  : 'No hay nada para armar: los cursos no tienen materias con horas.'}
              </Alert>
            ) : hayHorario ? (
              <Alert severity="warning">
                No se pudo armar un horario sin problemas. Este es el mejor que se encontró; podés guardarlo y corregir a
                mano lo que se señala, o probar de nuevo.
              </Alert>
            ) : (
              <Alert severity="error">
                No se puede armar el horario con lo que está cargado. Corregí lo siguiente y volvé a probar.
              </Alert>
            )}

            {errores.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {errores.map((p, i) => (
                  <Alert key={i} severity="error" sx={{ py: 0 }}>{p.mensaje}</Alert>
                ))}
              </Box>
            )}
            {avisos.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  A tener en cuenta ({avisos.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 260, overflowY: 'auto' }}>
                  {avisos.map((p, i) => (
                    <Alert key={i} severity="warning" sx={{ py: 0 }}>{p.mensaje}</Alert>
                  ))}
                </Box>
              </Box>
            )}

            {hayHorario && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  color={resultado.exito ? 'primary' : 'warning'}
                  startIcon={guardar.isPending ? <CircularProgress size={18} color="inherit" /> : <Save />}
                  disabled={guardar.isPending}
                  onClick={pedirGuardado}
                >
                  {resultado.exito ? 'Guardar este horario' : 'Guardarlo igual'}
                </Button>
                <Button onClick={() => setResultado(null)}>Descartar</Button>
              </Box>
            )}
          </Box>
        )}
      </Card>

      <Dialog open={confirmando} onClose={() => setConfirmando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Se reemplaza parte del horario</DialogTitle>
        <DialogContent>
          <Typography>
            Al guardar se reemplazan {reemplazados} {reemplazados === 1 ? 'módulo que no está fijo' : 'módulos que no están fijos'} de
            los cursos armados. Los módulos fijos se conservan.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
          <Button variant="contained" color="warning" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
            Reemplazar y guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
