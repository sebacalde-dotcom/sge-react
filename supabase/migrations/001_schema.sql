-- ═════════════════════════════════════════════════════════════════════════
-- SGE — Schema inicial
-- Ejecutar en Supabase SQL Editor
-- ═════════════════════════════════════════════════════════════════════════

-- ── Enums ──────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'directivo', 'docente', 'preceptor');
CREATE TYPE apto_medico_status AS ENUM ('pendiente', 'entregado', 'vencido');
CREATE TYPE turno_type AS ENUM ('manana', 'tarde');

-- ── Ciclos lectivos ────────────────────────────────────────────────────────
CREATE TABLE ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio int NOT NULL UNIQUE,
  inicio date,
  fin date,
  c1_desde date,
  c1_hasta date,
  c2_desde date,
  c2_hasta date,
  dias_especiales jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Secciones (modalidades) ────────────────────────────────────────────────
CREATE TABLE secciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  seccion text,
  descripcion text,
  titulo_obtenido text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_secciones_ciclo ON secciones(ciclo_id);

-- ── Cursos ─────────────────────────────────────────────────────────────────
CREATE TABLE cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  seccion_id uuid REFERENCES secciones(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  division text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_cursos_ciclo ON cursos(ciclo_id);
CREATE INDEX idx_cursos_seccion ON cursos(seccion_id);

-- ── Personal ───────────────────────────────────────────────────────────────
CREATE TABLE personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id),
  apellido text NOT NULL,
  nombre text NOT NULL,
  dni text UNIQUE,
  fecha_nac date,
  rol user_role NOT NULL DEFAULT 'docente',
  mail text UNIQUE,
  telefono text,
  calle text,
  numero text,
  piso text,
  depto text,
  cp text,
  localidad text,
  provincia text,
  foto_url text,
  eliminado boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_personal_mail ON personal(mail);
CREATE INDEX idx_personal_rol ON personal(rol);

CREATE TABLE personal_titulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_id uuid NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
  titulo text NOT NULL
);
CREATE INDEX idx_titulos_personal ON personal_titulos(personal_id);

-- ── Alumnos ────────────────────────────────────────────────────────────────
CREATE TABLE alumnos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  curso_id uuid REFERENCES cursos(id) ON DELETE SET NULL,
  ingles_id uuid REFERENCES cursos(id) ON DELETE SET NULL,
  apellido text NOT NULL,
  nombre text NOT NULL,
  dni text,
  fecha_nac date,
  sexo text,
  estado text NOT NULL DEFAULT 'activo',
  obra_social text,
  nro_socio text,
  apto_medico apto_medico_status DEFAULT 'pendiente',
  indicaciones text,
  aut_mediodia boolean DEFAULT false,
  aut_foto boolean DEFAULT false,
  aut_ef boolean DEFAULT false,
  foto_url text,
  eliminado boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(ciclo_id, dni)
);
CREATE INDEX idx_alumnos_ciclo ON alumnos(ciclo_id);
CREATE INDEX idx_alumnos_curso ON alumnos(curso_id);
CREATE INDEX idx_alumnos_dni ON alumnos(dni);
CREATE INDEX idx_alumnos_activos ON alumnos(eliminado) WHERE eliminado = false;

CREATE TABLE alumno_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nombre text,
  relacion text,
  telefono text,
  email text,
  notif boolean DEFAULT false
);
CREATE INDEX idx_contactos_alumno ON alumno_contactos(alumno_id);

CREATE TABLE alumno_retiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  nombre text,
  dni text,
  parentesco text
);
CREATE INDEX idx_retiros_alumno ON alumno_retiros(alumno_id);

-- ── Materias ───────────────────────────────────────────────────────────────
CREATE TABLE materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  personal_id uuid REFERENCES personal(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_materias_ciclo ON materias(ciclo_id);
CREATE INDEX idx_materias_curso ON materias(curso_id);
CREATE INDEX idx_materias_personal ON materias(personal_id);

CREATE TABLE materia_clases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id uuid NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
  dia text NOT NULL,
  turno text NOT NULL,
  hora_inicio time,
  hora_fin time
);
CREATE INDEX idx_clases_materia ON materia_clases(materia_id);

