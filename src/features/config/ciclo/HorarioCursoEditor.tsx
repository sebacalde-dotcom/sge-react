import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Lock, LockOpen, Save } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { DIAS_SEMANA, diasConClase, modulosDelDia, turnosDelCurso, type GrillaModulos, type Turno } from './grilla'
import {
  celdasDelCurso,
  claveCelda,
  desdeClave,
  validarHorarioCurso,
  type ColocacionConDocente,
  type MateriaParaHorario,
} from './horario'
import { etiquetaCurso } from './materias'
import { agrupamientosSinCoincidir, docentesDeMateria, unidadDeMateria, type Agrupamiento } from './agrupamientos'
import { agruparPorDocente, type Franja } from './disponibilidad'
import { useAgrupamientosCiclo } from './useAgrupamientosCiclo'
import { useCursosCiclo, type CursoCiclo } from './useCursosCiclo'
import { useDisponibilidadCiclo } from './useDisponibilidadCiclo'
import { esFijo, useHorarioCiclo } from './useHorarioCiclo'
import { useMateriasCiclo } from './useMateriasCiclo'

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const
const NOMBRE_TURNO: Record<Turno, string> = { manana: 'Mañana', tarde: 'Tarde' }

/** Un color suave y distinto para cada materia del curso. */
const colorDeMateria = (indice: number) => `hsl(${(indice * 47) % 360}, 65%, 90%)`

/** Lo cargado en cada módulo (por clave), y si es fijo: lo puso a mano quien arma el horario y el generador lo respeta. */
type Borrador = Record<string, { materia_id: string; fijo: boolean }>

/** Con este "pincel" un clic en un módulo lo fija o lo suelta. */
const CANDADO = '__candado__'

const mismoContenido = (a: Borrador, b: Borrador) => {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k]?.materia_id === b[k]?.materia_id && a[k]?.fijo === b[k]?.fijo)
}

interface EditorProps {
  curso: CursoCiclo
  grilla: GrillaModulos | null
  materias: MateriaParaHorario[]
  guardadas: Borrador
  soportaFijo: boolean
  /** Los agrupamientos que tienen alguna materia de este curso: se dictan a la vez en todos sus cursos. */
  agrupamientos: Agrupamiento[]
  /** Cómo se llama, en una lista, la materia de un agrupamiento en cada curso. */
  etiquetaMateria: (materiaId: string) => string
  otras: (ColocacionConDocente & { curso_nombre: string })[]
  nombreDocente: (personalId: string) => string
  disponibilidad: (personalId: string) => Franja[]
  onCambioSinGuardar: (sinGuardar: boolean) => void
  onGuardado: () => void
}

