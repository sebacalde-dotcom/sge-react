-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 017: el horario admite clases los sábados
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * horario_modulos.dia pasa de 1-5 (lunes a viernes) a 1-6 (hasta el sábado).
-- ═════════════════════════════════════════════════════════════════════════

begin;

alter table horario_modulos drop constraint if exists horario_modulos_dia_check;
alter table horario_modulos add constraint horario_modulos_dia_check check (dia between 1 and 6);

notify pgrst, 'reload schema';

commit;

-- Verificación: debe mostrar "CHECK (((dia >= 1) AND (dia <= 6)))"
select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = 'horario_modulos'::regclass and conname = 'horario_modulos_dia_check';
