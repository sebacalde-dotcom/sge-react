-- ═════════════════════════════════════════════════════════════════════════
-- Vinculación segura del usuario de Auth con su fila de personal
--
-- Problema: la política RLS de escritura sobre `personal` exige es_staff(),
-- que a su vez requiere que auth_user_id ya esté vinculado. En el primer
-- login esto crea un bloqueo circular (huevo/gallina).
--
-- Solución: una función SECURITY DEFINER (corre con permisos del owner, saltea
-- RLS) que vincula la fila SOLO si el email coincide y aún no está vinculada.
-- ═════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.link_current_user()
RETURNS void AS $$
BEGIN
  UPDATE personal
  SET auth_user_id = auth.uid()
  WHERE lower(mail) = lower(auth.jwt() ->> 'email')
    AND auth_user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que cualquier usuario autenticado la ejecute
GRANT EXECUTE ON FUNCTION public.link_current_user() TO authenticated;
