import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
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
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { Add, Delete, Edit, Groups } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { formatFecha } from '@/features/inasistencias/notificaciones/carta'
import { hoyISO } from '@/features/inasistencias/useRegularidad'
import { grupoDelAlumno, validarAgrupamiento, vigenteEn, type Membresia } from './agrupamientos'
import { turnosDelCurso, type Turno } from './grilla'
import { etiquetaCurso } from './materias'
import { useCursosCiclo } from './useCursosCiclo'
import {
  useAgrupamientosCiclo,
  useMembresiasCiclo,
  type AgrupamientoConDocentes,
  type GrupoConDocente,
} from './useAgrupamientosCiclo'
import { useMateriasCiclo } from './useMateriasCiclo'

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const

interface Docente {
  id: string
  apellido: string
  nombre: string
}
const nombreDocente = (d: { apellido: string; nombre: string }) => `${d.apellido}, ${d.nombre}`

const mensajeDeError = (mensaje: string) =>
  mensaje.includes('uq_agrupamientos_nombre')
    ? 'Ya hay un agrupamiento con ese nombre'
    : mensaje.includes('uq_grupos_nombre')
      ? 'Ya hay un grupo con ese nombre en este agrupamiento'
      : mensaje.includes('grupo_alumnos_sin_superposicion')
        ? 'El alumno ya está en otro grupo de este agrupamiento en esas fechas'
        : mensaje

interface OpcionMateria {
  id: string
  etiqueta: string
  curso: string
}

// ── Alumnos de un agrupamiento ─────────────────────────────────────────────────────────────────────

interface AlumnoDelAgrupamiento {
  persona_id: string
  apellido: string
  nombre: string
  curso_id: string
}

