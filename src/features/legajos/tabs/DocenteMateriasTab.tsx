import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { Add, ContentCopy, Delete, Save } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useCiclo } from '@/contexts/CicloContext'
import { usePermisos } from '@/hooks/usePermisos'
import { formatNum } from '@/features/inasistencias/notificaciones/carta'
import { DIAS_SEMANA, diasConClase, type GrillaModulos } from '@/features/config/ciclo/grilla'
import {
  agruparPorDocente,
  controlDeCarga,
  franjaBienFormada,
  fusionarFranjas,
  limitesDeTurno,
  totalEspacios,
  validarFranjas,
  type Franja,
} from '@/features/config/ciclo/disponibilidad'
import { etiquetaCurso } from '@/features/config/ciclo/materias'
import { useCursosCiclo } from '@/features/config/ciclo/useCursosCiclo'
import { useDisponibilidadCiclo } from '@/features/config/ciclo/useDisponibilidadCiclo'
import { useAgrupamientosCiclo } from '@/features/config/ciclo/useAgrupamientosCiclo'
import { useMateriasCiclo } from '@/features/config/ciclo/useMateriasCiclo'
import type { Persona } from '../LegajoPage'

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const

interface EditorProps {
  personalId: string
  cicloId: string
  grilla: GrillaModulos | null
  guardadas: Franja[]
  necesarios: number
  puedeEditar: boolean
  onGuardado: () => void
}

