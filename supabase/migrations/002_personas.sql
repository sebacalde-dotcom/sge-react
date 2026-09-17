-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Migración 002: Tabla personas (legajo universal)
-- Ejecutar en Supabase SQL Editor DESPUÉS de 001_schema.sql
-- ═════════════════════════════════════════════════════════════════════════

-- ── Enum de tipo de persona ───────────────────────────────────────────
CREATE TYPE persona_tipo AS ENUM ('alumno', 'docente', 'preceptor', 'directivo', 'padre', 'otro');

-- ── Personas (legajo universal) ───────────────────────────────────────
CREATE TABLE personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Datos personales
  apellido text NOT NULL,
  nombre text NOT NULL,
  dni text UNIQUE,
  fecha_nac date,
  sexo text,
  nacionalidad text,

  -- Domicilio
  calle text,
  numero text,
  piso text,
  depto text,
  localidad text,
  barrio text,
  cp text,
  provincia text,

  -- Contacto
  telefono text,
  email text,

  -- Foto
  foto_url text,

  -- Tipo principal (puede tener múltiples roles vía tablas satélite)
  tipo persona_tipo NOT NULL DEFAULT 'alumno',

  eliminado boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_personas_dni ON personas(dni);
CREATE INDEX idx_personas_email ON personas(email);
CREATE INDEX idx_personas_tipo ON personas(tipo);
CREATE INDEX idx_personas_apellido ON personas(apellido);
CREATE INDEX idx_personas_activos ON personas(eliminado) WHERE eliminado = false;

-- ── Trigger updated_at ────────────────────────────────────────────────
CREATE TRIGGER trg_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas_select" ON personas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "personas_write" ON personas FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());

-- ── Modificar tabla personal para referenciar personas ────────────────
-- personal pasa a ser la tabla satélite de rol institucional
ALTER TABLE personal ADD COLUMN persona_id uuid UNIQUE REFERENCES personas(id);

-- ── Datos específicos del alumno ──────────────────────────────────────
CREATE TABLE alumno_datos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL UNIQUE REFERENCES personas(id) ON DELETE CASCADE,
  ciclo_id uuid NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  curso_id uuid REFERENCES cursos(id) ON DELETE SET NULL,
  ingles_id uuid REFERENCES cursos(id) ON DELETE SET NULL,
  estado text NOT NULL DEFAULT 'activo',
  obra_social text,
  nro_socio text,
  apto_medico apto_medico_status DEFAULT 'pendiente',
  indicaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_alumno_datos_persona ON alumno_datos(persona_id);
CREATE INDEX idx_alumno_datos_ciclo ON alumno_datos(ciclo_id);
CREATE INDEX idx_alumno_datos_curso ON alumno_datos(curso_id);

CREATE TRIGGER trg_alumno_datos_updated_at
  BEFORE UPDATE ON alumno_datos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE alumno_datos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON alumno_datos FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());

-- ── Responsables (vincula alumno ↔ progenitor, ambos en personas) ─────
CREATE TABLE alumno_responsables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  responsable_persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  relacion text NOT NULL DEFAULT 'Progenitor/a',
  es_contacto_emergencia boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(alumno_persona_id, responsable_persona_id)
);

CREATE INDEX idx_responsables_alumno ON alumno_responsables(alumno_persona_id);
CREATE INDEX idx_responsables_responsable ON alumno_responsables(responsable_persona_id);

ALTER TABLE alumno_responsables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON alumno_responsables FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());

-- ── Retiros autorizados (se mantiene vinculado a persona alumno) ──────
CREATE TABLE persona_retiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  nombre text,
  dni text,
  parentesco text
);

CREATE INDEX idx_persona_retiros_alumno ON persona_retiros(alumno_persona_id);

ALTER TABLE persona_retiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON persona_retiros FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());

-- ── Autorizaciones del alumno ─────────────────────────────────────────
CREATE TABLE alumno_autorizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_persona_id uuid NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  autorizado boolean NOT NULL DEFAULT false,
  fecha date,
  observaciones text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_autorizaciones_alumno ON alumno_autorizaciones(alumno_persona_id);

ALTER TABLE alumno_autorizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON alumno_autorizaciones FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());

-- ── Ficha médica del alumno ───────────────────────────────────────────
CREATE TABLE alumno_ficha_medica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_persona_id uuid NOT NULL UNIQUE REFERENCES personas(id) ON DELETE CASCADE,
  grupo_sanguineo text,
  alergias text,
  medicacion text,
  obra_social text,
  nro_socio text,
  observaciones text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER trg_alumno_ficha_medica_updated_at
  BEFORE UPDATE ON alumno_ficha_medica
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE alumno_ficha_medica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON alumno_ficha_medica FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());
