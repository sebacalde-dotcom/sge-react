-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 009: ficha académica del alumno (ingreso a la institución)
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
-- El egreso (fecha, colegio de destino y motivo) ya está en la tabla pases.
-- ═════════════════════════════════════════════════════════════════════════

alter table alumno_datos add column if not exists fecha_ingreso date;
alter table alumno_datos add column if not exists colegio_procedencia text;

notify pgrst, 'reload schema';

select column_name, data_type from information_schema.columns
where table_name = 'alumno_datos' and column_name in ('fecha_ingreso', 'colegio_procedencia');
