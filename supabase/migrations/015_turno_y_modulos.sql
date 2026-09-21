-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 015: turno de cada curso y grilla de módulos
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * cursos.turno: 'manana', 'tarde' o 'doble' (doble turno). Algunos cursos de una
--    escuela hacen doble turno y otros no, por eso el turno es de cada curso.
--    Sin turno, el curso usa el valor por defecto del ciclo (ciclos.doble_turno).
--  * ciclos.grilla_modulos: los módulos de cada turno y de cada día, como JSON:
--    {"manana": {"1": [{"inicio": "07:30", "fin": "08:30"}, ...], "2": [...]},
--     "tarde": {...}}
--    donde "1" es el lunes y "5" el viernes. Cada día puede tener una cantidad distinta.
--  Cursos y ciclos ya se editan con puede_configurar('ciclo'): no hace falta tocar permisos.
-- ═════════════════════════════════════════════════════════════════════════

begin;

alter table cursos add column if not exists turno text
  check (turno is null or turno in ('manana', 'tarde', 'doble'));

alter table ciclos add column if not exists grilla_modulos jsonb;

notify pgrst, 'reload schema';

commit;

-- Verificación: debe devolver las dos columnas
select table_name, column_name, data_type
from information_schema.columns
where (table_name = 'cursos' and column_name = 'turno')
   or (table_name = 'ciclos' and column_name = 'grilla_modulos')
order by table_name;