CREATE TABLE materia_alumnos (
  materia_id uuid NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
  alumno_id uuid NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  PRIMARY KEY (materia_id, alumno_id)
);
CREATE INDEX idx_mat_alumnos_alumno ON materia_alumnos(alumno_id);

-- ── Asistencia ─────────────────────────────────────────────────────────────
CREATE TABLE asistencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES ciclos(id),
  curso_id uuid NOT NULL REFERENCES cursos(id),
  alumno_id uuid NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  turno turno_type NOT NULL,
  tipo text,
  justificado boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(alumno_id, fecha, turno)
);
CREATE INDEX idx_asistencia_curso_fecha ON asistencia(ciclo_id, curso_id, fecha);
CREATE INDEX idx_asistencia_alumno ON asistencia(alumno_id);

-- ── Sanciones ──────────────────────────────────────────────────────────────
CREATE TABLE sanciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ciclo_id uuid NOT NULL REFERENCES ciclos(id),
  alumno_id uuid NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES cursos(id),
  docente_id uuid REFERENCES personal(id) ON DELETE SET NULL,
  tipo_id int NOT NULL,
  cantidad int NOT NULL DEFAULT 1,
  motivo text,
  fecha date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_sanciones_ciclo ON sanciones(ciclo_id);
CREATE INDEX idx_sanciones_alumno ON sanciones(alumno_id);
CREATE INDEX idx_sanciones_curso ON sanciones(curso_id);

-- ── Config ─────────────────────────────────────────────────────────────────
CREATE TABLE config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- ── Trigger para updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
    GROUP BY table_name
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Helper: usuario autenticado con registro en personal
CREATE OR REPLACE FUNCTION public.es_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM personal
    WHERE auth_user_id = auth.uid() AND eliminado = false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Habilitar RLS en todas las tablas
ALTER TABLE ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE secciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_titulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumno_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE alumno_retiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE materias ENABLE ROW LEVEL SECURITY;
ALTER TABLE materia_clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE materia_alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Política especial para personal: el usuario necesita leer su propia fila
-- para autenticarse (antes de estar "vinculado")
CREATE POLICY "personal_select" ON personal FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "personal_write" ON personal FOR ALL TO authenticated
  USING (public.es_staff()) WITH CHECK (public.es_staff());

-- Política general: staff autenticado puede todo
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY['ciclos','secciones','cursos','personal_titulos',
      'alumnos','alumno_contactos','alumno_retiros','materias',
      'materia_clases','materia_alumnos','asistencia','sanciones','config'])
  LOOP
    EXECUTE format('CREATE POLICY "staff_all" ON %I FOR ALL TO authenticated USING (public.es_staff()) WITH CHECK (public.es_staff())', t);
  END LOOP;
END $$;

-- ── Config inicial ─────────────────────────────────────────────────────────
INSERT INTO config (key, value) VALUES
  ('institucional', '{"nombre": "Mi Institución", "darkMode": false}'),
  ('inasistencias', '{"aviso1": 10, "aviso2": 15, "aviso3": 20, "tipos": [
    {"nombre": "Ausente", "valor": 1, "atajo": "a", "abrev": "A", "color": "#fee2e2", "colorText": "#991b1b"},
    {"nombre": "Tarde", "valor": 0.25, "atajo": "t", "abrev": "T", "color": "#fef3c7", "colorText": "#92400e"},
    {"nombre": "Tarde Completo", "valor": 0.5, "atajo": "c", "abrev": "TC", "color": "#fed7aa", "colorText": "#9a3412"},
    {"nombre": "No Computable", "valor": 0, "atajo": "n", "abrev": "NC", "color": "#e5e7eb", "colorText": "#374151"}
  ]}'),
  ('sanciones', '{"tipos": [
    {"nombre": "Llamado de atención", "color": "#fef3c7"},
    {"nombre": "Apercibimiento", "color": "#fed7aa"},
    {"nombre": "Amonestación", "color": "#fee2e2"}
  ]}'),
  ('notas', '{"etapas": [{"nombre": "1° Cuatrimestre"}, {"nombre": "2° Cuatrimestre"}], "incluirFinal": false}');
