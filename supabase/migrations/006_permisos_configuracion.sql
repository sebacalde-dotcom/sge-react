-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 006: permisos de configuración por rol
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
-- Hasta ahora cualquier persona del personal podía escribir en las tablas de
-- configuración (solo la pantalla lo impedía). Esta migración hace que lo
-- cumpla la base de datos:
--   * admin y directivo pueden modificar todo, siempre.
--   * docente y preceptor solo pueden modificar las áreas que un admin o
--     directivo les habilite en la tabla permisos_configuracion.
--   * La tabla permisos_configuracion y el alta/cambio de roles del personal
--     son siempre solo de admin y directivo (no se pueden delegar).
--
-- Áreas: institucion, ciclo (ciclo lectivo, calendario, secciones y cursos),
--        inasistencias (tipos, teclas y límites), notificaciones (reglas y carta).
-- Todo va en una transacción: si algo falla no queda nada a medias.
-- ═════════════════════════════════════════════════════════════════════════

begin;

-- ── Tabla de permisos ───────────────────────────────────────────────────
create table if not exists permisos_configuracion (
  area text not null,
  rol user_role not null,
  puede_editar boolean not null default false,
  updated_at timestamptz default now(),
  primary key (area, rol)
);

insert into permisos_configuracion (area, rol)
select a.area, r.rol
from (values ('institucion'), ('ciclo'), ('inasistencias'), ('notificaciones')) as a(area)
cross join (values ('docente'::user_role), ('preceptor'::user_role)) as r(rol)
on conflict do nothing;

-- ── Funciones (SECURITY DEFINER: leen personal salteando su RLS) ────────
create or replace function public.rol_actual()
returns user_role
language sql security definer stable set search_path = public as $$
  select rol from personal where auth_user_id = auth.uid() and eliminado = false limit 1
$$;

create or replace function public.es_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce(public.rol_actual() in ('admin', 'directivo'), false)
$$;

create or replace function public.puede_configurar(p_area text)
returns boolean
language sql security definer stable set search_path = public as $$
  select public.es_admin() or exists (
    select 1 from permisos_configuracion
    where area = p_area and rol = public.rol_actual() and puede_editar
  )
$$;

create or replace function public.area_de_config(p_key text)
returns text
language sql immutable as $$
  select case p_key
    when 'institucional' then 'institucion'
    when 'inasistencias' then 'inasistencias'
    when 'notificaciones_inasistencia' then 'notificaciones'
  end
$$;

-- ── permisos_configuracion: lee todo el personal, escribe solo admin ────
alter table permisos_configuracion enable row level security;
drop policy if exists "permisos_select" on permisos_configuracion;
drop policy if exists "permisos_write" on permisos_configuracion;
create policy "permisos_select" on permisos_configuracion for select to authenticated
  using (public.es_staff());
create policy "permisos_write" on permisos_configuracion for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ── config: cada clave pertenece a un área (las claves desconocidas, solo admin) ──
drop policy if exists "staff_all" on config;
drop policy if exists "config_select" on config;
drop policy if exists "config_insert" on config;
drop policy if exists "config_update" on config;
drop policy if exists "config_delete" on config;
create policy "config_select" on config for select to authenticated
  using (public.es_staff());
create policy "config_insert" on config for insert to authenticated
  with check (public.puede_configurar(public.area_de_config(key)));
create policy "config_update" on config for update to authenticated
  using (public.puede_configurar(public.area_de_config(key)))
  with check (public.puede_configurar(public.area_de_config(key)));
create policy "config_delete" on config for delete to authenticated
  using (public.puede_configurar(public.area_de_config(key)));

-- ── ciclos, secciones y cursos: área "ciclo" ────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['ciclos', 'secciones', 'cursos'] loop
    execute format('drop policy if exists "staff_all" on %I', t);
    execute format('drop policy if exists "%s_select" on %I', t, t);
    execute format('drop policy if exists "%s_insert" on %I', t, t);
    execute format('drop policy if exists "%s_update" on %I', t, t);
    execute format('drop policy if exists "%s_delete" on %I', t, t);
    execute format('create policy "%s_select" on %I for select to authenticated using (public.es_staff())', t, t);
    execute format('create policy "%s_insert" on %I for insert to authenticated with check (public.puede_configurar(''ciclo''))', t, t);
    execute format('create policy "%s_update" on %I for update to authenticated using (public.puede_configurar(''ciclo'')) with check (public.puede_configurar(''ciclo''))', t, t);
    execute format('create policy "%s_delete" on %I for delete to authenticated using (public.puede_configurar(''ciclo''))', t, t);
  end loop;
end $$;

-- ── personal: solo admin y directivo dan de alta o cambian personal y roles ──
-- (la lectura sigue abierta con personal_select, y el vínculo del primer login
-- lo hace link_current_user, que es SECURITY DEFINER)
drop policy if exists "personal_write" on personal;
drop policy if exists "personal_insert" on personal;
drop policy if exists "personal_update" on personal;
drop policy if exists "personal_delete" on personal;
create policy "personal_insert" on personal for insert to authenticated
  with check (public.es_admin());
create policy "personal_update" on personal for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy "personal_delete" on personal for delete to authenticated
  using (public.es_admin());

notify pgrst, 'reload schema';

commit;

-- Verificación: debe listar políticas de select/insert/update/delete en cada tabla
select tablename, policyname, cmd
from pg_policies
where tablename in ('config', 'ciclos', 'secciones', 'cursos', 'personal', 'permisos_configuracion')
order by tablename, cmd, policyname;
