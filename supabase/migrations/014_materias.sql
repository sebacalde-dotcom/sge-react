-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 014: materias de cada curso
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * materias.horas_semanales: horas o módulos por semana de la materia.
--  * Una materia no se puede repetir dentro de un curso (sin distinguir mayúsculas).
--  * Permisos: cualquier personal ve las materias, pero solo quien puede editar el
--    área "Ciclo Lectivo" (admin, directivos, o quien tenga el permiso delegado) las
--    crea, modifica o elimina. Igual que secciones y cursos.
-- ═════════════════════════════════════════════════════════════════════════

begin;

alter table materias add column if not exists horas_semanales numeric(4,1)
  check (horas_semanales is null or horas_semanales >= 0);

create unique index if not exists uq_materias_curso_nombre on materias (curso_id, lower(nombre));

drop policy if exists "staff_all" on materias;
drop policy if exists "materias_select" on materias;
drop policy if exists "materias_insert" on materias;
drop policy if exists "materias_update" on materias;
drop policy if exists "materias_delete" on materias;
create policy "materias_select" on materias for select to authenticated
  using (public.es_staff());
create policy "materias_insert" on materias for insert to authenticated
  with check (public.puede_configurar('ciclo'));
create policy "materias_update" on materias for update to authenticated
  using (public.puede_configurar('ciclo')) with check (public.puede_configurar('ciclo'));
create policy "materias_delete" on materias for delete to authenticated
  using (public.puede_configurar('ciclo'));

notify pgrst, 'reload schema';

commit;

-- Verificación: debe devolver la columna y las cuatro políticas
select column_name as elemento from information_schema.columns
where table_name = 'materias' and column_name = 'horas_semanales'
union all
select policyname from pg_policies where tablename = 'materias'
order by 1;
