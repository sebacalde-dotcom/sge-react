-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 010: progenitores y secciones/cursos adicionales del alumno
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * alumno_datos.progenitores: datos de los dos progenitores (nombre,
--    apellido, dni y rol opcional), como lista JSON.
--  * alumno_cursos: secciones y cursos ADICIONALES del alumno, para quien cursa
--    en más de una sección. El curso principal sigue siendo alumno_datos.curso_id.
-- ═════════════════════════════════════════════════════════════════════════

begin;

alter table alumno_datos add column if not exists progenitores jsonb not null default '[]';

create table if not exists alumno_cursos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  curso_id uuid not null references cursos(id) on delete cascade,
  created_at timestamptz default now(),
  unique (persona_id, curso_id)
);
create index if not exists idx_alumno_cursos_curso on alumno_cursos(curso_id);
create index if not exists idx_alumno_cursos_persona on alumno_cursos(persona_id);

alter table alumno_cursos enable row level security;
drop policy if exists "staff_all" on alumno_cursos;
create policy "staff_all" on alumno_cursos for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

notify pgrst, 'reload schema';

commit;

select column_name from information_schema.columns
where table_name = 'alumno_datos' and column_name = 'progenitores'
union all
select table_name from information_schema.tables where table_name = 'alumno_cursos';
