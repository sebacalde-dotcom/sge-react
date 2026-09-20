import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import { Gavel } from '@mui/icons-material'
import { useAuth } from '@/contexts/AuthContext'
import { esAdmin } from '@/lib/permisos'
import { AplicarRegimenDialog } from './AplicarRegimenDialog'
import { useDiferenciasConRegimen, useRegimen } from './useRegimen'

const titulo = { mb: 2, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem', color: 'text.secondary' } as const

/** Muestra el régimen que rige, si la configuración de inasistencias coincide con él y permite volver a sus valores. */
export function RegimenDelCiclo() {
  const navigate = useNavigate()
  const { personal } = useAuth()
  const { regimen, origen } = useRegimen()
  const diferencias = useDiferenciasConRegimen(regimen)
  const [restaurando, setRestaurando] = useState(false)
  const puedeRestaurar = esAdmin(personal?.rol)

  return (
    <Card variant="outlined" sx={{ p: 3, mb: 3, borderRadius: 3 }}>
      <Typography variant="subtitle2" sx={titulo}>Régimen del ciclo</Typography>

      {!regimen ? (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Todavía no hay un régimen elegido. Las reglas de asistencia se cargan a mano. Elegí el régimen del ciclo en
            Ciclo Lectivo (o la jurisdicción de la escuela en Institución) para cargar de una vez los valores de la
            normativa.
          </Alert>
          <Button variant="outlined" startIcon={<Gavel />} onClick={() => navigate('/config/ciclo')}>
            Elegir el régimen
          </Button>
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{regimen.nombre}</Typography>
            <Chip
              size="small"
              variant="outlined"
              label={origen === 'ciclo' ? 'Elegido en Ciclo Lectivo' : 'Por la jurisdicción de la institución'}
            />
            {regimen.aVerificar && <Chip size="small" color="warning" variant="outlined" label="Valores a verificar" />}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Fuente: {regimen.fuente}
          </Typography>

          {diferencias.length === 0 ? (
            <Alert severity="success" sx={{ mb: 2 }}>La configuración coincide con los valores del régimen.</Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              La configuración no coincide con los valores del régimen ({diferencias.join(', ')}). Puede ser que la hayas
              ajustado a propósito o que todavía no se hayan aplicado.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {puedeRestaurar && (
              <Button variant="outlined" onClick={() => setRestaurando(true)}>
                {diferencias.length === 0 ? 'Volver a aplicar los valores' : 'Restaurar los valores del régimen'}
              </Button>
            )}
            <Button onClick={() => navigate('/config/ciclo')}>Cambiar el régimen</Button>
          </Box>
        </>
      )}

      <AplicarRegimenDialog regimen={restaurando ? (regimen ?? null) : null} restaurar onClose={() => setRestaurando(false)} />
    </Card>
  )
}
