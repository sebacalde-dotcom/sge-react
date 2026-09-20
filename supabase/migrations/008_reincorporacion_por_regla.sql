-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 008: la reincorporación reinicia solo las reglas infringidas
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
-- Cada reincorporación guarda en `reglas` cuáles eran las reglas de regularidad
-- que el alumno estaba infringiendo (lista de {limite, periodo}). Solo el
-- conteo de esas reglas se reinicia desde la fecha de reincorporación; las
-- demás siguen contando. Las reincorporaciones anteriores (reglas nulo)
-- siguen reiniciando todas las reglas, como hasta ahora.
-- ═════════════════════════════════════════════════════════════════════════

alter table reincorporaciones add column if not exists reglas jsonb;

notify pgrst, 'reload schema';

select column_name, data_type from information_schema.columns
where table_name = 'reincorporaciones' and column_name = 'reglas';
