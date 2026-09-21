import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Save } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { DIAS_SEMANA, modulosDelDia, turnosDelCurso, type GrillaModulos, type Turno } from './grilla'
import {
  celdasDelCurso,
  claveCelda,
  desdeClave,
  validarHorarioCurso,
  type ColocacionConDocente,
  type MateriaParaHorario,
} from './horario'
import { etiquetaCurso } from './materias'
import { useCursosCiclo, type CursoCiclo } from './useCursosCiclo'
import { useHorarioCiclo } from './useHorarioCiclo'
import { useMateriasCiclo } from './useMateriasCiclo'

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const
const NOMBRE_TURNO: Record<Turno, string> = { manana: 'Mañana', tarde: 'Tarde' }

/** Un color suave y distinto para cada materia del curso. */
const colorDeMateria = (indice: number) => `hsl(${(indice * 47) % 360}, 65%, 90%)`

const mismoContenido = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}

interface EditorProps {
  curso: CursoCiclo
  grilla: GrillaModulos | null
  materias: MateriaParaHorario[]
  guardadas: Record<string, string>
  otras: (ColocacionConDocente & { curso_nombre: string })[]
  nombreDocente: (personalId: string) => string
  onCambioSinGuardar: (sinGuardar: boolean) => void
  onGuardado: () => void
}

