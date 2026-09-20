-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 011: archivar y eliminar legajos
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * Archivar: para cuando un alumno se va o egresa, o un docente/preceptor deja
--    la institución. El legajo deja de aparecer en las listas, planillas y
--    tareas, pero se conserva todo y se puede restaurar. Si es personal, también
--    pierde el acceso al sistema (y lo recupera al restaurar). Solo admin y directivos.
--  * Eliminar: borrado DEFINITIVO, solo de legajos ya archivados y solo por
--    admin y directivos. Arrastra en cascada las inasistencias, notificaciones,
--    pases y reincorporaciones de la persona, y los adultos responsables que
--    no lo sean de ningún otro alumno. El personal (docentes, preceptores,
--    directivos) solo se archiva: no se elimina, para conservar su historial.
-- ═════════════════════════════════════════════════════════════════════════

begin;

alter table personas add column if not exists archivado_at timestamptz;
create index if not exists idx_personas_archivados on personas(archivado_at) where archivado_at is not null;

-- Desde la API solo admin y directivos pueden cambiar el archivado
-- (el SQL Editor no tiene sesión de usuario y no se ve afectado)
create or replace function public.proteger_archivado_persona()
returns trigger
language plpgsql as $$
begin
  if new.archivado_at is distinct from old.archivado_at
     and auth.uid() is not null
     and not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden archivar legajos';
  end if;
  return new;
end $$;

drop trigger if exists trg_personas_proteger_archivado on personas;
create trigger trg_personas_proteger_archivado
  before update on personas
  for each row execute function public.proteger_archivado_persona();

-- Un borrado directo por la API solo se permite a admin/directivos y sobre legajos archivados
drop policy if exists "personas_delete_archivados" on personas;
create policy "personas_delete_archivados" on personas
  as restrictive for delete to authenticated
  using (public.es_admin() and archivado_at is not null);

-- ── Archivar ─────────────────────────────────────────────────────────────
-- En alumnos, el estado pasa a 'archivado': así todas las planillas, tareas y
-- el cálculo de regularidad (que solo miran estado = 'activo') lo ignoran.
create or replace function public.archivar_legajo(p_persona uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden archivar legajos';
  end if;
  if not exists (select 1 from personas where id = p_persona) then
    raise exception 'El legajo no existe';
  end if;
  if exists (select 1 from personal where persona_id = p_persona and auth_user_id = auth.uid()) then
    raise exception 'No podés archivar tu propio legajo';
  end if;
  update personas set archivado_at = coalesce(archivado_at, now()) where id = p_persona;
  update alumno_datos set estado = 'archivado' where persona_id = p_persona;
  -- Docentes, preceptores y directivos que se van: también pierden el acceso al sistema
  update personal set eliminado = true where persona_id = p_persona;
end $$;

-- ── Restaurar ────────────────────────────────────────────────────────────
create or replace function public.desarchivar_legajo(p_persona uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden restaurar legajos';
  end if;
  update personas set archivado_at = null where id = p_persona;
  update alumno_datos
  set estado = case
    when exists (select 1 from pases where persona_id = p_persona and anulado_at is null) then 'pase'
    else 'activo'
  end
  where persona_id = p_persona and estado = 'archivado';
  update personal set eliminado = false where persona_id = p_persona;
end $$;

-- ── Eliminar (definitivo) ────────────────────────────────────────────────
create or replace function public.eliminar_legajo(p_persona uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_huerfanos uuid[];
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden eliminar legajos';
  end if;
  if not exists (select 1 from personas where id = p_persona and archivado_at is not null) then
    raise exception 'Solo se pueden eliminar legajos archivados';
  end if;
  if exists (select 1 from personal where persona_id = p_persona) then
    raise exception 'El personal (docentes, preceptores, directivos) se archiva pero no se elimina, para conservar el historial de lo que registró';
  end if;

  -- Adultos responsables que no lo son de ningún otro alumno (se buscan antes de borrar,
  -- porque el borrado en cascada elimina los vínculos)
  select coalesce(array_agg(r.responsable_persona_id), '{}') into v_huerfanos
  from alumno_responsables r
  join personas p on p.id = r.responsable_persona_id
  where r.alumno_persona_id = p_persona
    and p.tipo = 'padre'
    and not exists (
      select 1 from alumno_responsables o
      where o.responsable_persona_id = r.responsable_persona_id and o.alumno_persona_id <> p_persona
    )
    and not exists (select 1 from personal pe where pe.persona_id = r.responsable_persona_id);

  delete from personas where id = p_persona;
  delete from personas where id = any(v_huerfanos);
end $$;

revoke all on function public.archivar_legajo(uuid) from public;
revoke all on function public.desarchivar_legajo(uuid) from public;
revoke all on function public.eliminar_legajo(uuid) from public;
grant execute on function public.archivar_legajo(uuid) to authenticated;
grant execute on function public.desarchivar_legajo(uuid) to authenticated;
grant execute on function public.eliminar_legajo(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe listar la columna, las tres funciones y la política
select column_name as elemento from information_schema.columns
where table_name = 'personas' and column_name = 'archivado_at'
union all
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name in ('archivar_legajo', 'desarchivar_legajo', 'eliminar_legajo')
union all
select policyname from pg_policies where tablename = 'personas' and policyname = 'personas_delete_archivados';
