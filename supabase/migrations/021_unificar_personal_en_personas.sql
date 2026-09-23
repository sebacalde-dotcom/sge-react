-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 021: unificar `personal` dentro de `personas`
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez (la parte que
-- mueve los datos de `personal` a `personas` se saltea si `personal` ya no existe).
--
-- Hasta ahora había dos tablas con datos de una misma persona: el legajo
-- (`personas`, con foto, domicilio, etc.) y la cuenta de sistema (`personal`, con
-- su propia copia de nombre/DNI/contacto, más `auth_user_id` y `rol`). Vinculaba
-- una con otra `personal.persona_id`, pero solo se completaba a mano y solo para
-- docentes (pestaña "Materias y disponibilidad" del legajo). Preceptores,
-- directivos y admins podían quedar como dos filas sueltas sin vincular, y editar
-- el domicilio o el teléfono de un lado no lo actualizaba del otro.
--
-- Ahora `personas` es la única fuente: le agrega `auth_user_id` (el login) y
-- `rol` (el permiso; nulo = sin acceso al sistema). `personal` desaparece.
--
--  * Se migran los datos de `personal` a `personas` (vinculando por persona_id,
--    si no por DNI, si no por mail; si no hay ninguna coincidencia se crea un
--    legajo nuevo) y se reapuntan a `personas` todas las columnas que hacían
--    referencia a `personal` (materias, disponibilidad docente, grupos de
--    agrupamientos, sanciones, títulos, y quién registró cada inasistencia,
--    notificación, reincorporación o pase).
--  * `es_staff()`, `rol_actual()` y `link_current_user()` pasan a mirar `personas`.
--    Solo una persona con `rol` asignado (por un admin o directivo) puede entrar:
--    asignar el rol es lo que "invita" a alguien, y no hace falta ningún link de
--    invitación aparte — la persona entra con Google usando el mail de su legajo.
--  * Archivar un legajo (`archivado_at`) ya alcanza para quitarle el acceso al
--    sistema (antes hacía falta además `personal.eliminado = true`); restaurarlo
--    se lo devuelve tal como estaba, con el mismo rol.
--  * Un trigger nuevo protege `rol` y `auth_user_id`: nadie puede cambiarlos salvo
--    un admin o directivo, excepto el propio primer login (que hace
--    `link_current_user`, con el mail ya coincidente).
--  * `personal_titulos` no se usa en la aplicación (no hay ninguna pantalla que lo
--    lea ni lo escriba) y se elimina. `sanciones` es de un modelo anterior que
--    tampoco se usa, pero se conserva por si tiene datos: solo se reapunta.
-- ═════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Columnas nuevas en personas ─────────────────────────────────────────
alter table personas add column if not exists auth_user_id uuid unique references auth.users(id);
alter table personas add column if not exists rol user_role;
create index if not exists idx_personas_rol on personas(rol) where rol is not null;

