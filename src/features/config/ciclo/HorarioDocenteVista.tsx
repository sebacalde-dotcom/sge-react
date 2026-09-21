import { useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useCiclo } from '@/contexts/CicloContext'
import { agruparPorDocente, puedeDarClase } from './disponibilidad'
import { DIAS_SEMANA, TURNOS, diasConClase, modulosDelDia } from './grilla'
import { claveCelda, superposicionesDeDocentes, type ColocacionConDocente } from './horario'
import { etiquetaCurso } from './materias'
import { useCursosCiclo } from './useCursosCiclo'
import { useDisponibilidadCiclo } from './useDisponibilidadCiclo'
import { useHorarioCiclo } from './useHorarioCiclo'
import { useMateriasCiclo } from './useMateriasCiclo'

/** El horario de un docente en todos los cursos, para revisar su carga y sus superposiciones. Solo lectura. */
export function HorarioDocenteVista() {
  const { ciclo } = useCiclo()
  const { data: cursos = [] } = useCursosCiclo()
  const { data: materiasCiclo } = useMateriasCiclo()
  const { data: horario } = useHorarioCiclo()
  const { data: disponibilidadCiclo } = useDisponibilidadCiclo()
  const grilla = ciclo?.grilla_modulos ?? null
  const [docenteId, setDocenteId] = useState('')

  const filasMaterias = useMemo(() => materiasCiclo?.filas ?? [], [materiasCiclo])

  const docentes = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const m of filasMaterias) if (m.personal_id && m.personal) mapa.set(m.personal_id, `${m.personal.apellido}, ${m.personal.nombre}`)
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, nombre]) => ({ id, nombre }))
  }, [filasMaterias])

  const materiaPorId = useMemo(() => new Map(filasMaterias.map((m) => [m.id, m])), [filasMaterias])
  const cursoPorId = useMemo(() => new Map(cursos.map((c) => [c.id, c])), [cursos])

  const colocaciones = useMemo(() => {
    const lista: ColocacionConDocente[] = []
    for (const f of horario?.filas ?? []) {
      const materia = materiaPorId.get(f.materia_id)
      if (materia) lista.push({ ...f, personal_id: materia.personal_id })
    }
    return lista
  }, [horario, materiaPorId])

  const superposiciones = useMemo(() => superposicionesDeDocentes(colocaciones), [colocaciones])
  const franjasPorDocente = useMemo(() => agruparPorDocente(disponibilidadCiclo?.filas ?? []), [disponibilidadCiclo])

  if (horario && !horario.disponible) {
    return <Alert severity="warning">Falta correr la migración 016 en Supabase para ver el horario de los docentes.</Alert>
  }
  if (docentes.length === 0) {
    return <Alert severity="info">Todavía no hay materias con docente asignado. Asignalos en la pestaña Materias.</Alert>
  }

  const docente = docentes.find((d) => d.id === docenteId) ?? docentes[0]
  const delDocente = colocaciones.filter((c) => c.personal_id === docente.id)
  const conflictosDelDocente = superposiciones.filter((s) => s.personal_id === docente.id)
  const enConflicto = new Set(conflictosDelDocente.map((s) => claveCelda(s.turno, s.dia, s.modulo)))
  const franjas = franjasPorDocente.get(docente.id)
  const fueraDeDisponibilidad = new Set(
    delDocente.filter((c) => puedeDarClase(franjas, grilla, c.turno, c.dia, c.modulo) === false).map((c) => claveCelda(c.turno, c.dia, c.modulo)),
  )
  const turnosConClases = TURNOS.filter((t) => delDocente.some((c) => c.turno === t.value))
  const diasVisibles = DIAS_SEMANA.filter((d) => diasConClase(grilla, turnosConClases.map((t) => t.value)).includes(d.n))

  return (
    <>
      {superposiciones.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Hay {superposiciones.length} {superposiciones.length === 1 ? 'superposición' : 'superposiciones'} de docentes en el
          horario de la escuela. Se ven marcadas en el horario de cada docente.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField select size="small" label="Docente" value={docente.id} onChange={(e) => setDocenteId(e.target.value)} sx={{ minWidth: 280 }}>
          {docentes.map((d) => (
            <MenuItem key={d.id} value={d.id}>{d.nombre}</MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary">
          {delDocente.length} {delDocente.length === 1 ? 'módulo' : 'módulos'} por semana
        </Typography>
        {conflictosDelDocente.length > 0 && (
          <Chip size="small" color="error" label={`${conflictosDelDocente.length} superposición${conflictosDelDocente.length === 1 ? '' : 'es'}`} />
        )}
        {fueraDeDisponibilidad.size > 0 && (
          <Chip size="small" color="warning" label={`${fueraDeDisponibilidad.size} fuera de su disponibilidad`} />
        )}
      </Box>

      {turnosConClases.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.disabled">Este docente todavía no tiene módulos en el horario</Typography>
        </Card>
      ) : (
        turnosConClases.map((turno) => {
          const maxModulos = Math.max(0, ...diasVisibles.map((d) => modulosDelDia(grilla, turno.value, d.n).length))
          return (
            <Card key={turno.value} sx={{ p: 2, mb: 2, overflowX: 'auto' }}>
              <Typography variant="subtitle2" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' }}>
                Turno {turno.label.toLowerCase()}
              </Typography>
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
                        if (modulo > modulosDelDia(grilla, turno.value, d.n).length) {
                          return <TableCell key={d.n} sx={{ bgcolor: 'action.hover', p: 0.5 }} />
                        }
                        const clave = claveCelda(turno.value, d.n, modulo)
                        const aca = delDocente.filter((c) => c.turno === turno.value && c.dia === d.n && c.modulo === modulo)
                        return (
                          <TableCell
                            key={d.n}
                            align="center"
                            sx={{
                              p: 0.5,
                              bgcolor: enConflicto.has(clave)
                                ? 'error.light'
                                : fueraDeDisponibilidad.has(clave)
                                  ? 'warning.light'
                                  : aca.length > 0
                                    ? 'action.selected'
                                    : 'transparent',
                            }}
                          >
                            {aca.map((c) => (
                              <Box key={`${c.curso_id}-${c.materia_id}`} sx={{ py: 0.25 }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                                  {materiaPorId.get(c.materia_id)?.nombre}
                                </Typography>
                                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                                  {cursoPorId.get(c.curso_id) ? etiquetaCurso(cursoPorId.get(c.curso_id)!) : ''}
                                </Typography>
                              </Box>
                            ))}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
        })
      )}
    </>
  )
}
