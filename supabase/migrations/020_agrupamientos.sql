-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 020: agrupamientos de materias (niveles, talleres, optativas)
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  Un agrupamiento reúne las materias que se dictan a la vez y se dividen en grupos:
--    * Inglés por niveles: las materias Inglés de 1°, 2° y 3° forman un agrupamiento y los
--      grupos son A1 y A2, con alumnos de varios cursos.
--    * Arte dividido en Música y Dibujo: una sola materia de un curso, con dos grupos.
--  Cada grupo tiene su docente. Los alumnos pertenecen a un grupo durante un período (desde,
--  hasta), porque un alumno puede pasar de nivel durante el año y las notas y la asistencia
--  dependen del grupo en que estaba. Un alumno está en un solo grupo de cada agrupamiento a la vez.
--
--  * agrupamientos, agrupamiento_materias (una materia está en un solo agrupamiento),
--    grupos y grupo_alumnos.
--  * asignar_grupo_alumno(agrupamiento, alumno, grupo, fecha): cambia al alumno de grupo desde
--    una fecha, cerrando el período anterior (grupo nulo = lo saca del agrupamiento).
--  * Permisos: cualquier personal lo ve; solo quien puede editar Ciclo Lectivo lo modifica.
-- ═════════════════════════════════════════════════════════════════════════

begin;

create extension if not exists btree_gist;

create table if not exists agrupamientos (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  created_at timestamptz default now()
);
create unique index if not exists uq_agrupamientos_nombre on agrupamientos (ciclo_id, lower(nombre));

create table if not exists agrupamiento_materias (
  materia_id uuid primary key references materias(id) on delete cascade,
  agrupamiento_id uuid not null references agrupamientos(id) on delete cascade
);
create index if not exists idx_agrupamiento_materias on agrupamiento_materias (agrupamiento_id);

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  agrupamiento_id uuid not null references agrupamientos(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  personal_id uuid references personal(id) on delete set null,
  created_at timestamptz default now(),
  constraint uq_grupos_id_agrupamiento unique (id, agrupamiento_id)
);
create unique index if not exists uq_grupos_nombre on grupos (agrupamiento_id, lower(nombre));

create table if not exists grupo_alumnos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null,
  agrupamiento_id uuid not null,
  persona_id uuid not null references personas(id) on delete cascade,
  desde date not null,
  hasta date,
  created_at timestamptz default now(),
  constraint grupo_alumnos_periodo check (hasta is null or hasta >= desde),
  constraint fk_grupo_alumnos_grupo foreign key (grupo_id, agrupamiento_id)
    references grupos (id, agrupamiento_id) on delete cascade,
  -- Un alumno no puede estar en dos grupos del mismo agrupamiento en las mismas fechas
  constraint grupo_alumnos_sin_superposicion exclude using gist (
    agrupamiento_id with =, persona_id with =, daterange(desde, hasta, '[]') with &&
  )
);
create index if not exists idx_grupo_alumnos_grupo on grupo_alumnos (grupo_id);
create index if not exists idx_grupo_alumnos_persona on grupo_alumnos (persona_id);

do $$
declare
  t text;
begin
  foreach t in array array['agrupamientos', 'agrupamiento_materias', 'grupos', 'grupo_alumnos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%s_select" on %I', t, t);
    execute format('drop policy if exists "%s_insert" on %I', t, t);
    execute format('drop policy if exists "%s_update" on %I', t, t);
    execute format('drop policy if exists "%s_delete" on %I', t, t);
    execute format('create policy "%s_select" on %I for select to authenticated using (public.es_staff())', t, t);
    execute format('create policy "%s_insert" on %I for insert to authenticated with check (public.puede_configurar(''ciclo''))', t, t);
    execute format('create policy "%s_update" on %I for update to authenticated using (public.puede_configurar(''ciclo'')) with check (public.puede_configurar(''ciclo''))', t, t);
    execute format('create policy "%s_delete" on %I for delete to authenticated using (public.puede_configurar(''ciclo''))', t, t);
  end loop;
end $$;

-- Cambia a un alumno de grupo desde una fecha. Con p_grupo nulo lo saca del agrupamiento desde esa fecha.
create or replace function public.asignar_grupo_alumno(p_agrupamiento uuid, p_persona uuid, p_grupo uuid, p_fecha date)
returns void
language plpgsql as $$
declare
  v_actual uuid;
begin
  if not public.puede_configurar('ciclo') then
    raise exception 'No tenés permiso para modificar los grupos';
  end if;
  if p_grupo is not null and not exists (select 1 from grupos where id = p_grupo and agrupamiento_id = p_agrupamiento) then
    raise exception 'El grupo no pertenece al agrupamiento';
  end if;

  select grupo_id into v_actual from grupo_alumnos
  where agrupamiento_id = p_agrupamiento and persona_id = p_persona
    and desde <= p_fecha and (hasta is null or hasta >= p_fecha)
  limit 1;
  if found and v_actual is not distinct from p_grupo then
    return; -- ya está en ese grupo en esa fecha
  end if;

  -- Lo que empezaba ese día o después queda reemplazado; lo que estaba vigente se cierra el día anterior
  delete from grupo_alumnos
  where agrupamiento_id = p_agrupamiento and persona_id = p_persona and desde >= p_fecha;
  update grupo_alumnos set hasta = p_fecha - 1
  where agrupamiento_id = p_agrupamiento and persona_id = p_persona
    and desde < p_fecha and (hasta is null or hasta >= p_fecha);

  if p_grupo is not null then
    insert into grupo_alumnos (grupo_id, agrupamiento_id, persona_id, desde)
    values (p_grupo, p_agrupamiento, p_persona, p_fecha);
  end if;
end $$;

revoke all on function public.asignar_grupo_alumno(uuid, uuid, uuid, date) from public;
grant execute on function public.asignar_grupo_alumno(uuid, uuid, uuid, date) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe listar las cuatro tablas, la función y sus políticas (4 por tabla)
select table_name as elemento from information_schema.tables
where table_name in ('agrupamientos', 'agrupamiento_materias', 'grupos', 'grupo_alumnos')
union all
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'asignar_grupo_alumno'
union all
select policyname from pg_policies
where tablename in ('agrupamientos', 'agrupamiento_materias', 'grupos', 'grupo_alumnos')
order by 1;