function AlumnosDelAgrupamiento({
  agrupamiento,
  cursoIds,
  etiquetaDeCurso,
  membresias,
  onCambio,
}: {
  agrupamiento: AgrupamientoConDocentes
  cursoIds: string[]
  etiquetaDeCurso: (cursoId: string) => string
  membresias: Membresia[]
  onCambio: () => void
}) {
  const [fecha, setFecha] = useState(hoyISO())
  const [filtroCurso, setFiltroCurso] = useState('')
  const [soloSinGrupo, setSoloSinGrupo] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [destino, setDestino] = useState('')

  const { data: alumnos = [], isLoading } = useQuery({
    queryKey: ['alumnos-de-cursos', cursoIds.join(',')],
    enabled: cursoIds.length > 0,
    queryFn: async () => {
      type Fila = { persona_id: string; curso_id: string; personas: { apellido: string; nombre: string } | null }
      const { data: principales, error } = await supabase
        .from('alumno_datos')
        .select('persona_id, curso_id, personas!alumno_datos_persona_id_fkey(apellido, nombre)')
        .eq('estado', 'activo')
        .in('curso_id', cursoIds)
      if (error) throw error
      const lista: AlumnoDelAgrupamiento[] = []
      const vistos = new Set<string>()
      for (const f of (principales ?? []) as unknown as Fila[]) {
        if (!f.personas || vistos.has(f.persona_id)) continue
        vistos.add(f.persona_id)
        lista.push({ persona_id: f.persona_id, curso_id: f.curso_id, apellido: f.personas.apellido, nombre: f.personas.nombre })
      }
      // Quienes cursan alguno de estos cursos como sección adicional (la tabla puede no existir todavía)
      const { data: adicionales } = await supabase.from('alumno_cursos').select('persona_id, curso_id').in('curso_id', cursoIds)
      const cursoDeAdicional = new Map((adicionales ?? []).map((a) => [a.persona_id as string, a.curso_id as string]))
      const faltan = [...cursoDeAdicional.keys()].filter((id) => !vistos.has(id))
      if (faltan.length > 0) {
        const { data: extra } = await supabase
          .from('alumno_datos')
          .select('persona_id, personas!alumno_datos_persona_id_fkey(apellido, nombre)')
          .eq('estado', 'activo')
          .in('persona_id', faltan)
        for (const f of (extra ?? []) as unknown as Omit<Fila, 'curso_id'>[]) {
          if (!f.personas || vistos.has(f.persona_id)) continue
          vistos.add(f.persona_id)
          lista.push({ persona_id: f.persona_id, curso_id: cursoDeAdicional.get(f.persona_id)!, apellido: f.personas.apellido, nombre: f.personas.nombre })
        }
      }
      return lista.sort((a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
    },
  })

  const asignar = useMutation({
    mutationFn: async ({ personas, grupoId }: { personas: string[]; grupoId: string | null }) => {
      for (const p of personas) {
        const { error } = await supabase.rpc('asignar_grupo_alumno', {
          p_agrupamiento: agrupamiento.id,
          p_persona: p,
          p_grupo: grupoId,
          p_fecha: fecha,
        })
        if (error) throw new Error(mensajeDeError(error.message))
      }
    },
    onSuccess: (_, { personas }) => {
      toast.success(personas.length === 1 ? 'Grupo actualizado' : `Se actualizaron ${personas.length} alumnos`)
      setSeleccionados(new Set())
      onCambio()
    },
    onError: (e) => {
      toast.error('Error: ' + e.message)
      onCambio()
    },
  })

  const nombreGrupo = (id: string | null) => agrupamiento.grupos.find((g) => g.id === id)?.nombre ?? 'Sin grupo'
  const historialDe = (personaId: string) =>
    membresias
      .filter((m) => m.persona_id === personaId)
      .sort((a, b) => a.desde.localeCompare(b.desde))

  const visibles = alumnos.filter(
    (a) => (!filtroCurso || a.curso_id === filtroCurso) && (!soloSinGrupo || grupoDelAlumno(membresias, a.persona_id, fecha) === null),
  )
  const todosMarcados = visibles.length > 0 && visibles.every((a) => seleccionados.has(a.persona_id))

  function alternar(id: string) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Los cambios rigen desde la fecha que elijas: el grupo anterior del alumno queda con su historial hasta el día anterior.
        La lista muestra el grupo de cada alumno en esa fecha.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          type="date"
          label="Rige desde"
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField select size="small" label="Curso" value={filtroCurso} onChange={(e) => setFiltroCurso(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">Todos</MenuItem>
          {cursoIds.map((id) => (
            <MenuItem key={id} value={id}>{etiquetaDeCurso(id)}</MenuItem>
          ))}
        </TextField>
        <FormControlLabel control={<Checkbox checked={soloSinGrupo} onChange={(e) => setSoloSinGrupo(e.target.checked)} />} label="Solo los que no tienen grupo" />
      </Box>

      {seleccionados.size > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2">{seleccionados.size} {seleccionados.size === 1 ? 'alumno' : 'alumnos'}: pasar a</Typography>
          <TextField select size="small" value={destino} onChange={(e) => setDestino(e.target.value)} sx={{ minWidth: 180 }} slotProps={{ htmlInput: { 'aria-label': 'Grupo de destino' } }}>
            <MenuItem value="">Sin grupo</MenuItem>
            {agrupamiento.grupos.map((g) => (
              <MenuItem key={g.id} value={g.id}>{g.nombre}</MenuItem>
            ))}
          </TextField>
          <Button size="small" variant="contained" disabled={asignar.isPending} onClick={() => asignar.mutate({ personas: [...seleccionados], grupoId: destino || null })}>
            Aplicar
          </Button>
        </Box>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : visibles.length === 0 ? (
        <Typography color="text.disabled">No hay alumnos para mostrar en estos cursos.</Typography>
      ) : (
        <Box sx={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={todosMarcados}
                    indeterminate={!todosMarcados && visibles.some((a) => seleccionados.has(a.persona_id))}
                    onChange={() => setSeleccionados(todosMarcados ? new Set() : new Set(visibles.map((a) => a.persona_id)))}
                    slotProps={{ input: { 'aria-label': 'Elegir todos' } }}
                  />
                </TableCell>
                <TableCell>Alumno</TableCell>
                <TableCell>Curso</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Historial</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibles.map((a) => {
                const actual = grupoDelAlumno(membresias, a.persona_id, fecha)
                const historial = historialDe(a.persona_id)
                return (
                  <TableRow key={a.persona_id} hover>
                    <TableCell padding="checkbox">
                      <Checkbox checked={seleccionados.has(a.persona_id)} onChange={() => alternar(a.persona_id)} slotProps={{ input: { 'aria-label': `Elegir a ${a.apellido}, ${a.nombre}` } }} />
                    </TableCell>
                    <TableCell>{a.apellido}, {a.nombre}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{etiquetaDeCurso(a.curso_id)}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={actual ?? ''}
                        disabled={asignar.isPending}
                        onChange={(e) => asignar.mutate({ personas: [a.persona_id], grupoId: e.target.value || null })}
                        sx={{ minWidth: 150 }}
                        slotProps={{ htmlInput: { 'aria-label': `Grupo de ${a.apellido}, ${a.nombre}` } }}
                      >
                        <MenuItem value="">Sin grupo</MenuItem>
                        {agrupamiento.grupos.map((g) => (
                          <MenuItem key={g.id} value={g.id}>{g.nombre}</MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      {historial.length > 1 || (historial.length === 1 && historial[0].hasta) ? (
                        <Typography variant="caption" color="text.secondary">
                          {historial
                            .map((m) => `${nombreGrupo(m.grupo_id)} ${formatFecha(m.desde)}${m.hasta ? ` al ${formatFecha(m.hasta)}` : ' en adelante'}`)
                            .join(' · ')}
                        </Typography>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  )
}

// ── Pestaña ───────────────────────────────────────────────────────────────────────────────────────

type Dialogo =
  | { tipo: 'agrupamiento'; editando: AgrupamientoConDocentes | null }
  | { tipo: 'grupo'; agrupamiento: AgrupamientoConDocentes; editando: GrupoConDocente | null }
  | { tipo: 'alumnos'; agrupamiento: AgrupamientoConDocentes }
  | { tipo: 'eliminar-agrupamiento'; agrupamiento: AgrupamientoConDocentes }
  | { tipo: 'eliminar-grupo'; agrupamiento: AgrupamientoConDocentes; grupo: GrupoConDocente }

export function AgrupamientosTab() {
  const { cicloId } = useCiclo()
  const queryClient = useQueryClient()
  const { data: cursos = [], isLoading: cargandoCursos } = useCursosCiclo()
  const { data: materiasCiclo, isLoading: cargandoMaterias } = useMateriasCiclo()
  const { disponible, cargando, agrupamientos } = useAgrupamientosCiclo()
  const { data: membresias = [] } = useMembresiasCiclo(agrupamientos.map((a) => a.id))

  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [nombre, setNombre] = useState('')
  const [materiasElegidas, setMateriasElegidas] = useState<OpcionMateria[]>([])
  const [docente, setDocente] = useState<Docente | null>(null)

  const { data: docentes = [] } = useQuery({
    queryKey: ['personal-activo'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personal').select('id, apellido, nombre, rol').eq('eliminado', false).order('apellido')
      if (error) throw error
      return data as Docente[]
    },
  })

  const filasMaterias = useMemo(() => materiasCiclo?.filas ?? [], [materiasCiclo])
  const cursoPorId = useMemo(() => new Map(cursos.map((c) => [c.id, c])), [cursos])
  const etiquetaDeCurso = (id: string) => {
    const curso = cursoPorId.get(id)
    return curso ? etiquetaCurso(curso) : 'Curso'
  }
  const materiaPorId = useMemo(() => new Map(filasMaterias.map((m) => [m.id, m])), [filasMaterias])

  const opcionesDeMaterias: OpcionMateria[] = useMemo(
    () =>
      filasMaterias
        .map((m) => {
          const curso = cursoPorId.get(m.curso_id)
          const etiquetaDelCurso = curso ? etiquetaCurso(curso) : 'Curso'
          return { id: m.id, curso: etiquetaDelCurso, etiqueta: `${etiquetaDelCurso} · ${m.nombre}` }
        })
        .sort((a, b) => a.curso.localeCompare(b.curso, 'es', { numeric: true }) || a.etiqueta.localeCompare(b.etiqueta, 'es')),
    [filasMaterias, cursoPorId],
  )

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['agrupamientos', cicloId] })
    queryClient.invalidateQueries({ queryKey: ['grupo-alumnos'] })
    queryClient.invalidateQueries({ queryKey: ['horario', cicloId] })
  }
  const cerrar = () => setDialogo(null)

  const cambiosAgrupamiento = useMutation({
    mutationFn: async () => {
      const editando = dialogo?.tipo === 'agrupamiento' ? dialogo.editando : null
      let id = editando?.id
      if (editando) {
        const { data, error } = await supabase.from('agrupamientos').update({ nombre: nombre.trim() }).eq('id', editando.id).select('id')
        if (error) throw new Error(mensajeDeError(error.message))
        if (!data || data.length === 0) throw new Error('No se pudo guardar (sin permisos en la base)')
      } else {
        const { data, error } = await supabase.from('agrupamientos').insert({ ciclo_id: cicloId!, nombre: nombre.trim() }).select('id').single()
        if (error) throw new Error(mensajeDeError(error.message))
        id = data.id
      }
      const nuevas = materiasElegidas.map((m) => m.id)
      const anteriores = editando?.materias ?? []
      const aQuitar = anteriores.filter((m) => !nuevas.includes(m))
      if (aQuitar.length > 0) {
        const { error } = await supabase.from('agrupamiento_materias').delete().in('materia_id', aQuitar)
        if (error) throw error
      }
      const aAgregar = nuevas.filter((m) => !anteriores.includes(m))
      if (aAgregar.length > 0) {
        const { error } = await supabase.from('agrupamiento_materias').insert(aAgregar.map((materia_id) => ({ materia_id, agrupamiento_id: id })))
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('Agrupamiento guardado')
      refrescar()
      cerrar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const eliminarAgrupamiento = useMutation({
    mutationFn: async (a: AgrupamientoConDocentes) => {
      const { data, error } = await supabase.from('agrupamientos').delete().eq('id', a.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo eliminar (sin permisos en la base)')
    },
    onSuccess: () => {
      toast.success('Agrupamiento eliminado')
      refrescar()
      cerrar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const guardarGrupo = useMutation({
    mutationFn: async () => {
      if (dialogo?.tipo !== 'grupo') return
      const fila = { nombre: nombre.trim(), personal_id: docente?.id ?? null }
      if (dialogo.editando) {
        const { data, error } = await supabase.from('grupos').update(fila).eq('id', dialogo.editando.id).select('id')
        if (error) throw new Error(mensajeDeError(error.message))
        if (!data || data.length === 0) throw new Error('No se pudo guardar (sin permisos en la base)')
      } else {
        const { error } = await supabase.from('grupos').insert({ ...fila, agrupamiento_id: dialogo.agrupamiento.id })
        if (error) throw new Error(mensajeDeError(error.message))
      }
    },
    onSuccess: () => {
      toast.success('Grupo guardado')
      refrescar()
      cerrar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const eliminarGrupo = useMutation({
    mutationFn: async (g: GrupoConDocente) => {
      const { data, error } = await supabase.from('grupos').delete().eq('id', g.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo eliminar (sin permisos en la base)')
    },
    onSuccess: () => {
      toast.success('Grupo eliminado')
      refrescar()
      cerrar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (!cicloId) return <Alert severity="warning">Primero creá un ciclo lectivo en la pestaña General.</Alert>
  if (cargandoCursos || cargandoMaterias || cargando) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (!disponible) return <Alert severity="warning">Falta correr la migración 020 en Supabase para usar los agrupamientos.</Alert>

  const usadas = new Set(agrupamientos.flatMap((a) => a.materias))

  function abrirAgrupamiento(editando: AgrupamientoConDocentes | null) {
    setNombre(editando?.nombre ?? '')
    setMateriasElegidas(opcionesDeMaterias.filter((o) => editando?.materias.includes(o.id)))
    setDialogo({ tipo: 'agrupamiento', editando })
  }
  function abrirGrupo(agrupamiento: AgrupamientoConDocentes, editando: GrupoConDocente | null) {
    setNombre(editando?.nombre ?? '')
    setDocente(docentes.find((d) => d.id === editando?.personal_id) ?? null)
    setDialogo({ tipo: 'grupo', agrupamiento, editando })
  }

  const materiasParaValidar = (a: AgrupamientoConDocentes) =>
    a.materias
      .map((id) => materiaPorId.get(id))
      .filter((m) => !!m)
      .map((m) => {
        const turnos = turnosDelCurso(cursoPorId.get(m.curso_id)?.turno)
        const turno: Turno | null = m.turno ?? (turnos.length === 1 ? turnos[0] : null)
        return { id: m.id, curso_id: m.curso_id, nombre: m.nombre, horas_semanales: m.horas_semanales != null ? Number(m.horas_semanales) : null, turno }
      })
  const nombres = new Map<string, string>()
  for (const a of agrupamientos) for (const g of a.grupos) if (g.personal_id && g.personal) nombres.set(g.personal_id, nombreDocente(g.personal))

  const hoy = hoyISO()
  const alumnosEnGrupo = (g: GrupoConDocente) => membresias.filter((m) => m.grupo_id === g.id && vigenteEn(m, hoy)).length

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Un agrupamiento reúne las materias que se dictan a la vez y se dividen en grupos: Inglés por niveles (con alumnos de
        varios cursos), o Arte dividido en Música y Dibujo (dentro de un curso). Cada grupo tiene su docente y sus alumnos. En
        el horario, las materias de un agrupamiento van en los mismos módulos y ocupan a los docentes de todos los grupos.
      </Typography>
      <Button variant="contained" size="small" startIcon={<Add />} onClick={() => abrirAgrupamiento(null)} sx={{ mb: 2 }}>
        Nuevo agrupamiento
      </Button>

      {agrupamientos.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">Todavía no hay agrupamientos</Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {agrupamientos.map((a) => {
            const problemas = validarAgrupamiento(a, materiasParaValidar(a), etiquetaDeCurso, (id) => nombres.get(id) ?? 'Un docente')
            const cursoIds = [...new Set(a.materias.map((id) => materiaPorId.get(id)?.curso_id).filter((c): c is string => !!c))]
            return (
              <Card key={a.id} sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <Typography variant="h6" sx={{ flex: 1, fontSize: '1.05rem' }}>{a.nombre}</Typography>
                  <Button size="small" startIcon={<Groups />} disabled={a.grupos.length === 0 || cursoIds.length === 0} onClick={() => setDialogo({ tipo: 'alumnos', agrupamiento: a })}>
                    Alumnos
                  </Button>
                  <IconButton size="small" onClick={() => abrirAgrupamiento(a)} aria-label={`Editar ${a.nombre}`}><Edit fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => setDialogo({ tipo: 'eliminar-agrupamiento', agrupamiento: a })} aria-label={`Eliminar ${a.nombre}`}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>

                <Typography variant="subtitle2" sx={{ ...titulo, mb: 0.75 }}>Materias que se dictan a la vez</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                  {a.materias.length === 0 && <Typography variant="body2" color="text.disabled">Ninguna todavía</Typography>}
                  {a.materias.map((id) => {
                    const m = materiaPorId.get(id)
                    return m ? <Chip key={id} size="small" label={`${etiquetaDeCurso(m.curso_id)} · ${m.nombre}`} /> : null
                  })}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="subtitle2" sx={{ ...titulo, mb: 0 }}>Grupos</Typography>
                  <Button size="small" startIcon={<Add />} onClick={() => abrirGrupo(a, null)}>Nuevo grupo</Button>
                </Box>
                {a.grupos.length === 0 ? (
                  <Typography variant="body2" color="text.disabled">Todavía no hay grupos</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Grupo</TableCell>
                        <TableCell>Docente</TableCell>
                        <TableCell align="right">Alumnos hoy</TableCell>
                        <TableCell align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {a.grupos.map((g) => (
                        <TableRow key={g.id} hover>
                          <TableCell>{g.nombre}</TableCell>
                          <TableCell>{g.personal ? nombreDocente(g.personal) : <Typography component="span" variant="body2" color="text.disabled">Sin asignar</Typography>}</TableCell>
                          <TableCell align="right">{alumnosEnGrupo(g)}</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <IconButton size="small" onClick={() => abrirGrupo(a, g)} aria-label={`Editar el grupo ${g.nombre}`}><Edit fontSize="small" /></IconButton>
                            <IconButton size="small" color="error" onClick={() => setDialogo({ tipo: 'eliminar-grupo', agrupamiento: a, grupo: g })} aria-label={`Eliminar el grupo ${g.nombre}`}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {problemas.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                    {problemas.map((p, i) => (
                      <Alert key={i} severity={p.gravedad === 'error' ? 'error' : 'warning'} sx={{ py: 0 }}>{p.mensaje}</Alert>
                    ))}
                  </Box>
                )}
              </Card>
            )
          })}
        </Box>
      )}

      <Dialog open={dialogo?.tipo === 'agrupamiento'} onClose={cerrar} maxWidth="sm" fullWidth>
        <DialogTitle>{dialogo?.tipo === 'agrupamiento' && dialogo.editando ? 'Editar agrupamiento' : 'Nuevo agrupamiento'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus placeholder="Ej: Inglés por niveles" />
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={opcionesDeMaterias.filter((o) => !usadas.has(o.id) || materiasElegidas.some((m) => m.id === o.id) || (dialogo?.tipo === 'agrupamiento' && !!dialogo.editando?.materias.includes(o.id)))}
            value={materiasElegidas}
            onChange={(_, v) => setMateriasElegidas(v)}
            groupBy={(o) => o.curso}
            getOptionLabel={(o) => o.etiqueta}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="No hay materias disponibles"
            renderInput={(params) => (
              <TextField {...params} label="Materias que se dictan a la vez" helperText="Una por curso. Una materia está en un solo agrupamiento." />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button variant="contained" disabled={!nombre.trim() || cambiosAgrupamiento.isPending} onClick={() => cambiosAgrupamiento.mutate()}>
            {cambiosAgrupamiento.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogo?.tipo === 'grupo'} onClose={cerrar} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogo?.tipo === 'grupo' ? (dialogo.editando ? `Editar el grupo ${dialogo.editando.nombre}` : `Nuevo grupo de ${dialogo.agrupamiento.nombre}`) : ''}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField label="Grupo" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus placeholder="Ej: A1, Música" />
          <Autocomplete
            options={docentes}
            value={docente}
            onChange={(_, d) => setDocente(d)}
            getOptionLabel={nombreDocente}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="No hay personal con ese nombre"
            renderInput={(params) => <TextField {...params} label="Docente" helperText="Opcional. Se carga desde Personal." />}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button variant="contained" disabled={!nombre.trim() || guardarGrupo.isPending} onClick={() => guardarGrupo.mutate()}>
            {guardarGrupo.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogo?.tipo === 'alumnos'} onClose={cerrar} maxWidth="md" fullWidth>
        <DialogTitle>Alumnos de {dialogo?.tipo === 'alumnos' ? dialogo.agrupamiento.nombre : ''}</DialogTitle>
        <DialogContent>
          {dialogo?.tipo === 'alumnos' && (() => {
            const agrupamiento = agrupamientos.find((a) => a.id === dialogo.agrupamiento.id) ?? dialogo.agrupamiento
            const cursoIds = [...new Set(agrupamiento.materias.map((id) => materiaPorId.get(id)?.curso_id).filter((c): c is string => !!c))]
            return (
              <AlumnosDelAgrupamiento
                agrupamiento={agrupamiento}
                cursoIds={cursoIds}
                etiquetaDeCurso={etiquetaDeCurso}
                membresias={membresias.filter((m) => agrupamiento.grupos.some((g) => g.id === m.grupo_id))}
                onCambio={() => queryClient.invalidateQueries({ queryKey: ['grupo-alumnos'] })}
              />
            )
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogo?.tipo === 'eliminar-agrupamiento'} onClose={cerrar} maxWidth="xs" fullWidth>
        <DialogTitle>¿Eliminar el agrupamiento?</DialogTitle>
        <DialogContent>
          <Typography>
            Se elimina <strong>{dialogo?.tipo === 'eliminar-agrupamiento' ? dialogo.agrupamiento.nombre : ''}</strong> con sus grupos y la
            pertenencia de los alumnos a cada grupo. Las materias y el horario no se borran.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button variant="contained" color="error" disabled={eliminarAgrupamiento.isPending} onClick={() => dialogo?.tipo === 'eliminar-agrupamiento' && eliminarAgrupamiento.mutate(dialogo.agrupamiento)}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogo?.tipo === 'eliminar-grupo'} onClose={cerrar} maxWidth="xs" fullWidth>
        <DialogTitle>¿Eliminar el grupo?</DialogTitle>
        <DialogContent>
          <Typography>
            Se elimina el grupo <strong>{dialogo?.tipo === 'eliminar-grupo' ? dialogo.grupo.nombre : ''}</strong> y el historial de los alumnos en él.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button variant="contained" color="error" disabled={eliminarGrupo.isPending} onClick={() => dialogo?.tipo === 'eliminar-grupo' && eliminarGrupo.mutate(dialogo.grupo)}>
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