-- ── 2. Migrar los datos de personal a personas y reapuntar las referencias ──
do $$
declare
  r record;
  v_persona uuid;
  c record;
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'personal') then
    return; -- ya se migró antes
  end if;

  create temporary table mapa_personal_persona (personal_id uuid primary key, persona_id uuid not null) on commit drop;

  -- Sueltan primero todas las FK hacia personal (cualquiera sea su nombre): si no, las columnas no
  -- aceptan todavía un id de personas mientras la restricción vieja sigue exigiendo un id de personal.
  for c in select conrelid::regclass::text as tabla, conname from pg_constraint where confrelid = 'personal'::regclass and contype = 'f' loop
    execute format('alter table %s drop constraint %I', c.tabla, c.conname);
  end loop;

  for r in select * from personal loop
    v_persona := null;

    if r.persona_id is not null and exists (select 1 from personas where id = r.persona_id) then
      v_persona := r.persona_id;
    end if;
    if v_persona is null and r.dni is not null then
      select id into v_persona from personas where dni = r.dni limit 1;
    end if;
    if v_persona is null and r.mail is not null then
      select id into v_persona from personas where lower(email) = lower(r.mail) limit 1;
    end if;

    if v_persona is null then
      insert into personas (apellido, nombre, dni, fecha_nac, email, telefono, calle, numero, piso, depto, cp, localidad, provincia, foto_url, tipo, archivado_at)
      values (
        r.apellido, r.nombre, r.dni, r.fecha_nac, r.mail, r.telefono, r.calle, r.numero, r.piso, r.depto, r.cp, r.localidad, r.provincia, r.foto_url,
        case r.rol
          when 'docente' then 'docente'::persona_tipo
          when 'preceptor' then 'preceptor'::persona_tipo
          when 'directivo' then 'directivo'::persona_tipo
          else 'otro'::persona_tipo -- 'admin' no tiene tipo de legajo propio; se puede ajustar a mano después
        end,
        case when r.eliminado then now() else null end
      )
      returning id into v_persona;
    else
      -- No se pisa nada de lo que ya está cargado en el legajo: solo se completa lo que falta
      update personas set
        email = coalesce(email, r.mail),
        telefono = coalesce(telefono, r.telefono),
        foto_url = coalesce(foto_url, r.foto_url),
        calle = coalesce(calle, r.calle),
        numero = coalesce(numero, r.numero),
        piso = coalesce(piso, r.piso),
        depto = coalesce(depto, r.depto),
        cp = coalesce(cp, r.cp),
        localidad = coalesce(localidad, r.localidad),
        provincia = coalesce(provincia, r.provincia),
        fecha_nac = coalesce(fecha_nac, r.fecha_nac)
      where id = v_persona;
    end if;

    -- Si dos filas de personal apuntaran al mismo legajo (no debería pasar: persona_id era UNIQUE
    -- en personal), se conserva el primer auth_user_id/rol migrado y no se pisa.
    update personas set
      auth_user_id = coalesce(auth_user_id, r.auth_user_id),
      rol = coalesce(rol, r.rol)
    where id = v_persona;

    insert into mapa_personal_persona (personal_id, persona_id) values (r.id, v_persona);
  end loop;

  update materias m set personal_id = mp.persona_id from mapa_personal_persona mp where m.personal_id = mp.personal_id;
  update docente_disponibilidad d set personal_id = mp.persona_id from mapa_personal_persona mp where d.personal_id = mp.personal_id;
  update grupos g set personal_id = mp.persona_id from mapa_personal_persona mp where g.personal_id = mp.personal_id;
  update sanciones s set docente_id = mp.persona_id from mapa_personal_persona mp where s.docente_id = mp.personal_id;
  update inasistencias i set registrado_por = mp.persona_id from mapa_personal_persona mp where i.registrado_por = mp.personal_id;
  update notificaciones_inasistencia n set emitida_por = mp.persona_id from mapa_personal_persona mp where n.emitida_por = mp.personal_id;
  update reincorporaciones re set autorizada_por = mp.persona_id from mapa_personal_persona mp where re.autorizada_por = mp.personal_id;
  update pases pa set registrado_por = mp.persona_id from mapa_personal_persona mp where pa.registrado_por = mp.personal_id;

  drop table if exists personal_titulos; -- no se usa en la aplicación; se elimina en vez de reapuntarla
  drop table personal;
end $$;

-- ── 3. Nuevas referencias a personas, con el mismo on delete que tenían ─────
alter table materias add constraint materias_personal_id_fkey foreign key (personal_id) references personas(id) on delete set null;
alter table docente_disponibilidad add constraint docente_disponibilidad_personal_id_fkey foreign key (personal_id) references personas(id) on delete cascade;
alter table grupos add constraint grupos_personal_id_fkey foreign key (personal_id) references personas(id) on delete set null;
alter table sanciones add constraint sanciones_docente_id_fkey foreign key (docente_id) references personas(id) on delete set null;
alter table inasistencias add constraint inasistencias_registrado_por_fkey foreign key (registrado_por) references personas(id);
alter table notificaciones_inasistencia add constraint notificaciones_inasistencia_emitida_por_fkey foreign key (emitida_por) references personas(id);
alter table reincorporaciones add constraint reincorporaciones_autorizada_por_fkey foreign key (autorizada_por) references personas(id);
alter table pases add constraint pases_registrado_por_fkey foreign key (registrado_por) references personas(id);

-- ── 4. es_staff, rol_actual y el vínculo del primer login pasan a mirar personas ──
create or replace function public.es_staff()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from personas
    where auth_user_id = auth.uid() and archivado_at is null and rol is not null
  )
$$;

create or replace function public.rol_actual()
returns user_role
language sql security definer stable set search_path = public as $$
  select rol from personas where auth_user_id = auth.uid() and archivado_at is null limit 1
$$;

-- Solo vincula si hay una única persona con ese mail y con rol ya asignado por un admin:
-- asignarle el rol a alguien en su legajo es lo que le da acceso, no hace falta más.
create or replace function public.link_current_user()
returns void
language plpgsql security definer as $$
begin
  update personas
  set auth_user_id = auth.uid()
  where id = (
    select id from personas
    where lower(email) = lower(auth.jwt() ->> 'email') and auth_user_id is null and rol is not null
    limit 1
  );