function EditorDeCurso({ curso, grilla, materias, guardadas, otras, nombreDocente, onCambioSinGuardar, onGuardado }: EditorProps) {
  const { cicloId } = useCiclo()
  const queryClient = useQueryClient()
  const [borrador, setBorrador] = useState<Record<string, string>>(guardadas)
  // La materia con la que se pinta: '' es la goma. Empieza con la primera materia del curso.
  const [pincel, setPincel] = useState<string>(materias[0]?.id ?? '')

  const sinGuardar = !mismoContenido(borrador, guardadas)
  useEffect(() => onCambioSinGuardar(sinGuardar), [sinGuardar, onCambioSinGuardar])

  const materiaPorId = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias])
  const indiceDeMateria = useMemo(() => new Map(materias.map((m, i) => [m.id, i])), [materias])
  const validacion = useMemo(
    () => validarHorarioCurso({ turnoCurso: curso.turno, grilla, borrador, materias, otras, nombreDocente }),
    [curso.turno, grilla, borrador, materias, otras, nombreDocente],
  )
  const resumenPorMateria = useMemo(() => new Map(validacion.materias.map((r) => [r.materia_id, r])), [validacion])
  const importantes = validacion.problemas.filter((p) => p.gravedad !== 'pendiente')
  const materiasPendientes = validacion.materias.filter((r) => r.estado === 'faltan').length

  function pintar(clave: string) {
    setBorrador((actual) => {
      const nuevo = { ...actual }
      if (pincel === '' || nuevo[clave] === pincel) delete nuevo[clave]
      else nuevo[clave] = pincel
      return nuevo
    })
  }

  const guardarMutation = useMutation({
    mutationFn: async () => {
      const existentes = new Set(celdasDelCurso(curso.turno, grilla).map((c) => claveCelda(c.turno, c.dia, c.modulo)))
      const filas = Object.entries(borrador)
        .filter(([clave, materiaId]) => existentes.has(clave) && materiaPorId.has(materiaId))
        .map(([clave, materia_id]) => ({ materia_id, ...desdeClave(clave) }))
      const { error } = await supabase.rpc('guardar_horario_curso', { p_curso: curso.id, p_filas: filas })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Horario guardado')
      await queryClient.invalidateQueries({ queryKey: ['horario', cicloId] })
      onGuardado()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  return (
    <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Card sx={{ p: 2, width: { xs: '100%', md: 260 }, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={titulo}>Materias</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Elegí una materia y hacé clic en los módulos donde se dicta. Un clic en un módulo con la misma materia lo libera.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {materias.map((m, i) => {
            const r = resumenPorMateria.get(m.id)
            const seleccionada = pincel === m.id
            return (
              <ButtonBase
                key={m.id}
                onClick={() => setPincel(m.id)}
                aria-pressed={seleccionada}
                sx={{
                  display: 'block',
                  textAlign: 'left',
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: colorDeMateria(i),
                  border: '2px solid',
                  borderColor: seleccionada ? 'primary.main' : 'transparent',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.nombre}</Typography>
                  {r && r.requeridas != null ? (
                    <Chip
                      size="small"
                      label={`${r.colocadas}/${r.requeridas}`}
                      color={r.estado === 'completa' ? 'success' : r.estado === 'sobran' ? 'error' : 'default'}
                      variant={r.estado === 'faltan' ? 'outlined' : 'filled'}
                    />
                  ) : (
                    <Chip size="small" variant="outlined" label={`${r?.colocadas ?? 0}`} />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {m.personal_id ? nombreDocente(m.personal_id) : 'Sin docente'}
                </Typography>
              </ButtonBase>
            )
          })}
          <ButtonBase
            onClick={() => setPincel('')}
            aria-pressed={pincel === ''}
            sx={{ p: 1, borderRadius: 1.5, border: '2px dashed', borderColor: pincel === '' ? 'primary.main' : 'divider', justifyContent: 'flex-start' }}
          >
            <Typography variant="body2">Borrar módulos</Typography>
          </ButtonBase>
        </Box>
      </Card>

      <Box sx={{ flex: 1, minWidth: 320 }}>
        {turnosDelCurso(curso.turno).map((turno) => {
          const maxModulos = Math.max(0, ...DIAS_SEMANA.map((d) => modulosDelDia(grilla, turno, d.n).length))
          return (
            <Card key={turno} sx={{ p: 2, mb: 2, overflowX: 'auto' }}>
              <Typography variant="subtitle2" sx={titulo}>Turno {NOMBRE_TURNO[turno].toLowerCase()}</Typography>
              <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 34, px: 0.5 }} />
                    {DIAS_SEMANA.map((d) => (
                      <TableCell key={d.n} align="center" sx={{ px: 0.5 }}>{d.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({ length: maxModulos }, (_, i) => i + 1).map((modulo) => (
                    <TableRow key={modulo}>
                      <TableCell sx={{ px: 0.5, color: 'text.secondary' }}>{modulo}°</TableCell>
                      {DIAS_SEMANA.map((d) => {
                        const modulos = modulosDelDia(grilla, turno, d.n)
                        if (modulo > modulos.length) return <TableCell key={d.n} sx={{ bgcolor: 'action.hover', p: 0.5 }} />
                        const clave = claveCelda(turno, d.n, modulo)
                        const materiaId = borrador[clave]
                        const materia = materiaId ? materiaPorId.get(materiaId) : undefined
                        const problemas = validacion.porCelda[clave] ?? []
                        const hayError = problemas.some((p) => p.gravedad === 'error')
                        const hayAviso = problemas.some((p) => p.gravedad === 'aviso')
                        return (
                          <TableCell key={d.n} sx={{ p: 0.5 }}>
                            <Tooltip
                              title={problemas.length > 0 ? <span style={{ whiteSpace: 'pre-line' }}>{problemas.map((p) => p.mensaje).join('\n')}</span> : ''}
                              placement="top"
                            >
                              <ButtonBase
                                onClick={() => pintar(clave)}
                                aria-label={`${d.label}, módulo ${modulo}${materia ? `: ${materia.nombre}` : ': libre'}`}
                                sx={{
                                  width: '100%',
                                  minHeight: 52,
                                  borderRadius: 1,
                                  flexDirection: 'column',
                                  justifyContent: 'center',
                                  bgcolor: materia ? colorDeMateria(indiceDeMateria.get(materia.id) ?? 0) : 'transparent',
                                  border: '2px solid',
                                  borderColor: hayError ? 'error.main' : hayAviso ? 'warning.main' : materia ? 'transparent' : 'divider',
                                  borderStyle: materia ? 'solid' : 'dashed',
                                  px: 0.5,
                                }}
                              >
                                <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, wordBreak: 'break-word' }}>
                                  {materia?.nombre ?? ''}
                                </Typography>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                                  {modulos[modulo - 1].inicio}–{modulos[modulo - 1].fin}
                                </Typography>
                              </ButtonBase>
                            </Tooltip>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        })}

        <Card sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={titulo}>Controles</Typography>
          {importantes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No hay superposiciones, horas de más ni huecos.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {importantes.map((p, i) => (
                <Alert key={`${p.tipo}-${i}`} severity={p.gravedad === 'error' ? 'error' : 'warning'} sx={{ py: 0 }}>
                  {p.mensaje}
                </Alert>
              ))}
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {validacion.sinCompletar === 0 ? 'Todos los módulos tienen materia' : `Módulos sin materia: ${validacion.sinCompletar}`}
            {materiasPendientes > 0 ? ` · Materias con horas pendientes: ${materiasPendientes}` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            <Button
              variant="contained"
              startIcon={guardarMutation.isPending ? <CircularProgress size={18} /> : <Save />}
              disabled={!sinGuardar || guardarMutation.isPending}
              onClick={() => guardarMutation.mutate()}
            >
              Guardar el horario
            </Button>
            <Button disabled={!sinGuardar} onClick={() => setBorrador(guardadas)}>Descartar los cambios</Button>
            <Button color="error" disabled={Object.keys(borrador).length === 0} onClick={() => setBorrador({})}>Vaciar el horario</Button>
            {sinGuardar && <Chip size="small" color="warning" variant="outlined" label="Cambios sin guardar" />}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Se puede guardar con avisos: los controles no bloquean, solo señalan lo que conviene revisar.
          </Typography>
        </Card>
      </Box>
    </Box>
  )
}

export function HorarioCursoEditor() {
  const { ciclo } = useCiclo()
  const { data: cursos = [] } = useCursosCiclo()
  const { data: materiasCiclo } = useMateriasCiclo()
  const { data: horario } = useHorarioCiclo()
  const grilla = ciclo?.grilla_modulos ?? null

  const [cursoId, setCursoId] = useState('')
  const [cursoPendiente, setCursoPendiente] = useState<string | null>(null)
  const [sinGuardar, setSinGuardar] = useState(false)
  const [version, setVersion] = useState(0)

  const cursosOrdenados = useMemo(
    () => [...cursos].sort((a, b) => etiquetaCurso(a).localeCompare(etiquetaCurso(b), 'es', { numeric: true })),
    [cursos],
  )
  const curso = cursosOrdenados.find((c) => c.id === cursoId) ?? cursosOrdenados[0]

  const filasMaterias = useMemo(() => materiasCiclo?.filas ?? [], [materiasCiclo])
  const materiasDelCurso: MateriaParaHorario[] = useMemo(
    () =>
      filasMaterias
        .filter((m) => m.curso_id === curso?.id)
        .map((m) => ({ id: m.id, curso_id: m.curso_id, nombre: m.nombre, horas_semanales: m.horas_semanales ?? null, personal_id: m.personal_id })),
    [filasMaterias, curso?.id],
  )

  const nombreDocente = useMemo(() => {
    const nombres = new Map<string, string>()
    for (const m of filasMaterias) if (m.personal_id && m.personal) nombres.set(m.personal_id, `${m.personal.apellido}, ${m.personal.nombre}`)
    return (id: string) => nombres.get(id) ?? 'Un docente'
  }, [filasMaterias])

  const guardadas = useMemo(() => {
    const mapa: Record<string, string> = {}
    for (const f of horario?.filas ?? []) if (f.curso_id === curso?.id) mapa[claveCelda(f.turno, f.dia, f.modulo)] = f.materia_id
    return mapa
  }, [horario, curso?.id])

  const otras = useMemo(() => {
    const materiaPorId = new Map(filasMaterias.map((m) => [m.id, m]))
    const cursoPorId = new Map(cursos.map((c) => [c.id, c]))
    const lista: (ColocacionConDocente & { curso_nombre: string })[] = []
    for (const f of horario?.filas ?? []) {
      if (f.curso_id === curso?.id) continue
      const materia = materiaPorId.get(f.materia_id)
      const otro = cursoPorId.get(f.curso_id)
      if (!materia || !otro) continue
      lista.push({ ...f, personal_id: materia.personal_id, curso_nombre: etiquetaCurso(otro) })
    }
    return lista
  }, [horario, filasMaterias, cursos, curso?.id])

  function elegirCurso(id: string) {
    if (id === curso?.id) return
    if (sinGuardar) setCursoPendiente(id)
    else setCursoId(id)
  }

  if (!ciclo) return <Alert severity="warning">Primero creá un ciclo lectivo en la pestaña General.</Alert>
  if (horario && !horario.disponible) {
    return <Alert severity="warning">Falta correr la migración 016 en Supabase para guardar el horario de los cursos.</Alert>
  }
  if (cursosOrdenados.length === 0) return <Alert severity="info">Todavía no hay cursos. Cargalos en la pestaña Cursos.</Alert>

  const celdas = celdasDelCurso(curso.turno, grilla)

  return (
    <>
      <TextField
        select
        size="small"
        label="Curso"
        value={curso.id}
        onChange={(e) => elegirCurso(e.target.value)}
        sx={{ minWidth: 260, mb: 2 }}
      >
        {cursosOrdenados.map((c) => (
          <MenuItem key={c.id} value={c.id}>{etiquetaCurso(c)}</MenuItem>
        ))}
      </TextField>

      {!curso.turno ? (
        <Alert severity="info">Definí el turno de este curso en la pestaña "Módulos y cursos" para poder armar su horario.</Alert>
      ) : celdas.length === 0 ? (
        <Alert severity="info">Cargá los módulos del turno de este curso en la pestaña "Módulos y cursos".</Alert>
      ) : materiasDelCurso.length === 0 ? (
        <Alert severity="info">Este curso todavía no tiene materias. Cargalas en la pestaña Materias.</Alert>
      ) : (
        <EditorDeCurso
          key={`${curso.id}:${version}`}
          curso={curso}
          grilla={grilla}
          materias={materiasDelCurso}
          guardadas={guardadas}
          otras={otras}
          nombreDocente={nombreDocente}
          onCambioSinGuardar={setSinGuardar}
          onGuardado={() => setVersion((v) => v + 1)}
        />
      )}

      <Dialog open={!!cursoPendiente} onClose={() => setCursoPendiente(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Hay cambios sin guardar</DialogTitle>
        <DialogContent>
          <Typography>Si cambiás de curso, se pierden los cambios que hiciste en el horario de {etiquetaCurso(curso)}.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCursoPendiente(null)}>Seguir editando</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setSinGuardar(false)
              setCursoId(cursoPendiente!)
              setCursoPendiente(null)
            }}
          >
            Descartar y cambiar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
