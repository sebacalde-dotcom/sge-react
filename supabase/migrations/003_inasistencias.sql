-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 003: Inasistencias
-- Ejecutar en Supabase SQL Editor DESPUÉS de 002_personas.sql
-- ═════════════════════════════════════════════════════════════════════════

-- ── Inasistencias ─────────────────────────────────────────────────────
CREATE TABLE inasistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  ciclo_id uuid NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  turno text NOT NULL DEFAULT 'unico',  -- 'unico', 'manana', 'tarde'
  tipo text NOT NULL DEFAULT 'ausente', -- configurable: 'ausente', 'tarde', etc.
  valor numeric(3,2) NOT NULL DEFAULT 1, -- 1 = falta entera, 0.5 = media, etc.
  justificada boolean NOT NULL DEFAULT false,
  observaciones text,
  registrado_por uuid REFERENCES personal(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(persona_id, fecha, turno)
);

CREATE INDEX idx_inasistencias_persona ON inasistencias(persona_id);
CREATE INDEX idx_inasistencias_ciclo ON inasistencias(ciclo_id);
CREATE INDEX idx_inasistencias_fecha ON inasistencias(fecha);
CREATE INDEX idx_inasistencias_persona_ciclo ON inasistencias(persona_id, ciclo_id);

CREATE TRIGGER trg_inasistencias_updated_at
  BEFORE UPDATE ON inasistencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE inasistencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inasistencias_select" ON inasistencias FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "inasistencias_write" ON inasistencias FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());
