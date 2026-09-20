-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 007: reincorporaciones y pases
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * reincorporaciones: decisión del Director sobre un alumno No Regular. La
--    regularidad se calcula a partir de las inasistencias y de estas fechas
--    (no se guarda el estado). Solo admin y directivos las registran.
--  * pases: el alumno se va a otro colegio. Registrar un pase deja constancia
--    y pone alumno_datos.estado = 'pase'; anularlo lo devuelve a 'activo'.
--    Se hace con funciones para que sea una sola operación atómica.
-- Todo va en una transacción: si algo falla no queda nada a medias.
-- ═════════════════════════════════════════════════════════════════════════

begin;

-- ── Reincorporaciones ───────────────────────────────────────────────────
create table if not exists reincorporaciones (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  fecha date not null default current_date,
  observaciones text,
  autorizada_por uuid references personal(id),
  created_at timestamptz default now()
);
create index if not exists idx_reincorporaciones_persona on reincorporaciones(persona_id, ciclo_id);

alter table reincorporaciones enable row level security;
drop policy if exists "reincorporaciones_select" on reincorporaciones;
drop policy if exists "reincorporaciones_insert" on reincorporaciones;
drop policy if exists "reincorporaciones_update" on reincorporaciones;
drop policy if exists "reincorporaciones_delete" on reincorporaciones;
create policy "reincorporaciones_select" on reincorporaciones for select to authenticated
  using (public.es_staff());
create policy "reincorporaciones_insert" on reincorporaciones for insert to authenticated
  with check (public.es_admin());
create policy "reincorporaciones_update" on reincorporaciones for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy "reincorporaciones_delete" on reincorporaciones for delete to authenticated
  using (public.es_admin());

-- ── Pases ───────────────────────────────────────────────────────────────
create table if not exists pases (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  fecha date not null default current_date,
  colegio_destino text,
  motivo text,
  registrado_por uuid references personal(id),
  anulado_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_pases_persona on pases(persona_id);

alter table pases enable row level security;
drop policy if exists "pases_select" on pases;
drop policy if exists "pases_insert" on pases;
drop policy if exists "pases_update" on pases;
drop policy if exists "pases_delete" on pases;
create policy "pases_select" on pases for select to authenticated
  using (public.es_staff());
create policy "pases_insert" on pases for insert to authenticated
  with check (public.es_admin());
create policy "pases_update" on pases for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy "pases_delete" on pases for delete to authenticated
  using (public.es_admin());

create or replace function public.registrar_pase(
  p_persona uuid, p_fecha date, p_destino text, p_motivo text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ciclo uuid;
  v_id uuid;
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden registrar pases';
  end if;
  select ciclo_id into v_ciclo from alumno_datos where persona_id = p_persona;
  if v_ciclo is null then
    raise exception 'La persona no es un alumno con datos de ciclo lectivo';
  end if;
  insert into pases (persona_id, ciclo_id, fecha, colegio_destino, motivo, registrado_por)
  values (
    p_persona, v_ciclo, coalesce(p_fecha, current_date),
    nullif(trim(p_destino), ''), nullif(trim(p_motivo), ''),
    (select id from personal where auth_user_id = auth.uid() and eliminado = false limit 1)
  )
  returning id into v_id;
  update alumno_datos set estado = 'pase' where persona_id = p_persona;
  return v_id;
end $$;

create or replace function public.anular_pase(p_persona uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden anular pases';
  end if;
  update pases set anulado_at = now() where persona_id = p_persona and anulado_at is null;
  update alumno_datos set estado = 'activo' where persona_id = p_persona and estado = 'pase';
end $$;

revoke all on function public.registrar_pase(uuid, date, text, text) from public;
revoke all on function public.anular_pase(uuid) from public;
grant execute on function public.registrar_pase(uuid, date, text, text) to authenticated;
grant execute on function public.anular_pase(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: deben aparecer las políticas de reincorporaciones y pases
select tablename, policyname, cmd
from pg_policies
where tablename in ('reincorporaciones', 'pases')
order by tablename, cmd, policyname;
