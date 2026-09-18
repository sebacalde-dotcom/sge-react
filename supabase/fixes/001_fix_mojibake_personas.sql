-- ═════════════════════════════════════════════════════════════════════════
-- Fix puntual: nombres/apellidos con mojibake (doble codificación UTF-8)
-- Ejecutar manualmente en Supabase SQL Editor. NO es una migración de schema.
-- Detectado: 2026-09-18, en registros importados vía AlumnoImportDialog.
-- ═════════════════════════════════════════════════════════════════════════

-- 1) Previsualizar filas afectadas (nombres con 'Ã' o 'Â' sueltos)
select id, apellido, nombre
from personas
where apellido ~ '[ÃÂ]' or nombre ~ '[ÃÂ]';

-- 2) Corrección, dentro de una transacción para poder revisar antes de confirmar
begin;

update personas
set apellido = convert_from(convert_to(apellido, 'LATIN1'), 'UTF8'),
    nombre   = convert_from(convert_to(nombre, 'LATIN1'), 'UTF8')
where apellido ~ '[ÃÂ]' or nombre ~ '[ÃÂ]';

-- 3) Revisar el resultado antes de confirmar
select id, apellido, nombre
from personas
where id in (
  select id from personas where apellido ~ '[ÃÂ]' or nombre ~ '[ÃÂ]'
);

-- Si los nombres se ven bien (á, é, í, ó, ú, ñ correctos): commit;
-- Si algo salió mal: rollback;
commit;
