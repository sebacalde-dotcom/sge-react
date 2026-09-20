import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import { ArrowBack } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { PhotoUpload } from '@/components/shared/PhotoUpload'
import { formatFecha } from '@/features/inasistencias/notificaciones/carta'
import { textoCurso, useAlumnoAcademico } from '@/features/alumnos/useAlumnoAcademico'
import { LegajoAcciones } from './LegajoAcciones'
import type { Persona } from './LegajoPage'

const TAMANO_FOTO = 76

function FotoPersona({ persona }: { persona: Persona }) {
  const queryClient = useQueryClient()

  const fotoMutation = useMutation({
    mutationFn: async (url: string) => {
      const { data, error } = await supabase.from('personas').update({ foto_url: url }).eq('id', persona.id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('No se pudo guardar la foto (sin permisos en la base)')
    },
    onSuccess: () => {
      toast.success('Foto actualizada')
      queryClient.invalidateQueries({ queryKey: ['persona', persona.id] })
      queryClient.invalidateQueries({ queryKey: ['personas'] })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  return (
    <Box sx={{ flexShrink: 0 }}>
      <PhotoUpload
        bucket="avatars"
        currentUrl={persona.foto_url}
        onUploaded={(url) => fotoMutation.mutate(url)}
        shape="circle"
        size={TAMANO_FOTO}
      />
    </Box>
  )
}

function DatosAlumno({ persona }: { persona: Persona }) {
  const { alumnoDatos, situacion, reincorporaciones, emergencia, cursosAdicionales } = useAlumnoAcademico(persona.id)
  const curso = alumnoDatos?.cursos

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label="Alumno" size="small" variant="outlined" />
        <Chip label={persona.dni ? `Legajo N° ${persona.dni}` : 'Legajo sin DNI'} size="small" variant="outlined" />
        <Chip
          label={curso ? `${curso.secciones?.nombre ?? 'Sin sección'} · ${textoCurso(curso)}` : 'Sin curso asignado'}
          size="small"
          variant="outlined"
        />
        {cursosAdicionales.map((a) =>
          a.cursos ? (
            <Chip
              key={a.id}
              label={`${a.cursos.secciones?.nombre ?? 'Sin sección'} · ${textoCurso(a.cursos)}`}
              size="small"
              variant="outlined"
            />
          ) : null,
        )}
        {situacion && <Chip label={situacion.etiqueta} size="small" color={situacion.color} />}
      </Box>
      <Box sx={{ mt: 0.75 }}>
        {situacion?.detalle && (
          <Typography variant="body2" color="text.secondary">{situacion.etiqueta}: {situacion.detalle}</Typography>
        )}
        {reincorporaciones.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Reincorporado/a: {reincorporaciones.map(formatFecha).join(', ')}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Contacto de emergencia:{' '}
          {emergencia
            ? `${emergencia.nombre} (${emergencia.relacion})${emergencia.telefono ? ` · ${emergencia.telefono}` : ''}`
            : 'sin cargar'}
        </Typography>
      </Box>
    </>
  )
}

export function LegajoEncabezado({
  persona,
  titulo,
  tipo,
  tipoLabel,
  esAlumno,
  onVolver,
}: {
  persona: Persona | null
  titulo: string
  tipo: string
  tipoLabel: string
  esAlumno: boolean
  onVolver: () => void
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
      <IconButton onClick={onVolver}>
        <ArrowBack />
      </IconButton>
      {persona ? (
        <FotoPersona persona={persona} />
      ) : (
        <Avatar sx={{ width: TAMANO_FOTO, height: TAMANO_FOTO, bgcolor: 'action.hover' }} />
      )}
      <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
        <Typography variant="h5">{titulo}</Typography>
        {persona && esAlumno ? (
          <DatosAlumno persona={persona} />
        ) : (
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Chip label={tipoLabel} size="small" variant="outlined" data-tipo={tipo} />
            {persona?.dni && <Chip label={`DNI ${persona.dni}`} size="small" variant="outlined" />}
          </Box>
        )}
      </Box>
      {persona && <LegajoAcciones persona={persona} />}
    </Box>
  )
}
