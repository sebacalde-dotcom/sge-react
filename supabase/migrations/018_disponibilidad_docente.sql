-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 018: disponibilidad horaria de los docentes
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * docente_disponibilidad: los rangos de horas en los que cada docente puede dar
--    clase, por ciclo y por día (1 = lunes ... 6 = sábado). Se guardan como horas y no
--    como números de módulo, para que no dependan de cómo esté armada la grilla y porque
--    así es como los docentes dan su disponibilidad. Un docente sin filas se considera
--    disponible en cualquier horario.
--  * guardar_disponibilidad_docente(ciclo, docente, filas): reemplaza de una vez toda la
--    disponibilidad de un docente en un ciclo, en una sola transacción.
--  * Permisos: cualquier personal la ve; solo quien puede editar Ciclo Lectivo la modifica.
-- ═════════════════════════════════════════════════════════════════════════

begin;

create table if not exists docente_disponibilidad (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  personal_id uuid not null references personal(id) on delete cascade,
  dia smallint not null check (dia between 1 and 6),
  desde time not null,
  hasta time not null,
  created_at timestamptz default now(),
  constraint ck_disponibilidad_rango check (hasta > desde)
);
create index if not exists idx_disponibilidad_ciclo_docente on docente_disponibilidad (ciclo_id, personal_id);

alter table docente_disponibilidad enable row level security;
drop policy if exists "disponibilidad_select" on docente_disponibilidad;
drop policy if exists "disponibilidad_insert" on docente_disponibilidad;
drop policy if exists "disponibilidad_update" on docente_disponibilidad;
drop policy if exists "disponibilidad_delete" on docente_disponibilidad;
create policy "disponibilidad_select" on docente_disponibilidad for select to authenticated
  using (public.es_staff());
create policy "disponibilidad_insert" on docente_disponibilidad for insert to authenticated
  with check (public.puede_configurar('ciclo'));
create policy "disponibilidad_update" on docente_disponibilidad for update to authenticated
  using (public.puede_configurar('ciclo')) with check (public.puede_configurar('ciclo'));
create policy "disponibilidad_delete" on docente_disponibilidad for delete to authenticated
  using (public.puede_configurar('ciclo'));

-- p_filas: [{"dia": 1, "desde": "08:00", "hasta": "12:00"}, ...]
create or replace function public.guardar_disponibilidad_docente(p_ciclo uuid, p_personal uuid, p_filas jsonb)
returns integer
language plpgsql as $$
declare
  v_cantidad integer;
begin
  if not public.puede_configurar('ciclo') then
    raise exception 'No tenés permiso para modificar la disponibilidad';
  end if;

  delete from docente_disponibilidad where ciclo_id = p_ciclo and personal_id = p_personal;
  insert into docente_disponibilidad (ciclo_id, personal_id, dia, desde, hasta)
  select p_ciclo, p_personal, (f ->> 'dia')::smallint, (f ->> 'desde')::time, (f ->> 'hasta')::time
  from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) as f;
  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end $$;

revoke all on function public.guardar_disponibilidad_docente(uuid, uuid, jsonb) from public;
grant execute on function public.guardar_disponibilidad_docente(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe listar la tabla, la función y las cuatro políticas
select table_name as elemento from information_schema.tables where table_name = 'docente_disponibilidad'
union all
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'guardar_disponibilidad_docente'
union all
select policyname from pg_policies where tablename = 'docente_disponibilidad'
order by 1;
