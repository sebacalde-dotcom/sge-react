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
import { Add, ContentCopy, Delete, Edit, PlaylistAdd } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { formatNum } from '@/features/inasistencias/notificaciones/carta'
import { TURNOS, type Turno } from './grilla'
import { etiquetaCurso, materiasParaAgregar, parsearMateriasEnLote, totalHoras, type MateriaCarga } from './materias'
import { useAgrupamientosCiclo } from './useAgrupamientosCiclo'
import { useCursosCiclo } from './useCursosCiclo'
import { useMateriasCiclo, type MateriaFila } from './useMateriasCiclo'

interface Docente {
  id: string
  apellido: string
  nombre: string
}

// Cualquier tipo de legajo de personal se puede elegir como docente de una materia, tenga o no acceso al sistema
const TIPOS_DOCENTE = ['docente', 'preceptor', 'directivo', 'otro']

interface MateriaForm {
  nombre: string
  horas: string
  docente: Docente | null
  /** '' = el turno del curso */
  turno: '' | Turno
  bloqueDoble: boolean
}

const VACIO: MateriaForm = { nombre: '', horas: '', docente: null, turno: '', bloqueDoble: false }
const MAX_HORAS = 40

const nombreDocente = (d: { apellido: string; nombre: string }) => `${d.apellido}, ${d.nombre}`

const mensajeDeError = (mensaje: string) =>
  mensaje.includes('uq_materias_curso_nombre') ? 'Ya hay una materia con ese nombre en este curso' : mensaje

