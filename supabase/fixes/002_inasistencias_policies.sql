-- ═════════════════════════════════════════════════════════════════════════
-- Fix: la tabla inasistencias quedó con RLS activo pero sin políticas
-- (las escrituras fallaban con "new row violates row-level security policy").
-- Repite las políticas de 003_inasistencias.sql. Se puede correr más de una vez.
-- Ejecutar manualmente en Supabase SQL Editor.
-- ═════════════════════════════════════════════════════════════════════════

alter table inasistencias enable row level security;

drop policy if exists "inasistencias_select" on inasistencias;
drop policy if exists "inasistencias_write" on inasistencias;

create policy "inasistencias_select" on inasistencias for select to authenticated
  using (true);

create policy "inasistencias_write" on inasistencias for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

-- Verificación: debe devolver 2 filas (select y write)
select policyname, cmd from pg_policies where tablename = 'inasistencias';
