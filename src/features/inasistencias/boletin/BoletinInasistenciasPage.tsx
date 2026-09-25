import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, ChevronLeft, ChevronRight, Print } from '@mui/icons-material'
import { useCiclo } from '@/contexts/CicloContext'
import { useCursosCiclo } from '@/features/config/ciclo/useCursosCiclo'
import { formatFecha, formatNum } from '../notificaciones/carta'
import { etiquetaTurno, extracto, resumenPorCuatrimestre, type FaltaBoletin, type FiltroJustificacion } from '../boletin'
import { MINIMO_ASISTENCIA_MATERIA } from '../useAsistenciaPorMateria'
import { RUTA_IMPRIMIR_BOLETIN, useBoletinCurso } from './useBoletin'

const titulo = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 } as const
const SIN_FALTAS: FaltaBoletin[] = []
const celdaNum ={ textAlign: 'right', whiteSpace: 'nowrap' } as const

export function BoletinInasistenciasPage() {
  const navigate = useNavigate()
  const { ciclo } = useCiclo()
  const { data: cursos = [] } = useCursosCiclo()
  const [cursoId, setCursoId] = useState('')
  const [personaId, setPersonaId] = useState('')
  const [incluirMaterias, setIncluirMaterias] = useState(false)
  const [cuatrimestre, setCuatrimestre] = useState<number | null>(null)
  const [filtro, setFiltro] = useState<FiltroJustificacion>('todas')

  const boletin = useBoletinCurso(cursoId, incluirMaterias)
  const alumno = boletin.alumnos.find((a) => a.persona_id === personaId) ?? boletin.alumnos[0] ?? null
  const indice = alumno ? boletin.alumnos.indexOf(alumno) : -1
  const faltas = alumno ? boletin.faltasDe(alumno.persona_id) : SIN_FALTAS
  const materias = alumno ? boletin.materiasDe(alumno.persona_id) : null

  const resumen = useMemo(() => resumenPorCuatrimestre(faltas, ciclo), [faltas, ciclo])
  const movs = useMemo(() => extracto(faltas, ciclo, filtro, cuatrimestre), [faltas, ciclo, filtro, cuatrimestre])

  function imprimir(personaIds: string[]) {
    navigate(RUTA_IMPRIMIR_BOLETIN, { state: { cursoId, personaIds, incluirMaterias } })
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/inasistencias')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5">Boletín de Inasistencias</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          label="Curso"
          value={cursoId}
          onChange={(e) => { setCursoId(e.target.value); setPersonaId('') }}
          sx={{ minWidth: 180 }}
        >
          {cursos.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.nombre}{c.division ? ` ${c.division}` : ''}</MenuItem>
          ))}
        </TextField>
        {boletin.alumnos.length > 0 && alumno && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              disabled={indice <= 0}
              onClick={() => setPersonaId(boletin.alumnos[indice - 1].persona_id)}
              aria-label="Alumno anterior"
            >
              <ChevronLeft />
            </IconButton>
            <TextField
              select
              label="Alumno"
              value={alumno.persona_id}
              onChange={(e) => setPersonaId(e.target.value)}
              sx={{ minWidth: 240 }}
            >
              {boletin.alumnos.map((a) => (
                <MenuItem key={a.persona_id} value={a.persona_id}>{a.apellido}, {a.nombre}</MenuItem>
              ))}
            </TextField>
            <IconButton
              disabled={indice >= boletin.alumnos.length - 1}
              onClick={() => setPersonaId(boletin.alumnos[indice + 1].persona_id)}
              aria-label="Alumno siguiente"
            >
              <ChevronRight />
            </IconButton>
          </Box>
        )}
        <FormControlLabel
          control={<Switch checked={incluirMaterias} onChange={(e) => setIncluirMaterias(e.target.checked)} />}
          label="Incluir asistencia por materia"
        />
      </Box>

      {cursoId && alumno && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          <Button variant="contained" startIcon={<Print />} onClick={() => imprimir([alumno.persona_id])}>
            Imprimir este alumno
          </Button>
          <Button variant="outlined" startIcon={<Print />} onClick={() => imprimir(boletin.alumnos.map((a) => a.persona_id))}>
            Imprimir todo el curso ({boletin.alumnos.length})
          </Button>
        </Box>
      )}

      {!cursoId ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
          <Typography>Elegí un curso para ver el boletín</Typography>
        </Box>
      ) : boletin.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : !alumno ? (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled' }}>
          <Typography>No hay alumnos en este curso</Typography>
        </Box>
      ) : (
        <>
          <Card variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
            <Typography sx={titulo}>Resumen por cuatrimestre</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Período</TableCell>
                    <TableCell sx={celdaNum}>Justificadas</TableCell>
                    <TableCell sx={celdaNum}>Injustificadas</TableCell>
                    <TableCell sx={celdaNum}>Total del período</TableCell>
                    <TableCell sx={celdaNum}>Acumulado del ciclo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resumen.map((r) => (
                    <TableRow key={r.cuatrimestre.numero}>
                      <TableCell>
                        {r.cuatrimestre.nombre}
                        <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', ml: 1 }}>
                          {formatFecha(r.cuatrimestre.desde)} al {formatFecha(r.cuatrimestre.hasta)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={celdaNum}>{formatNum(r.justificadas)}</TableCell>
                      <TableCell sx={celdaNum}>{formatNum(r.injustificadas)}</TableCell>
                      <TableCell sx={celdaNum}>{formatNum(r.total)}</TableCell>
                      <TableCell sx={{ ...celdaNum, fontWeight: 700 }}>{formatNum(r.acumulado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>

          {incluirMaterias && (
            <Card variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
              <Typography sx={titulo}>Asistencia por materia · mínimo {MINIMO_ASISTENCIA_MATERIA}%</Typography>
              {boletin.sinHorario ? (
                <Alert severity="warning">
                  Este curso no tiene horario cargado, así que no se puede calcular. Cargalo en Ciclo Lectivo → Horario.
                </Alert>
              ) : (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Materia</TableCell>
                        <TableCell sx={celdaNum}>Módulos dictados</TableCell>
                        <TableCell sx={celdaNum}>Módulos ausente</TableCell>
                        <TableCell sx={celdaNum}>Asistencia</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...(materias ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((m) => {
                        const baja = m.porcentaje < MINIMO_ASISTENCIA_MATERIA
                        return (
                          <TableRow key={m.materia_id}>
                            <TableCell>{m.nombre}</TableCell>
                            <TableCell sx={celdaNum}>{m.modulos_totales}</TableCell>
                            <TableCell sx={celdaNum}>{m.modulos_perdidos}</TableCell>
                            <TableCell sx={{ ...celdaNum, fontWeight: 700, color: baja ? 'error.main' : 'success.main' }}>
                              {formatNum(m.porcentaje)}%
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Card>
          )}

          <Card variant="outlined" sx={{ p: 2, mb: 4, borderRadius: 3 }}>
            <Typography sx={titulo}>Detalle de inasistencias</Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={cuatrimestre ?? 0}
                onChange={(_, v) => v !== null && setCuatrimestre(v === 0 ? null : v)}
              >
                <ToggleButton value={0} sx={{ textTransform: 'none' }}>Todo el ciclo</ToggleButton>
                {resumen.map((r) => (
                  <ToggleButton key={r.cuatrimestre.numero} value={r.cuatrimestre.numero} sx={{ textTransform: 'none' }}>
                    {r.cuatrimestre.nombre}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={filtro}
                onChange={(_, v) => v && setFiltro(v)}
              >
                <ToggleButton value="todas" sx={{ textTransform: 'none' }}>Todas</ToggleButton>
                <ToggleButton value="justificadas" sx={{ textTransform: 'none' }}>Justificadas</ToggleButton>
                <ToggleButton value="injustificadas" sx={{ textTransform: 'none' }}>Injustificadas</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Tipo de inasistencia</TableCell>
                    <TableCell>Justificada</TableCell>
                    <TableCell sx={celdaNum}>Valor</TableCell>
                    <TableCell sx={celdaNum}>Total acumulado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cuatrimestre !== null && (
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell colSpan={4} sx={{ fontStyle: 'italic' }}>Acumulado anterior</TableCell>
                      <TableCell sx={{ ...celdaNum, fontWeight: 700 }}>{formatNum(movs.anterior)}</TableCell>
                    </TableRow>
                  )}
                  {movs.movimientos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>
                        No hay inasistencias con estos filtros
                      </TableCell>
                    </TableRow>
                  ) : (
                    movs.movimientos.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell>{formatFecha(m.fecha)}</TableCell>
                        <TableCell>
                          {m.tipo}
                          {etiquetaTurno(m.turno) && (
                            <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 0.5 }}>
                              ({etiquetaTurno(m.turno)})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ color: m.justificada ? 'success.main' : 'text.secondary' }}>
                          {m.justificada ? 'Sí' : 'No'}
                        </TableCell>
                        <TableCell sx={celdaNum}>+{formatNum(Number(m.valor))}</TableCell>
                        <TableCell sx={{ ...celdaNum, fontWeight: 600 }}>{formatNum(m.acumulado)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow>
                    <TableCell colSpan={4} sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell sx={{ ...celdaNum, fontWeight: 700 }}>{formatNum(movs.total)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Box>
          </Card>
        </>
      )}
    </Box>
  )
}