export function MateriasTab() {
  const { cicloId } = useCiclo()
  const queryClient = useQueryClient()
  const [cursoId, setCursoId] = useState('')
  const [dialogo, setDialogo] = useState<'materia' | 'lote' | 'copiar' | null>(null)
  const [editando, setEditando] = useState<MateriaFila | null>(null)
  const [form, setForm] = useState<MateriaForm>(VACIO)
  const [textoLote, setTextoLote] = useState('')
  const [origenId, setOrigenId] = useState('')
  const [copiarDocentes, setCopiarDocentes] = useState(false)
  const [aEliminar, setAEliminar] = useState<MateriaFila | null>(null)

  const { data: cursos = [], isLoading: cargandoCursos } = useCursosCiclo()

  const { data: docentes = [] } = useQuery({
    queryKey: ['personal-activo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personas')
        .select('id, apellido, nombre')
        .in('tipo', TIPOS_DOCENTE)
        .is('archivado_at', null)
        .order('apellido')
      if (error) throw error
      return data as Docente[]
    },
  })

  // Todas las materias del ciclo en una sola consulta: alcanza para la lista del curso y para los recuentos
  const { data: materiasCiclo, isLoading: cargandoMaterias } = useMateriasCiclo()

  const filas = useMemo(() => materiasCiclo?.filas ?? [], [materiasCiclo])
  const soportaHoras = materiasCiclo?.soportaHoras ?? true
  const soportaGenerador = materiasCiclo?.soportaGenerador ?? true
  const { porMateria: agrupamientoDe } = useAgrupamientosCiclo()

  const cursosOrdenados = useMemo(
    () => [...cursos].sort((a, b) => etiquetaCurso(a).localeCompare(etiquetaCurso(b), 'es', { numeric: true })),
    [cursos],
  )
  const cursoActual = cursosOrdenados.find((c) => c.id === cursoId) ?? cursosOrdenados[0]
  const cursoActualId = cursoActual?.id ?? ''
  const materiasDelCurso = useMemo(() => filas.filter((m) => m.curso_id === cursoActualId), [filas, cursoActualId])
  const porCurso = useMemo(() => {
    const mapa = new Map<string, MateriaFila[]>()
    for (const m of filas) mapa.set(m.curso_id, [...(mapa.get(m.curso_id) ?? []), m])
    return mapa
  }, [filas])
  // Una materia de un agrupamiento la dictan los docentes de sus grupos, no un docente propio
  const sinDocente = materiasDelCurso.filter((m) => !m.personal_id && !agrupamientoDe.has(m.id)).length

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['materias', cicloId] })
    queryClient.invalidateQueries({ queryKey: ['alumno-materias'] })
  }

  function cerrar() {
    setDialogo(null)
    setEditando(null)
  }

  function abrirNueva() {
    setEditando(null)
    setForm(VACIO)
    setDialogo('materia')
  }

  function abrirEdicion(m: MateriaFila) {
    setEditando(m)
    setForm({
      nombre: m.nombre,
      horas: m.horas_semanales != null ? String(m.horas_semanales) : '',
      docente: docentes.find((d) => d.id === m.personal_id) ?? null,
      turno: m.turno ?? '',
      bloqueDoble: m.bloque_doble ?? false,
    })
    setDialogo('materia')
  }

  const horasValidas = (texto: string) => texto === '' || (Number.isFinite(Number(texto)) && Number(texto) >= 0 && Number(texto) <= MAX_HORAS)

  const guardarMutation = useMutation({
    mutationFn: async () => {
      const nombre = form.nombre.trim()
      const otras = materiasDelCurso.filter((m) => m.id !== editando?.id)
      if (materiasParaAgregar(otras, [{ nombre, horas_semanales: null }]).agregar.length === 0) {
        throw new Error('Ya hay una materia con ese nombre en este curso')
      }
      const fila = {
        nombre,
        personal_id: form.docente?.id ?? null,
        ...(soportaHoras ? { horas_semanales: form.horas === '' ? null : Number(form.horas) } : {}),
        ...(soportaGenerador ? { turno: form.turno || null, bloque_doble: form.bloqueDoble } : {}),
      }
      if (editando) {
        const { data, error } = await supabase.from('materias').update(fila).eq('id', editando.id).select('id')
        if (error) throw new Error(mensajeDeError(error.message))
        if (!data || data.length === 0) throw new Error('No se pudo guardar la materia (sin permisos en la base)')
      } else {
        const { error } = await supabase.from('materias').insert({ ...fila, ciclo_id: cicloId!, curso_id: cursoActualId })
        if (error) throw new Error(mensajeDeError(error.message))
      }
    },
    onSuccess: () => {
      toast.success(editando ? 'Materia actualizada' : 'Materia creada')
      refrescar()
      cerrar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const eliminarMutation = useMutation({
    mutationFn: async (m: MateriaFila) => {
      const { data, error } = await supabase.from('materias').delete().eq('id', m.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo eliminar la materia (sin permisos en la base)')
    },
    onSuccess: () => {
      toast.success('Materia eliminada')
      refrescar()
      setAEliminar(null)
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  // Alta de varias materias a la vez: pegadas en un cuadro de texto o copiadas de otro curso
  const cargaLote = useMemo(() => materiasParaAgregar(materiasDelCurso, parsearMateriasEnLote(textoLote)), [materiasDelCurso, textoLote])
  const materiasOrigen = useMemo(() => porCurso.get(origenId) ?? [], [porCurso, origenId])
  const cargaCopia = useMemo(
    () =>
      materiasParaAgregar(
        materiasDelCurso,
        materiasOrigen.map((m) => ({
          nombre: m.nombre,
          horas_semanales: m.horas_semanales ?? null,
          personal_id: copiarDocentes ? m.personal_id : null,
          turno: m.turno ?? null,
          bloque_doble: m.bloque_doble ?? false,
        })),
      ),
    [materiasDelCurso, materiasOrigen, copiarDocentes],
  )

  const insertarVariasMutation = useMutation({
    mutationFn: async (materias: (MateriaCarga & { personal_id?: string | null; turno?: Turno | null; bloque_doble?: boolean })[]) => {
      const filasNuevas = materias.map((m) => ({
        ciclo_id: cicloId!,
        curso_id: cursoActualId,
        nombre: m.nombre.trim(),
        personal_id: m.personal_id ?? null,
        ...(soportaHoras ? { horas_semanales: m.horas_semanales } : {}),
        ...(soportaGenerador ? { turno: m.turno ?? null, bloque_doble: m.bloque_doble ?? false } : {}),
      }))
      const { error } = await supabase.from('materias').insert(filasNuevas)
      if (error) throw new Error(mensajeDeError(error.message))
      return filasNuevas.length
    },
    onSuccess: (cantidad) => {
      toast.success(cantidad === 1 ? 'Se agregó 1 materia' : `Se agregaron ${cantidad} materias`)
      refrescar()
      setTextoLote('')
      cerrar()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (!cicloId) {
    return <Alert severity="warning">Primero creá un ciclo lectivo en la pestaña General.</Alert>
  }
  if (cargandoCursos || cargandoMaterias) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }
  if (cursos.length === 0) {
    return <Alert severity="info">Todavía no hay cursos. Cargalos en la pestaña Cursos y después agregales las materias.</Alert>
  }

  const otrosCursosConMaterias = cursosOrdenados.filter((c) => c.id !== cursoActualId && (porCurso.get(c.id)?.length ?? 0) > 0)

  return (
    <>
      {!soportaHoras && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta correr la migración 014 en Supabase para cargar las horas semanales y para que los permisos por área se
          apliquen a las materias.
        </Alert>
      )}
      {soportaHoras && !soportaGenerador && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta correr la migración 019 en Supabase para indicar el turno y los bloques dobles de las materias.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          select
          size="small"
          label="Curso"
          value={cursoActualId}
          onChange={(e) => setCursoId(e.target.value)}
          sx={{ minWidth: 260 }}
        >
          {cursosOrdenados.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {etiquetaCurso(c)} ({porCurso.get(c.id)?.length ?? 0})
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {materiasDelCurso.length} {materiasDelCurso.length === 1 ? 'materia' : 'materias'}
          {soportaHoras && materiasDelCurso.length > 0 ? ` · ${formatNum(totalHoras(materiasDelCurso))} horas o módulos por semana` : ''}
        </Typography>
        {sinDocente > 0 && <Chip size="small" color="warning" variant="outlined" label={`${sinDocente} sin docente`} />}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Button variant="contained" size="small" startIcon={<Add />} onClick={abrirNueva}>Nueva materia</Button>
        <Button size="small" startIcon={<PlaylistAdd />} onClick={() => setDialogo('lote')}>Agregar varias</Button>
        <Button
          size="small"
          startIcon={<ContentCopy />}
          disabled={otrosCursosConMaterias.length === 0}
          onClick={() => {
            setOrigenId(otrosCursosConMaterias[0]?.id ?? '')
            setDialogo('copiar')
          }}
        >
          Copiar de otro curso
        </Button>
      </Box>

      {materiasDelCurso.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">Este curso todavía no tiene materias</Typography>
        </Card>
      ) : (
        <Card sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Materia</TableCell>
                {soportaHoras && <TableCell align="right">Horas o módulos</TableCell>}
                {soportaGenerador && <TableCell>Turno</TableCell>}
                <TableCell>Docente</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {materiasDelCurso.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>
                    {m.nombre}
                    {m.bloque_doble && <Chip size="small" variant="outlined" label="Bloque doble" sx={{ ml: 1 }} />}
                  </TableCell>
                  {soportaHoras && <TableCell align="right">{m.horas_semanales != null ? formatNum(m.horas_semanales) : '—'}</TableCell>}
                  {soportaGenerador && (
                    <TableCell>{m.turno ? TURNOS.find((t) => t.value === m.turno)?.label : <Typography component="span" variant="body2" color="text.disabled">Del curso</Typography>}</TableCell>
                  )}
                  <TableCell>
                    {agrupamientoDe.has(m.id) ? (
                      <Typography component="span" variant="body2" color="text.secondary">
                        Por grupos ({agrupamientoDe.get(m.id)!.nombre})
                      </Typography>
                    ) : m.personal ? (
                      nombreDocente(m.personal)
                    ) : (
                      <Typography component="span" variant="body2" color="text.disabled">Sin asignar</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton size="small" onClick={() => abrirEdicion(m)} aria-label={`Editar ${m.nombre}`}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setAEliminar(m)} aria-label={`Eliminar ${m.nombre}`}><Delete fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogo === 'materia'} onClose={cerrar} maxWidth="sm" fullWidth>
        <DialogTitle>{editando ? 'Editar materia' : `Nueva materia en ${cursoActual ? etiquetaCurso(cursoActual) : ''}`}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField
            label="Materia"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            required
            autoFocus
            placeholder="Ej: Matemática"
          />
          {soportaHoras && (
            <TextField
              label="Horas o módulos por semana"
              type="number"
              value={form.horas}
              onChange={(e) => setForm({ ...form, horas: e.target.value })}
              error={!horasValidas(form.horas)}
              helperText={!horasValidas(form.horas) ? `Tiene que estar entre 0 y ${MAX_HORAS}` : 'Opcional'}
              slotProps={{ htmlInput: { min: 0, max: MAX_HORAS, step: 0.5 } }}
            />
          )}
          {soportaGenerador && (
            <>
              <TextField
                select
                label="Turno en que se dicta"
                value={form.turno}
                onChange={(e) => setForm({ ...form, turno: e.target.value as '' | Turno })}
                helperText="Solo hace falta en los cursos de doble turno; si no, se dicta en el turno del curso."
              >
                <MenuItem value="">El turno del curso</MenuItem>
                {TURNOS.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Checkbox checked={form.bloqueDoble} onChange={(e) => setForm({ ...form, bloqueDoble: e.target.checked })} />}
                label="Se dicta en bloques de dos módulos seguidos"
              />
            </>
          )}
          <Autocomplete
            options={docentes}
            value={form.docente}
            onChange={(_, docente) => setForm({ ...form, docente })}
            getOptionLabel={nombreDocente}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText="No hay personal con ese nombre"
            renderInput={(params) => <TextField {...params} label="Docente" helperText="Opcional. Se carga desde Personal." />}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!form.nombre.trim() || !horasValidas(form.horas) || guardarMutation.isPending}
            onClick={() => guardarMutation.mutate()}
          >
            {guardarMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogo === 'lote'} onClose={cerrar} maxWidth="sm" fullWidth>
        <DialogTitle>Agregar varias materias a {cursoActual ? etiquetaCurso(cursoActual) : ''}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary">
            Una materia por línea. Las horas o módulos por semana son opcionales y van después de una coma o un punto y
            coma: <em>Matemática, 5</em>. También podés pegar dos columnas copiadas de una planilla.
          </Typography>
          <TextField
            multiline
            minRows={8}
            value={textoLote}
            onChange={(e) => setTextoLote(e.target.value)}
            placeholder={'Matemática, 5\nLengua y Literatura, 5\nBiología, 3'}
            autoFocus
          />
          {textoLote.trim() && (
            <Typography variant="body2">
              Se agregan <strong>{cargaLote.agregar.length}</strong>
              {cargaLote.repetidas.length > 0 && ` · ${cargaLote.repetidas.length} ya están o se repiten: ${cargaLote.repetidas.map((m) => m.nombre).join(', ')}`}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={cargaLote.agregar.length === 0 || insertarVariasMutation.isPending}
            onClick={() => insertarVariasMutation.mutate(cargaLote.agregar)}
          >
            {insertarVariasMutation.isPending ? 'Agregando…' : 'Agregar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogo === 'copiar'} onClose={cerrar} maxWidth="sm" fullWidth>
        <DialogTitle>Copiar materias a {cursoActual ? etiquetaCurso(cursoActual) : ''}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField select label="Copiar desde" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
            {otrosCursosConMaterias.map((c) => (
              <MenuItem key={c.id} value={c.id}>{etiquetaCurso(c)} ({porCurso.get(c.id)?.length ?? 0} materias)</MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={<Checkbox checked={copiarDocentes} onChange={(e) => setCopiarDocentes(e.target.checked)} />}
            label="Copiar también los docentes"
          />
          <Typography variant="body2">
            Se agregan <strong>{cargaCopia.agregar.length}</strong>
            {cargaCopia.repetidas.length > 0 && ` · ${cargaCopia.repetidas.length} ya están en este curso: ${cargaCopia.repetidas.map((m) => m.nombre).join(', ')}`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cerrar}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={cargaCopia.agregar.length === 0 || insertarVariasMutation.isPending}
            onClick={() => insertarVariasMutation.mutate(cargaCopia.agregar)}
          >
            {insertarVariasMutation.isPending ? 'Copiando…' : 'Copiar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!aEliminar} onClose={() => setAEliminar(null)} maxWidth="xs" fullWidth>
        <DialogTitle>¿Eliminar la materia?</DialogTitle>
        <DialogContent>
          <Typography>
            Se elimina <strong>{aEliminar?.nombre}</strong> del curso, junto con sus horarios y los registros que dependan
            de ella.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAEliminar(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={eliminarMutation.isPending}
            onClick={() => aEliminar && eliminarMutation.mutate(aEliminar)}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
