import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { formatNum } from '@/features/inasistencias/notificaciones/carta'
import { GrillaModulosEditor } from './GrillaModulosEditor'
import { TURNOS_CURSO, controlHoras, modulosPorSemana, modulosSemanalesDelCurso, type GrillaModulos } from './grilla'
import { etiquetaCurso } from './materias'
import { useCursosCiclo, useSoportaTurno } from './useCursosCiclo'
import { useMateriasCiclo } from './useMateriasCiclo'
import { HorarioCursoEditor } from './HorarioCursoEditor'
import { HorarioDocenteVista } from './HorarioDocenteVista'

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const

function ModulosYCursos() {
  const { ciclo, cicloId, refresh } = useCiclo()
  const queryClient = useQueryClient()
  const soportaTurno = useSoportaTurno()
  const { data: cursos = [], isLoading: cargandoCursos } = useCursosCiclo()
  const { data: materiasCiclo } = useMateriasCiclo()

  // Sin la migración 015 la columna no existe y la grilla no se puede guardar
  const soportaGrilla = !!ciclo && 'grilla_modulos' in ciclo
  const grilla = ciclo?.grilla_modulos ?? null
  const soportaHoras = materiasCiclo?.soportaHoras ?? false

  const cursosOrdenados = useMemo(
    () => [...cursos].sort((a, b) => etiquetaCurso(a).localeCompare(etiquetaCurso(b), 'es', { numeric: true })),
    [cursos],
  )
  const horasPorCurso = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const m of materiasCiclo?.filas ?? []) mapa.set(m.curso_id, (mapa.get(m.curso_id) ?? 0) + Number(m.horas_semanales ?? 0))
    return mapa
  }, [materiasCiclo])

  const guardarGrilla = useMutation({
    mutationFn: async (nueva: GrillaModulos) => {
      const { data, error } = await supabase.from('ciclos').update({ grilla_modulos: nueva }).eq('id', ciclo!.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo guardar (sin permisos en la base)')
    },
    onSuccess: async () => {
      toast.success('Módulos guardados')
      await refresh()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  const cambiarTurno = useMutation({
    mutationFn: async ({ id, turno }: { id: string; turno: string }) => {
      const { data, error } = await supabase.from('cursos').update({ turno: turno || null }).eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo cambiar el turno (sin permisos en la base)')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cursos', cicloId] }),
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (!ciclo) {
    return <Alert severity="warning">Primero creá un ciclo lectivo en la pestaña General.</Alert>
  }

  return (
    <>
      {(!soportaGrilla || !soportaTurno) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Falta correr la migración 015 en Supabase para guardar los módulos y el turno de cada curso.
        </Alert>
      )}

      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" sx={titulo}>Módulos de cada turno</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Cargá cuántos módulos tiene cada día y a qué hora empiezan. Cada día puede tener una cantidad distinta, y cada
          turno la suya (en el turno tarde cada colegio lo define). Los módulos son de 60 minutos por defecto, pero se puede
          cambiar la duración y sumar un recreo entre módulos.
        </Typography>
        <GrillaModulosEditor
          grilla={grilla}
          deshabilitado={!soportaGrilla}
          guardando={guardarGrilla.isPending}
          onGuardar={(nueva) => guardarGrilla.mutate(nueva)}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Por semana: {modulosPorSemana(grilla, 'manana')} módulos a la mañana · {modulosPorSemana(grilla, 'tarde')} a la tarde.
        </Typography>
      </Card>

      <Card sx={{ p: 3 }}>
        <Typography variant="subtitle2" sx={titulo}>Turno y módulos de cada curso</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Como un curso no puede tener horas libres, las horas de sus materias tienen que sumar justo los módulos que tiene
          en la semana. Acá se controla eso antes de armar el horario.
        </Typography>

        {cargandoCursos ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : cursosOrdenados.length === 0 ? (
          <Typography color="text.disabled">Todavía no hay cursos. Cargalos en la pestaña Cursos.</Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Curso</TableCell>
                  <TableCell>Turno</TableCell>
                  <TableCell align="right">Módulos por semana</TableCell>
                  <TableCell align="right">Horas de las materias</TableCell>
                  <TableCell>Control</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cursosOrdenados.map((curso) => {
                  const modulos = modulosSemanalesDelCurso(curso.turno, grilla)
                  const horas = horasPorCurso.get(curso.id) ?? 0
                  const control = controlHoras(modulos, horas)
                  return (
                    <TableRow key={curso.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{etiquetaCurso(curso)}</TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={curso.turno ?? ''}
                          disabled={!soportaTurno || cambiarTurno.isPending}
                          onChange={(e) => cambiarTurno.mutate({ id: curso.id, turno: e.target.value })}
                          sx={{ minWidth: 220 }}
                          slotProps={{ htmlInput: { 'aria-label': `Turno de ${etiquetaCurso(curso)}` } }}
                        >
                          <MenuItem value="">Sin definir</MenuItem>
                          {TURNOS_CURSO.map((t) => (
                            <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell align="right">{curso.turno ? formatNum(modulos) : '—'}</TableCell>
                      <TableCell align="right">{soportaHoras ? formatNum(horas) : '—'}</TableCell>
                      <TableCell>
                        {!curso.turno ? (
                          <Chip size="small" variant="outlined" label="Falta el turno" />
                        ) : !soportaHoras || control.estado === 'sin_datos' ? (
                          <Chip size="small" variant="outlined" label={soportaHoras ? 'Faltan los módulos' : 'Sin horas cargadas'} />
                        ) : control.estado === 'coincide' ? (
                          <Chip size="small" color="success" label="Coincide" />
                        ) : control.estado === 'faltan' ? (
                          <Chip size="small" color="warning" label={`Faltan ${formatNum(control.diferencia)} h de materias`} />
                        ) : (
                          <Chip size="small" color="error" label={`Sobran ${formatNum(control.diferencia)} h de materias`} />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        )}
      </Card>
    </>
  )
}

export function HorarioTab() {
  const [seccion, setSeccion] = useState(0)
  return (
    <>
      <Tabs value={seccion} onChange={(_, v) => setSeccion(v)} sx={{ mb: 3, minHeight: 36 }} textColor="secondary" indicatorColor="secondary">
        <Tab label="Módulos y cursos" />
        <Tab label="Horario por curso" />
        <Tab label="Horario por docente" />
      </Tabs>
      {seccion === 0 && <ModulosYCursos />}
      {seccion === 1 && <HorarioCursoEditor />}
      {seccion === 2 && <HorarioDocenteVista />}
    </>
  )
}
