-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 012: bimestres y trimestres definidos en el ciclo lectivo
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * ciclos.periodos: fechas (desde / hasta) de los bimestres y trimestres del ciclo,
--    como JSON: {"bimestres": [{"desde": "2026-03-02", "hasta": "2026-04-29"}, ...],
--                "trimestres": [...]}
--    Los cuatrimestres siguen en c1_desde ... c2_hasta.
--    Sin este dato, los bimestres y trimestres se calculan por bloques de meses.
--    Cambiar el permiso de edición no hace falta: ciclos ya se edita con puede_configurar('ciclo').
-- ═════════════════════════════════════════════════════════════════════════

begin;

alter table ciclos add column if not exists periodos jsonb;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe devolver la columna
select column_name, data_type
from information_schema.columns
where table_name = 'ciclos' and column_name = 'periodos';
