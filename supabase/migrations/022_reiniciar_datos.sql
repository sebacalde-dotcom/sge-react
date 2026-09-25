-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 022: reiniciar datos
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * reiniciar_datos(p_modo, p_confirmacion): borrado DEFINITIVO, solo para el rol
--    admin (no directivo) y solo si la confirmación es exactamente 'BORRAR TODO'.
--  * Modo 'legajos': borra los alumnos y los adultos responsables sin acceso al
--    sistema, con todo lo que cuelga de ellos (datos del alumno, cursos
--    adicionales, grupos, inasistencias, notificaciones, reincorporaciones, pases,
--    retiros, autorizaciones y ficha médica). Conserva el personal, la institución,
--    la configuración, el ciclo lectivo, cursos, materias y horario.
--  * Modo 'todo': además borra todo el resto (personal, institución, configuración,
--    permisos, ciclos lectivos con sus cursos, materias, horario, disponibilidad y
--    agrupamientos). Solo queda el legajo de quien lo ejecuta, con su rol de admin,
--    para no quedar afuera del sistema.
--  * Todo corre en una sola transacción: si algo falla no se borra nada.
--  * Los archivos subidos (fotos, logo, firma) quedan en Storage: SQL no los borra.
-- ═════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.reiniciar_datos(p_modo text, p_confirmacion text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_yo uuid;
  v_alumnos int := 0;
  v_responsables int := 0;
  v_personas int := 0;
  v_ciclos int := 0;
begin
  if public.rol_actual() is distinct from 'admin' then
    raise exception 'Solo el rol administrador puede reiniciar los datos';
  end if;
  if p_confirmacion is distinct from 'BORRAR TODO' then
    raise exception 'La frase de confirmación no coincide';
  end if;
  if p_modo not in ('legajos', 'todo') then
    raise exception 'Modo desconocido: %', p_modo;
  end if;

  select id into v_yo from personas where auth_user_id = auth.uid() limit 1;

  -- ── Legajos de alumnos y adultos responsables (los dos modos) ──────────────
  -- Borrar la persona arrastra en cascada sus datos, vínculos, grupos,
  -- inasistencias, notificaciones, reincorporaciones, pases, retiros y fichas.
  with borrados as (
    delete from personas p
    where p.id is distinct from v_yo
      and p.rol is null
      and (p.tipo = 'alumno' or exists (select 1 from alumno_datos d where d.persona_id = p.id))
    returning 1
  )
  select count(*) into v_alumnos from borrados;

  with borrados as (
    delete from personas p
    where p.id is distinct from v_yo and p.rol is null and p.tipo = 'padre'
    returning 1
  )
  select count(*) into v_responsables from borrados;

  if p_modo = 'todo' then
    -- Registros que apuntan a personal sin borrado en cascada
    delete from inasistencias;
    delete from notificaciones_inasistencia;
    delete from reincorporaciones;
    delete from pases;

    -- Tablas de un modelo anterior que la app ya no usa (asistencia y sanciones
    -- no se borran en cascada desde el ciclo, pero sí desde alumnos)
    if to_regclass('public.alumnos') is not null then
      delete from alumnos;
    end if;
    if to_regclass('public.sanciones') is not null then
      delete from sanciones;
    end if;
    if to_regclass('public.asistencia') is not null then
      delete from asistencia;
    end if;

    -- Ciclos lectivos: arrastran secciones, cursos, materias, horario,
    -- disponibilidad docente y agrupamientos
    with borrados as (delete from ciclos returning 1)
    select count(*) into v_ciclos from borrados;

    -- Todo el resto de las personas, menos quien lo ejecuta
    with borrados as (delete from personas where id is distinct from v_yo returning 1)
    select count(*) into v_personas from borrados;

    delete from config;
    if to_regclass('public.permisos_configuracion') is not null then
      delete from permisos_configuracion;
    end if;
  end if;

  return jsonb_build_object(
    'alumnos', v_alumnos,
    'responsables', v_responsables,
    'otras_personas', v_personas,
    'ciclos', v_ciclos
  );
end $$;

revoke all on function public.reiniciar_datos(text, text) from public;
grant execute on function public.reiniciar_datos(text, text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe devolver una fila con "reiniciar_datos"
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'reiniciar_datos';
