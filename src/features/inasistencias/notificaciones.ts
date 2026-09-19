export interface NotificacionInasistencia {
  limite: number
  mensaje: string
  notificar_padres: boolean
}

export function notificacionesCruzadas(
  notificaciones: NotificacionInasistencia[],
  antes: number,
  despues: number,
): NotificacionInasistencia[] {
  return notificaciones
    .filter((n) => despues >= n.limite && antes < n.limite)
    .sort((a, b) => a.limite - b.limite)
}