function EditorDeCurso({ curso, grilla, materias, guardadas, soportaFijo, agrupamientos, etiquetaMateria, otras, nombreDocente, disponibilidad, onCambioSinGuardar, onGuardado }: EditorProps) {
  const { cicloId } = useCiclo()
  const queryClient = useQueryClient()
  const [borrador, setBorrador] = useState<Borrador>(guardadas)
  // La materia con la que se pinta: '' es la goma y CANDADO fija o suelta módulos. Empieza con la primera materia del curso.
  const [pincel, setPincel] = useState<string>(materias[0]?.id ?? '')

  const sinGuardar = !mismoContenido(borrador, guardadas)
  useEffect(() => onCambioSinGuardar(sinGuardar), [sinGuardar, onCambioSinGuardar])

  const materiaPorId = useMemo(() => new Map(materias.map((m) => [m.id, m])), [materias])
  const indiceDeMateria = useMemo(() => new Map(materias.map((m, i) => [m.id, i])), [materias])
  const materiaPorClave = useMemo(() => Object.fromEntries(Object.entries(borrador).map(([clave, c]) => [clave, c.materia_id])), [borrador])
  const validacion = useMemo(
    () => validarHorarioCurso({ turnoCurso: curso.turno, grilla, borrador: materiaPorClave, materias, otras, nombreDocente, disponibilidad }),
    [curso.turno, grilla, materiaPorClave, materias, otras, nombreDocente, disponibilidad],
  )
  const cantidadFijos = Object.values(borrador).filter((c) => c.fijo).length
  const sinCoincidir = useMemo(
    () =>
      agrupamientosSinCoincidir(
        agrupamientos,
        [...otras, ...Object.entries(borrador).map(([clave, c]) => ({ materia_id: c.materia_id, ...desdeClave(clave) }))],
        etiquetaMateria,
      ),
    [agrupamientos, otras, borrador, etiquetaMateria],
  )
  const resumenPorMateria = useMemo(() => new Map(validacion.materias.map((r) => [r.materia_id, r])), [validacion])
  const importantes = validacion.problemas.filter((p) => p.gravedad !== 'pendiente')
  const diasVisibles = DIAS_SEMANA.filter((d) => diasConClase(grilla, turnosDelCurso(curso.turno)).includes(d.n))
  const materiasPendientes = validacion.materias.filter((r) => r.estado === 'faltan').length

  function pintar(clave: string) {
    setBorrador((actual) => {
      const nuevo = { ...actual }
      if (pincel === CANDADO) {
        if (nuevo[clave]) nuevo[clave] = { ...nuevo[clave], fijo: !nuevo[clave].fijo }
      } else if (pincel === '' || nuevo[clave]?.materia_id === pincel) delete nuevo[clave]
      // Lo que se pone a mano es fijo: el generador lo respeta
      else nuevo[clave] = { materia_id: pincel, fijo: true }
      return nuevo
    })
  }

  const soltarTodos = () => setBorrador((actual) => Object.fromEntries(Object.entries(actual).map(([clave, c]) => [clave, { ...c, fijo: false }])))

  const guardarMutation = useMutation({
    mutationFn: async () => {
      const existentes = new Set(celdasDelCurso(curso.turno, grilla).map((c) => claveCelda(c.turno, c.dia, c.modulo)))
      const filas = Object.entries(borrador)
        .filter(([clave, c]) => existentes.has(clave) && materiaPorId.has(c.materia_id))
        .map(([clave, c]) => ({ materia_id: c.materia_id, fijo: c.fijo, ...desdeClave(clave) }))
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
          {soportaFijo && ' Lo que ponés a mano queda fijo (candado): al generar el horario, el sistema lo respeta y arma el resto.'}
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
                  {m.docentes.length > 0 ? m.docentes.map(nombreDocente).join(' · ') : 'Sin docente'}
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
          {soportaFijo && (
            <ButtonBase
              onClick={() => setPincel(CANDADO)}
              aria-pressed={pincel === CANDADO}
              sx={{ p: 1, borderRadius: 1.5, border: '2px dashed', borderColor: pincel === CANDADO ? 'primary.main' : 'divider', justifyContent: 'flex-start', gap: 1 }}
            >
              <Lock fontSize="small" />
              <Typography variant="body2">Fijar o soltar módulos</Typography>
            </ButtonBase>
          )}
        </Box>
      </Card>

      <Box sx={{ flex: 1, minWidth: 320 }}>
        {turnosDelCurso(curso.turno).map((turno) => {
          const maxModulos = Math.max(0, ...diasVisibles.map((d) => modulosDelDia(grilla, turno, d.n).length))
          return (
            <Card key={turno} sx={{ p: 2, mb: 2, overflowX: 'auto' }}>
              <Typography variant="subtitle2" sx={titulo}>Turno {NOMBRE_TURNO[turno].toLowerCase()}</Typography>
              <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 34, px: 0.5 }} />
                    {diasVisibles.map((d) => (
                      <TableCell key={d.n} align="center" sx={{ px: 0.5 }}>{d.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({ length: maxModulos }, (_, i) => i + 1).map((modulo) => (
                    <TableRow key={modulo}>
                      <TableCell sx={{ px: 0.5, color: 'text.secondary' }}>{modulo}°</TableCell>
                      {diasVisibles.map((d) => {
                        const modulos = modulosDelDia(grilla, turno, d.n)
                        if (modulo > modulos.length) return <TableCell key={d.n} sx={{ bgcolor: 'action.hover', p: 0.5 }} />
                        const clave = claveCelda(turno, d.n, modulo)
                        const materiaId = borrador[clave]?.materia_id
                        const fijo = !!borrador[clave]?.fijo
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
                                aria-label={`${d.label}, módulo ${modulo}${materia ? `: ${materia.nombre}${soportaFijo ? (fijo ? ' (fijo)' : ' (no fijo)') : ''}` : ': libre'}`}
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
                                  position: 'relative',
                                }}
                              >
                                {soportaFijo && materia && (
                                  fijo ? (
                                    <Lock sx={{ position: 'absolute', top: 2, right: 2, fontSize: 12, color: 'text.secondary' }} />
                                  ) : (
                                    <LockOpen sx={{ position: 'absolute', top: 2, right: 2, fontSize: 12, color: 'text.disabled' }} />
                                  )
                                )}
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
          {sinCoincidir.map((p) => (
            <Alert key={p.agrupamiento_id} severity="info" sx={{ py: 0, mb: 1 }}>{p.mensaje}</Alert>
          ))}
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
            {validacion.sinCompletar === 0 ? 'Todos los espacios tienen materia' : `Espacios sin usar: ${validacion.sinCompletar}`}
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
            {soportaFijo && <Button disabled={cantidadFijos === 0} onClick={soltarTodos}>Soltar todos los fijos</Button>}
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
  const { data: disponibilidadCiclo } = useDisponibilidadCiclo()
  const { agrupamientos, porMateria, nombresDeDocentes } = useAgrupamientosCiclo()
  const grilla = ciclo?.grilla_modulos ?? null

  const franjasPorDocente = useMemo(() => agruparPorDocente(disponibilidadCiclo?.filas ?? []), [disponibilidadCiclo])
  const disponibilidadDe = useCallback((personalId: string) => franjasPorDocente.get(personalId) ?? [], [franjasPorDocente])

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
        .map((m) => ({
          id: m.id,
          curso_id: m.curso_id,
          nombre: m.nombre,
          horas_semanales: m.horas_semanales ?? null,
          docentes: docentesDeMateria(m, porMateria),
          unidad: unidadDeMateria(m, porMateria),
        })),
    [filasMaterias, curso?.id, porMateria],
  )

  // Los agrupamientos de este curso, y cómo llamar a la materia de cada curso en un mensaje
  const agrupamientosDelCurso = useMemo(
    () => agrupamientos.filter((a) => a.materias.some((id) => materiasDelCurso.some((m) => m.id === id))),
    [agrupamientos, materiasDelCurso],
  )
  const etiquetaMateria = useCallback(
    (materiaId: string) => {
      const materia = filasMaterias.find((m) => m.id === materiaId)
      const delCurso = cursos.find((c) => c.id === materia?.curso_id)
      return delCurso ? etiquetaCurso(delCurso) : 'otro curso'
    },
    [filasMaterias, cursos],
  )

  const nombreDocente = useMemo(() => {
    const nombres = new Map<string, string>()
    for (const [id, nombre] of nombresDeDocentes) nombres.set(id, nombre)
    for (const m of filasMaterias) if (m.personal_id && m.personal) nombres.set(m.personal_id, `${m.personal.apellido}, ${m.personal.nombre}`)
    return (id: string) => nombres.get(id) ?? 'Un docente'
  }, [filasMaterias, nombresDeDocentes])

  const guardadas = useMemo(() => {
    const mapa: Borrador = {}
    for (const f of horario?.filas ?? []) if (f.curso_id === curso?.id) mapa[claveCelda(f.turno, f.dia, f.modulo)] = { materia_id: f.materia_id, fijo: esFijo(f) }
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
      lista.push({ ...f, docentes: docentesDeMateria(materia, porMateria), unidad: unidadDeMateria(materia, porMateria), curso_nombre: etiquetaCurso(otro) })
    }
    return lista
  }, [horario, filasMaterias, cursos, curso?.id, porMateria])

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
          soportaFijo={horario?.soportaFijo ?? false}
          agrupamientos={agrupamientosDelCurso}
          etiquetaMateria={etiquetaMateria}
          otras={otras}
          nombreDocente={nombreDocente}
          disponibilidad={disponibilidadDe}
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
