import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Card from '@mui/material/Card'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { ArrowBack, DeleteForever } from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type Modo = 'legajos' | 'todo'

const FRASE = 'BORRAR TODO'

const MODOS: { value: Modo; titulo: string; borra: string; conserva: string }[] = [
  {
    value: 'legajos',
    titulo: 'Solo legajos de alumnos',
    borra:
      'Alumnos y adultos responsables, con sus inasistencias, notificaciones, reincorporaciones, pases, cursos adicionales y grupos.',
    conserva: 'Personal, institución, configuración, ciclo lectivo, cursos, materias y horario.',
  },
  {
    value: 'todo',
    titulo: 'Todo',
    borra:
      'Todo lo anterior y además personal, datos de la institución, configuración de inasistencias, permisos y ciclos lectivos con sus cursos, materias, horario y agrupamientos.',
    conserva: 'Solo tu propio legajo, con tu rol de administrador, para que puedas seguir entrando.',
  },
]

export function ReiniciarDatosPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { personal } = useAuth()
  const [modo, setModo] = useState<Modo>('legajos')
  const [frase, setFrase] = useState('')

  // Llamada que siempre falla antes de borrar nada: sirve para saber si ya se corrió la migración 022
  const disponibleQ = useQuery({
    queryKey: ['reiniciar-datos-disponible'],
    retry: false,
    queryFn: async () => {
      const { error } = await supabase.rpc('reiniciar_datos', { p_modo: '', p_confirmacion: '' })
      return !(error && /could not find|schema cache/i.test(error.message))
    },
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('reiniciar_datos', { p_modo: modo, p_confirmacion: frase })
      if (error) throw error
      return data as { alumnos: number; responsables: number; otras_personas: number; ciclos: number }
    },
    onSuccess: (r) => {
      setFrase('')
      if (modo === 'todo') {
        toast.success('Se borraron todos los datos')
        // El ciclo lectivo activo y la institución ya no existen: se recarga la app desde cero
        window.location.assign('/')
        return
      }
      toast.success(`Se borraron ${r.alumnos} alumnos y ${r.responsables} adultos responsables`)
      queryClient.invalidateQueries()
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  if (personal && personal.rol !== 'admin') return <Navigate to="/" replace />

  const elegido = MODOS.find((m) => m.value === modo)!
  const fraseOk = frase === FRASE

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h5">Reiniciar datos</Typography>
      </Box>

      {disponibleQ.data === false && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Falta correr la migración 022 (reiniciar datos) en Supabase. Hasta entonces no se puede usar.
        </Alert>
      )}

      <Alert severity="error" sx={{ mb: 3 }}>
        El borrado es <strong>definitivo</strong>: no se puede deshacer. Si querés conservar algo, exportalo antes.
      </Alert>

      <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
          Qué querés borrar
        </Typography>
        <RadioGroup value={modo} onChange={(e) => setModo(e.target.value as Modo)}>
          {MODOS.map((m) => (
            <FormControlLabel
              key={m.value}
              value={m.value}
              control={<Radio />}
              label={
                <Box sx={{ py: 1 }}>
                  <Typography sx={{ fontWeight: 600 }}>{m.titulo}</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    <strong>Borra:</strong> {m.borra}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    <strong>Conserva:</strong> {m.conserva}
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', '& .MuiRadio-root': { mt: 0.5 } }}
            />
          ))}
        </RadioGroup>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
          Las fotos, el logo y las firmas subidos quedan guardados en el almacenamiento de archivos.
        </Typography>
      </Card>

      <Card variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 3, borderColor: 'error.light' }}>
        <Typography sx={{ mb: 2 }}>
          Para confirmar, escribí <strong>{FRASE}</strong> en mayúsculas:
        </Typography>
        <TextField
          fullWidth
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          placeholder={FRASE}
          autoComplete="off"
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          color="error"
          size="large"
          startIcon={mutation.isPending ? <CircularProgress size={18} color="inherit" /> : <DeleteForever />}
          disabled={!fraseOk || mutation.isPending || disponibleQ.data === false}
          onClick={() => mutation.mutate()}
        >
          Borrar: {elegido.titulo.toLowerCase()}
        </Button>
      </Card>
    </Box>
  )
}