function EditorDisponibilidad({ personalId, cicloId, grilla, guardadas, necesarios, puedeEditar, onGuardado }: EditorProps) {
  const queryClient = useQueryClient()
  const [franjas, setFranjas] = useState<Franja[]>(guardadas)

  const diasVisibles = useMemo(() => {
    const conClase = diasConClase(grilla, ['manana', 'tarde'])
    return DIAS_SEMANA.filter((d) => conClase.includes(d.n) || franjas.some((f) => f.dia === d.n))
  }, [grilla, franjas])

  const problema = validarFranjas(franjas)
  const control = controlDeCarga(franjas.filter(franjaBienFormada), grilla, necesarios)
  const sinGuardar = JSON.stringify(fusionarFranjas(franjas)) !== JSON.stringify(fusionarFranjas(guardadas))

  function cambiar(indice: number, cambio: Partial<Franja>) {
    setFranjas((actual) => actual.map((f, i) => (i === indice ? { ...f, ...cambio } : f)))
  }

  function agregar(dia: number, base?: { desde: string; hasta: string }) {
    const nueva = { dia, desde: base?.desde ?? '', hasta: base?.hasta ?? '' }
    // Una franja armada a partir de un turno se une con lo que ya había ese día
    setFranjas((actual) => (base ? fusionarFranjas([...actual, nueva]) : [...actual, nueva]))
  }

  function copiarALosDemasDias(dia: number) {
    setFranjas((actual) => [
      ...actual.filter((f) => f.dia === dia || f.dia === 6),
      ...DIAS_SEMANA.filter((d) => d.n !== dia && d.n <= 5).flatMap((d) =>
        actual.filter((f) => f.dia === dia).map((f) => ({ ...f, dia: d.n })),
      ),
    ])
  }

  const guardarMutation = useMutation({
    mutationFn: async () => {
      const filas = franjas.map(({ dia, desde, hasta }) => ({ dia, desde, hasta }))
      const { error } = await supabase.rpc('guardar_disponibilidad_docente', { p_ciclo: cicloId, p_personal: personalId, p_filas: filas })
      if (error) throw error
    },
    onSuccess: async () => {
      toast.success('Disponibilidad guardada')
      await queryClient.invalidateQueries({ queryKey: ['disponibilidad', cicloId] })
      onGuardado()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function guardar() {
    if (problema) {
      toast.error(problema)
      return
    }
    guardarMutation.mutate()
  }

  return (
    <Box>
      {franjas.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Sin disponibilidad cargada: se asume que puede dar clase en cualquier horario. Cargá los rangos en los que
          puede para que el horario los respete.
        </Alert>
      ) : control.estado === 'no_alcanza' ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Necesita {formatNum(control.necesarios)} módulos por semana, pero solo está disponible en {control.disponibles} de los{' '}
          {totalEspacios(grilla)} espacios: no se le puede armar el horario completo.
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: 2 }}>
          Está disponible en {control.disponibles} de los {totalEspacios(grilla)} espacios y necesita {formatNum(control.necesarios)}.
        </Alert>
      )}

      {diasVisibles.map((d) => {
        const delDia = franjas.map((f, i) => ({ f, i })).filter((x) => x.f.dia === d.n)
        const manana = limitesDeTurno(grilla, 'manana', d.n)
        const tarde = limitesDeTurno(grilla, 'tarde', d.n)
        return (
          <Box key={d.n} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
            <Typography sx={{ width: 84, flexShrink: 0, fontWeight: 600, fontSize: 14 }}>{d.label}</Typography>
            <Box sx={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
              {delDia.map(({ f, i }) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TextField
                    size="small"
                    type="time"
                    value={f.desde}
                    disabled={!puedeEditar}
                    onChange={(e) => cambiar(i, { desde: e.target.value })}
                    slotProps={{ htmlInput: { 'aria-label': `Desde, ${d.label}` } }}
                    sx={{ width: 120 }}
                  />
                  <Typography variant="body2">a</Typography>
                  <TextField
                    size="small"
                    type="time"
                    value={f.hasta}
                    disabled={!puedeEditar}
                    onChange={(e) => cambiar(i, { hasta: e.target.value })}
                    slotProps={{ htmlInput: { 'aria-label': `Hasta, ${d.label}` } }}
                    sx={{ width: 120 }}
                  />
                  <IconButton size="small" color="error" disabled={!puedeEditar} onClick={() => setFranjas((a) => a.filter((_, j) => j !== i))} aria-label={`Quitar la franja del ${d.label}`}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              {delDia.length === 0 && <Typography variant="caption" color="text.disabled">No disponible</Typography>}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Button size="small" disabled={!puedeEditar || !manana} onClick={() => manana && agregar(d.n, manana)}>Mañana</Button>
              <Button size="small" disabled={!puedeEditar || !tarde} onClick={() => tarde && agregar(d.n, tarde)}>Tarde</Button>
              <Tooltip title="Agregar una franja">
                <span>
                  <IconButton size="small" color="primary" disabled={!puedeEditar} onClick={() => agregar(d.n)} aria-label={`Agregar una franja el ${d.label}`}>
                    <Add fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              {d.n <= 5 && (
                <Tooltip title="Copiar este día a los demás días de lunes a viernes">
                  <span>
                    <IconButton size="small" disabled={!puedeEditar || delDia.length === 0} onClick={() => copiarALosDemasDias(d.n)} aria-label={`Copiar el ${d.label} a los demás días`}>
                      <ContentCopy fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Box>
          </Box>
        )
      })}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Los botones Mañana y Tarde cargan el turno completo de ese día, según los espacios de Ciclo Lectivo → Horario.
      </Typography>

      {problema && <Alert severity="error" sx={{ mt: 2 }}>{problema}</Alert>}

      {puedeEditar ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
          <Button disabled={!sinGuardar} onClick={() => setFranjas(guardadas)}>Descartar los cambios</Button>
          <Button
            variant="contained"
            disabled={!sinGuardar || guardarMutation.isPending}
            startIcon={guardarMutation.isPending ? <CircularProgress size={18} /> : <Save />}
            onClick={guardar}
          >
            Guardar la disponibilidad
          </Button>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          La disponibilidad la carga quien puede editar Ciclo Lectivo.
        </Typography>
      )}
    </Box>
  )
}

/** Las materias que dicta un docente y su disponibilidad horaria: lo que necesita el horario para ubicarlo. */
export function DocenteMateriasTab({ persona }: { persona: Persona }) {
  const { ciclo, cicloId } = useCiclo()
  const { puedeEditar } = usePermisos()
  const { data: cursos = [] } = useCursosCiclo()
  const { data: materiasCiclo } = useMateriasCiclo()
  const { agrupamientos, porMateria } = useAgrupamientosCiclo()
  const { data: disponibilidad } = useDisponibilidadCiclo()
  const [version, setVersion] = useState(0)

  const personalId = persona.id

  // Sus clases: las materias que dicta por su cuenta y los grupos de agrupamientos. Un agrupamiento en varios cursos es una
  // sola clase, así que cuenta una vez aunque figure en cada curso.
  const clasesDelDocente = useMemo(() => {
    const filas = materiasCiclo?.filas ?? []
    const clases: { clave: string; nombre: string; detalle: string; horas: number | null }[] = []
    for (const m of filas) {
      if (m.personal_id !== personalId || porMateria.has(m.id)) continue
      const curso = cursos.find((c) => c.id === m.curso_id)
      clases.push({ clave: m.id, nombre: m.nombre, detalle: curso ? etiquetaCurso(curso) : '', horas: m.horas_semanales != null ? Number(m.horas_semanales) : null })
    }
    for (const a of agrupamientos) {
      const grupos = a.grupos.filter((g) => g.personal_id === personalId)
      if (grupos.length === 0) continue
      const materiasDelAgrupamiento = filas.filter((m) => a.materias.includes(m.id))
      const cursosDelAgrupamiento = materiasDelAgrupamiento
        .map((m) => cursos.find((c) => c.id === m.curso_id))
        .filter((c) => !!c)
        .map((c) => etiquetaCurso(c))
      const horas = materiasDelAgrupamiento[0]?.horas_semanales
      clases.push({
        clave: a.id,
        nombre: `${a.nombre} · grupo ${grupos.map((g) => g.nombre).join(' y ')}`,
        detalle: cursosDelAgrupamiento.join(', '),
        horas: horas != null ? Number(horas) : null,
      })
    }
    return clases
  }, [materiasCiclo, personalId, agrupamientos, porMateria, cursos])
  const totalModulos = clasesDelDocente.reduce((suma, c) => suma + (c.horas ?? 0), 0)
  const franjasGuardadas = useMemo(
    () => (personalId ? agruparPorDocente(disponibilidad?.filas ?? []).get(personalId) ?? [] : []),
    [disponibilidad, personalId],
  )

  if (!ciclo || !cicloId) return <Alert severity="warning">Primero creá un ciclo lectivo en Configuración → Ciclo Lectivo.</Alert>

  return (
    <>
      <Card sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" sx={titulo}>Materias que dicta</Typography>
        {clasesDelDocente.length === 0 ? (
          <Typography variant="body2" color="text.disabled">
            Todavía no tiene materias asignadas. Se asignan en Ciclo Lectivo → Materias, o como docente de un grupo en Agrupamientos.
          </Typography>
        ) : (
          <>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {clasesDelDocente.map((c) => (
                <Typography key={c.clave} component="li" variant="body2" sx={{ py: 0.125 }}>
                  {c.nombre}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {c.detalle ? ` · ${c.detalle}` : ''}
                    {c.horas != null ? ` · ${formatNum(c.horas)} módulos por semana` : ''}
                  </Typography>
                </Typography>
              ))}
            </Box>
            <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
              Total: {formatNum(totalModulos)} módulos por semana
            </Typography>
          </>
        )}
      </Card>

      <Card sx={{ p: 3 }}>
        <Typography variant="subtitle2" sx={titulo}>Disponibilidad horaria</Typography>
        {disponibilidad && !disponibilidad.disponible ? (
          <Alert severity="warning">Falta correr la migración 018 en Supabase para cargar la disponibilidad.</Alert>
        ) : (
          <EditorDisponibilidad
            key={`${personalId}:${version}`}
            personalId={personalId}
            cicloId={cicloId}
            grilla={ciclo.grilla_modulos ?? null}
            guardadas={franjasGuardadas}
            necesarios={totalModulos}
            puedeEditar={puedeEditar('ciclo')}
            onGuardado={() => setVersion((v) => v + 1)}
          />
        )}
      </Card>
    </>
  )
}
