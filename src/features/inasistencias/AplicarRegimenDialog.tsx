import { toast } from 'sonner'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import type { Regimen } from './regimenes'
import { useAplicarRegimen } from './useRegimen'

interface Props {
  /** El régimen a aplicar; sin régimen el diálogo está cerrado. */
  regimen: Regimen | null
  /** Cambia los textos cuando se vuelve a los valores de un régimen ya elegido. */
  restaurar?: boolean
  onClose: () => void
}

export function AplicarRegimenDialog({ regimen, restaurar = false, onClose }: Props) {
  const aplicar = useAplicarRegimen()

  function confirmar() {
    if (!regimen) return
    aplicar.mutate(regimen, {
      onSuccess: () => {
        toast.success(restaurar ? 'Se restauraron los valores del régimen' : `Se aplicaron los valores del régimen de ${regimen.nombre}`)
        onClose()
      },
      onError: (e) => toast.error('Error: ' + e.message),
    })
  }

  return (
    <Dialog open={!!regimen} onClose={() => !aplicar.isPending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{restaurar ? 'Restaurar los valores del régimen' : 'Aplicar los valores del régimen'}</DialogTitle>
      {regimen && (
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle2">{regimen.nombre}</Typography>
          <Typography variant="body2">{regimen.descripcion}</Typography>
          <Typography variant="caption" color="text.secondary">Fuente: {regimen.fuente}</Typography>
          {regimen.aVerificar && (
            <Alert severity="warning">
              Estos valores salen de textos compartidos por el equipo y todavía no se contrastaron con la resolución
              vigente. Verificalos antes de usarlos.
            </Alert>
          )}
          <Alert severity="info">
            Reemplaza los tipos de inasistencia (conserva las teclas), las reglas de regularidad, las reglas de aviso
            (conserva sus mensajes) y el permiso de reincorporaciones. No cambia los textos de la carta ni las fechas de
            Ciclo Lectivo.
          </Alert>
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>Todavía no cubre</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {regimen.limitaciones.map((limitacion) => (
                <Typography key={limitacion} component="li" variant="body2" color="text.secondary">{limitacion}</Typography>
              ))}
            </Box>
          </Box>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={aplicar.isPending}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={aplicar.isPending}
          startIcon={aplicar.isPending ? <CircularProgress size={18} /> : undefined}
          onClick={confirmar}
        >
          {restaurar ? 'Restaurar' : 'Aplicar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
