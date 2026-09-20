-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 013: régimen de cada ciclo lectivo
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * ciclos.regimen: el régimen de asistencia y evaluación vigente en el ciclo
--    ('pba' o 'caba'). Si está vacío, el ciclo usa la jurisdicción cargada en Institución.
--    Cada ciclo guarda el suyo porque las normas cambian de un año a otro.
--    Ciclos ya se edita con puede_configurar('ciclo'): no hace falta tocar permisos.
-- ═════════════════════════════════════════════════════════════════════════

begin;

alter table ciclos add column if not exists regimen text;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe devolver la columna
select column_name, data_type
from information_schema.columns
where table_name = 'ciclos' and column_name = 'regimen';
