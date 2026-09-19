-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 005: cartas de notificación de inasistencias a padres
-- Ejecutar en Supabase SQL Editor. Se puede correr más de una vez.
--
-- Guarda las cartas ya emitidas y su estado (impresa -> entregada -> firmada).
-- Las pendientes de imprimir NO se guardan: se calculan a partir de las
-- inasistencias y de las reglas de notificación.
-- ═════════════════════════════════════════════════════════════════════════

create table if not exists notificaciones_inasistencia (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  ciclo_id uuid not null references ciclos(id) on delete cascade,
  limite numeric not null,
  periodo text not null,
  periodo_desde date not null,
  estado text not null default 'impresa' check (estado in ('impresa', 'entregada', 'firmada')),
  datos jsonb not null default '{}',
  emitida_at timestamptz not null default now(),
  emitida_por uuid references personal(id),
  entregada_at timestamptz,
  firmada_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (persona_id, ciclo_id, limite, periodo, periodo_desde)
);

create index if not exists idx_notif_inasistencia_ciclo on notificaciones_inasistencia(ciclo_id);
create index if not exists idx_notif_inasistencia_estado on notificaciones_inasistencia(estado);

drop trigger if exists trg_notif_inasistencia_updated_at on notificaciones_inasistencia;
create trigger trg_notif_inasistencia_updated_at
  before update on notificaciones_inasistencia
  for each row execute function set_updated_at();

alter table notificaciones_inasistencia enable row level security;

drop policy if exists "notif_inasistencia_select" on notificaciones_inasistencia;
drop policy if exists "notif_inasistencia_write" on notificaciones_inasistencia;

create policy "notif_inasistencia_select" on notificaciones_inasistencia for select to authenticated
  using (true);

create policy "notif_inasistencia_write" on notificaciones_inasistencia for all to authenticated
  using (public.es_staff()) with check (public.es_staff());

notify pgrst, 'reload schema';

select policyname, cmd from pg_policies where tablename = 'notificaciones_inasistencia';