end;
$$;

-- ── 5. Proteger quién puede dar o quitar acceso al sistema ──────────────────
create or replace function public.proteger_acceso_persona()
returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (new.rol is not null or new.auth_user_id is not null) and auth.uid() is not null and not public.es_admin() then
      raise exception 'Solo administradores y directivos pueden dar acceso al sistema';
    end if;
    return new;
  end if;

  if new.rol is distinct from old.rol and auth.uid() is not null and not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden dar o quitar el acceso al sistema';
  end if;
  if new.auth_user_id is distinct from old.auth_user_id and auth.uid() is not null and not public.es_admin() then
    -- Única excepción: la propia persona vinculándose en su primer login (lo que hace link_current_user)
    if not (
      old.auth_user_id is null
      and new.auth_user_id = auth.uid()
      and new.rol is not null
      and lower(new.email) = lower(auth.jwt() ->> 'email')
    ) then
      raise exception 'Solo administradores y directivos pueden vincular una cuenta de Google a otro legajo';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_personas_proteger_acceso on personas;
create trigger trg_personas_proteger_acceso
  before insert or update on personas
  for each row execute function public.proteger_acceso_persona();

-- ── 6. archivar/desarchivar/eliminar legajo: ya no hace falta tocar personal ─
create or replace function public.archivar_legajo(p_persona uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden archivar legajos';
  end if;
  if not exists (select 1 from personas where id = p_persona) then
    raise exception 'El legajo no existe';
  end if;
  if exists (select 1 from personas where id = p_persona and auth_user_id = auth.uid()) then
    raise exception 'No podés archivar tu propio legajo';
  end if;
  update personas set archivado_at = coalesce(archivado_at, now()) where id = p_persona;
  update alumno_datos set estado = 'archivado' where persona_id = p_persona;
end $$;

create or replace function public.desarchivar_legajo(p_persona uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden restaurar legajos';
  end if;
  update personas set archivado_at = null where id = p_persona;
  update alumno_datos
  set estado = case
    when exists (select 1 from pases where persona_id = p_persona and anulado_at is null) then 'pase'
    else 'activo'
  end
  where persona_id = p_persona and estado = 'archivado';
end $$;

create or replace function public.eliminar_legajo(p_persona uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_huerfanos uuid[];
begin
  if not public.es_admin() then
    raise exception 'Solo administradores y directivos pueden eliminar legajos';
  end if;
  if not exists (select 1 from personas where id = p_persona and archivado_at is not null) then
    raise exception 'Solo se pueden eliminar legajos archivados';
  end if;
  if exists (select 1 from personas where id = p_persona and rol is not null) then
    raise exception 'El personal con acceso al sistema (o que lo tuvo) se archiva pero no se elimina, para conservar el historial de lo que registró';
  end if;

  select coalesce(array_agg(r.responsable_persona_id), '{}') into v_huerfanos
  from alumno_responsables r
  join personas p on p.id = r.responsable_persona_id
  where r.alumno_persona_id = p_persona
    and p.tipo = 'padre'
    and p.rol is null
    and not exists (
      select 1 from alumno_responsables o
      where o.responsable_persona_id = r.responsable_persona_id and o.alumno_persona_id <> p_persona
    );

  delete from personas where id = p_persona;
  delete from personas where id = any(v_huerfanos);
end $$;

revoke all on function public.archivar_legajo(uuid) from public;
revoke all on function public.desarchivar_legajo(uuid) from public;
revoke all on function public.eliminar_legajo(uuid) from public;
grant execute on function public.archivar_legajo(uuid) to authenticated;
grant execute on function public.desarchivar_legajo(uuid) to authenticated;
grant execute on function public.eliminar_legajo(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Verificación: "personal" no debe aparecer, y personas debe tener auth_user_id y rol
select 'tabla personal eliminada' as elemento where not exists (
  select 1 from information_schema.tables where table_schema = 'public' and table_name = 'personal'
)
union all
select table_name || '.' || column_name from information_schema.columns
where table_name = 'personas' and column_name in ('auth_user_id', 'rol')
union all
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('es_staff', 'rol_actual', 'link_current_user', 'archivar_legajo', 'desarchivar_legajo', 'eliminar_legajo')
union all
-- Cuántas personas quedaron con acceso al sistema, por rol
select rol || ': ' || count(*) from personas where rol is not null group by rol
order by 1;
