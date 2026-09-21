-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 019: generador automático de horarios
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * horario_modulos.fijo: un módulo "fijo" es uno que quien arma el horario puso a mano y
--    tiene que estar sí o sí; el generador lo respeta y arma el resto. Lo que ya estaba
--    cargado se armó a mano, así que queda fijo; lo que se guarde después es fijo solo si
--    se lo indica (lo generado no lo es).
--  * materias.turno: en qué turno se dicta la materia (necesario en los cursos de doble
--    turno; vacío = el del curso).
--  * materias.bloque_doble: la materia se dicta en bloques de dos módulos seguidos.
--  * ciclos.reglas_horario: las reglas que fija el director para armar el horario
--    (mínimo y máximo de módulos por día de cada turno, máximo de una materia por día,
--    evitar módulos libres de los docentes).
--  * guardar_horario_curso ahora guarda "fijo", y guardar_horario_cursos reemplaza de una
--    vez el horario de varios cursos, en una sola transacción.
-- ═════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'horario_modulos' and column_name = 'fijo'
  ) then
    alter table horario_modulos add column fijo boolean not null default true;
    alter table horario_modulos alter column fijo set default false;
  end if;
end $$;

alter table materias add column if not exists turno text
  check (turno is null or turno in ('manana', 'tarde'));
alter table materias add column if not exists bloque_doble boolean not null default false;

alter table ciclos add column if not exists reglas_horario jsonb;

-- p_filas: [{"materia_id": "...", "dia": 1, "turno": "manana", "modulo": 1, "fijo": true}, ...]
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
  insert into horario_modulos (ciclo_id, curso_id, materia_id, dia, turno, modulo, fijo)
  select v_ciclo, p_curso, (f ->> 'materia_id')::uuid, (f ->> 'dia')::smallint, f ->> 'turno',
         (f ->> 'modulo')::smallint, coalesce((f ->> 'fijo')::boolean, false)
  from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) as f;
  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end $$;

revoke all on function public.guardar_horario_curso(uuid, jsonb) from public;
grant execute on function public.guardar_horario_curso(uuid, jsonb) to authenticated;

-- p_filas: [{"curso_id": "...", "materia_id": "...", "dia": 1, "turno": "manana", "modulo": 1, "fijo": false}, ...]
-- Reemplaza el horario de los cursos de p_cursos; las filas de otros cursos se ignoran.
create or replace function public.guardar_horario_cursos(p_cursos uuid[], p_filas jsonb)
returns integer
language plpgsql as $$
declare
  v_cantidad integer;
begin
  if not public.puede_configurar('ciclo') then
    raise exception 'No tenés permiso para modificar el horario';
  end if;
  if coalesce(array_length(p_cursos, 1), 0) = 0 then
    return 0;
  end if;

  delete from horario_modulos where curso_id = any (p_cursos);
  insert into horario_modulos (ciclo_id, curso_id, materia_id, dia, turno, modulo, fijo)
  select c.ciclo_id, c.id, (f ->> 'materia_id')::uuid, (f ->> 'dia')::smallint, f ->> 'turno',
         (f ->> 'modulo')::smallint, coalesce((f ->> 'fijo')::boolean, false)
  from jsonb_array_elements(coalesce(p_filas, '[]'::jsonb)) as f
  join cursos c on c.id = (f ->> 'curso_id')::uuid
  where c.id = any (p_cursos);
  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end $$;

revoke all on function public.guardar_horario_cursos(uuid[], jsonb) from public;
grant execute on function public.guardar_horario_cursos(uuid[], jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe listar las cuatro columnas y las dos funciones
select table_name || '.' || column_name as elemento from information_schema.columns
where (table_name = 'horario_modulos' and column_name = 'fijo')
   or (table_name = 'materias' and column_name in ('turno', 'bloque_doble'))
   or (table_name = 'ciclos' and column_name = 'reglas_horario')
union all
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name in ('guardar_horario_curso', 'guardar_horario_cursos')
order by 1;
