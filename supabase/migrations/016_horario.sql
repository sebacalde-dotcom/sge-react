-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 016: horario de cada curso
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * horario_modulos: en qué módulo (turno, día de 1 a 5 y número de módulo) se dicta
--    cada materia de un curso. El docente es el de la materia. Una fila por módulo.
--    La materia tiene que ser del mismo curso (clave foránea compuesta).
--  * guardar_horario_curso(curso, filas): reemplaza de una vez todo el horario de un
--    curso, en una sola transacción: si algo falla no queda el horario a medias.
--  * Permisos: cualquier personal ve el horario; solo quien puede editar Ciclo Lectivo
--    lo modifica (igual que materias, cursos y secciones).
-- La fecha de vigencia del horario (versiones durante el año) se agrega en una etapa posterior.
-- ═════════════════════════════════════════════════════════════════════════

begin;

-- Para que el horario pueda exigir que la materia sea del mismo curso
create unique index if not exists uq_materias_id_curso on materias (id, curso_id);

create table if not exists horario_modulos (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  curso_id uuid not null references cursos(id) on delete cascade,
  materia_id uuid not null,
  dia smallint not null check (dia between 1 and 5),
  turno text not null check (turno in ('manana', 'tarde')),
  modulo smallint not null check (modulo >= 1),
  created_at timestamptz default now(),
  constraint fk_horario_materia_del_curso
    foreign key (materia_id, curso_id) references materias (id, curso_id) on delete cascade,
  constraint uq_horario_modulo unique (curso_id, dia, turno, modulo)
);
create index if not exists idx_horario_ciclo on horario_modulos (ciclo_id);
create index if not exists idx_horario_materia on horario_modulos (materia_id);

alter table horario_modulos enable row level security;
drop policy if exists "horario_select" on horario_modulos;
drop policy if exists "horario_insert" on horario_modulos;
drop policy if exists "horario_update" on horario_modulos;
drop policy if exists "horario_delete" on horario_modulos;
create policy "horario_select" on horario_modulos for select to authenticated
  using (public.es_staff());
create policy "horario_insert" on horario_modulos for insert to authenticated
  with check (public.puede_configurar('ciclo'));
create policy "horario_update" on horario_modulos for update to authenticated
  using (public.puede_configurar('ciclo')) with check (public.puede_configurar('ciclo'));
create policy "horario_delete" on horario_modulos for delete to authenticated
  using (public.puede_configurar('ciclo'));

-- p_filas: [{"materia_id": "...", "dia": 1, "turno": "manana", "modulo": 1}, ...]
create or replace function public.guardar_horario_curso(p_curso uuid, p_filas jsonb)
returns integer
language plpgsql as $$
declare
  v_ciclo uuid;
  v_cantidad integer;
begin
  if not public.puede_configurar('ciclo') then
    raise exception 'No tenés permiso para modificar el horario';
  end if;
  select ciclo_id into v_ciclo from cursos where id = p_curso;
  if v_ciclo is null then
    raise exception 'El curso no existe';
  end if;

  delete from horario_modulos where curso_id = p_curso;
  insert into horario_modulos (ciclo_id, curso_id, materia_id, dia, turno, modulo)
  select v_ciclo, p_curso, (f ->> 'materia_id')::uuid, (f ->> 'dia')::smallint, f ->> 'turno', (f ->> 'modulo')::smallint
  from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) as f;
  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end $$;

revoke all on function public.guardar_horario_curso(uuid, jsonb) from public;
grant execute on function public.guardar_horario_curso(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe listar la tabla, la función y las cuatro políticas
select table_name as elemento from information_schema.tables where table_name = 'horario_modulos'
union all
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'guardar_horario_curso'
union all
select policyname from pg_policies where tablename = 'horario_modulos'
order by 1;
