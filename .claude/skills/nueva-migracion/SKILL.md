---
name: nueva-migracion
description: Crea la próxima migración SQL numerada de SGE (supabase/migrations) con el formato del proyecto y la lista de chequeo de RLS, y la deja lista para pegar en el SQL Editor de Supabase. Usar cuando haya que cambiar la base de datos (tablas, columnas, políticas, funciones).
---

# Nueva migración de SGE

Las migraciones **no se ejecutan desde acá**: el usuario las corre a mano en el SQL Editor de Supabase. Tu trabajo es escribirlas bien, guardarlas en el repo y pegarle el SQL completo en el chat.

## Pasos

1. **Número y nombre.** Listá `supabase/migrations` y tomá el mayor prefijo numérico + 1 (hay dos `002_` históricas; se cuenta el mayor). Nombre en `snake_case` que diga qué hace: `012_materias_y_horarios.sql`.
2. **Contexto.** Leé la última migración y las que toquen las mismas tablas, para mantener el estilo y no duplicar nada.
3. **Escribila idempotente** (se puede correr más de una vez) con esta estructura:

```sql
-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración NNN: <título>
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
--  * <qué agrega o cambia y por qué, en pocas líneas>
-- ═════════════════════════════════════════════════════════════════════════

begin;

-- add column if not exists / create table if not exists / create or replace function
-- drop policy if exists "..." + create policy "..."

notify pgrst, 'reload schema';

commit;

-- Verificación: <qué debe devolver este select>
select ...;
```

4. **Lista de chequeo antes de entregarla:**
   - **RLS.** Toda tabla nueva: `enable row level security` **y** políticas explícitas. RLS sin políticas bloquea todo (ya pasó con `inasistencias`).
   - **Quién puede qué.** Roles: `admin`, `directivo`, `docente`, `preceptor`. Funciones: `es_staff()` (cualquier personal), `es_admin()` (admin o directivo), `puede_configurar(area)` (delegable desde Configuración → Permisos). Lectura y escritura del día a día: `es_staff()`. Administración, pases, archivado, borrados: `es_admin()`. Los permisos se aplican en la base, no solo en la pantalla.
   - **Funciones `security definer`.** Con `set search_path = public`, chequeo del rol adentro (`if not public.es_admin() then raise exception ...`), y luego `revoke all ... from public; grant execute ... to authenticated;`.
   - **Claves foráneas.** Decidí a propósito `on delete cascade` o `set null`. Ojo: borrar una `persona` arrastra en cascada inasistencias, pases, reincorporaciones, notificaciones y vínculos.
   - **Columnas nuevas.** `add column if not exists` con valor por defecto que sirva a las filas existentes.
   - **Front que se degrada.** El código debe funcionar aunque la migración todavía no se haya corrido (sonda con una consulta o `'columna' in fila`) y mostrar un aviso claro en la interfaz.
5. **Entrega.**
   - Guardá el archivo en `supabase/migrations/`.
   - **Pegá el SQL completo en el chat**, en un bloque ```sql (el usuario no puede abrir archivos desde links).
   - Decile qué debe devolver la consulta de verificación.
   - No la ejecutes contra la base y no commitees hasta que lo pida (suele pedirlo junto con "listo la migración").
6. **Nunca edites una migración ya corrida:** si hay que corregir algo, va una migración nueva. Solo se puede modificar una si el usuario todavía no la corrió.
7. **Después** adaptá el front (con la degradación del punto 4) y verificá con `npx tsc --noEmit -p tsconfig.app.json`.
