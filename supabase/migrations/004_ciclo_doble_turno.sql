-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 004: turno simple / doble turno a nivel Ciclo Lectivo
-- Ejecutar en Supabase SQL Editor ANTES de volver a guardar la configuración
-- de inasistencias (copia el valor que hoy vive en config 'inasistencias').
-- Se puede correr más de una vez.
-- ═════════════════════════════════════════════════════════════════════════

alter table ciclos add column if not exists doble_turno boolean not null default false;

update ciclos
set doble_turno = coalesce(
  (select (value ->> 'doble_turno')::boolean from config where key = 'inasistencias'),
  false
);

notify pgrst, 'reload schema';

select anio, doble_turno from ciclos order by anio desc;
