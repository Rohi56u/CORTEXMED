-- CortexMed Phase 2 Clinical Database Schema
-- Idempotent, additive migration for clinical data layer
-- Conforms strictly to patients.id (UUID) foreign key convention from 001_schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Medications Table: Active prescriptions, RxNorm identifiers, and minimum interval cooldowns
CREATE TABLE IF NOT EXISTS public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  drug_name text NOT NULL,
  generic_name text,
  rxcui text,
  strength text NOT NULL,
  dosage_instructions text,
  min_interval_hours numeric NOT NULL,
  prescribed_times text[] DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medications_patient_active
  ON public.medications (patient_id, is_active);

CREATE INDEX IF NOT EXISTS idx_medications_patient_drug
  ON public.medications (patient_id, drug_name);

-- 2. Dosage Logs Table: Real-world ingestion events and double-dose guard tracking
CREATE TABLE IF NOT EXISTS public.dosage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES public.medications(id) ON DELETE SET NULL,
  detected_drug_name text,
  status text NOT NULL CHECK (status IN ('TAKEN', 'BLOCKED_DOUBLE_DOSE', 'BLOCKED_INTERACTION', 'SKIPPED')),
  taken_at timestamptz NOT NULL DEFAULT now(),
  verification_source text NOT NULL CHECK (verification_source IN ('BOTTLE_OCR', 'VOICE_LOG', 'CAREGIVER_MANUAL')),
  confidence_score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for fast temporal cooldown queries
CREATE INDEX IF NOT EXISTS idx_dosage_logs_cooldown
  ON public.dosage_logs (patient_id, medication_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_dosage_logs_patient_taken
  ON public.dosage_logs (patient_id, taken_at DESC);

-- 3. Vitals Telemetry Table: Real-time physiological signals and agitation markers
CREATE TABLE IF NOT EXISTS public.vitals_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  heart_rate_bpm numeric NOT NULL,
  hrv_rmssd_ms numeric,
  signal_quality_index numeric CHECK (signal_quality_index >= 0 AND signal_quality_index <= 1),
  agitation_detected boolean NOT NULL DEFAULT false,
  agitation_reason text,
  window_seconds integer,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for rolling stats and latest vitals retrieval
CREATE INDEX IF NOT EXISTS idx_vitals_telemetry_patient_recorded
  ON public.vitals_telemetry (patient_id, recorded_at DESC);

-- 4. Clinical Safety Alerts Table: Auditable clinical verdicts and multi-lingual alerts
CREATE TABLE IF NOT EXISTS public.clinical_safety_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('SAFE', 'CAUTION', 'CRITICAL_BLOCK')),
  alert_type text NOT NULL CHECK (alert_type IN ('DOUBLE_DOSE', 'DRUG_INTERACTION', 'FDA_BOXED_WARNING', 'SUNDOWNING_AGITATION', 'UNRECOGNIZED_MEDICATION')),
  detected_drug text,
  conflicting_drug text,
  spoken_warning_en text,
  spoken_warning_hi text,
  source_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient_created
  ON public.clinical_safety_alerts (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_patient_ack
  ON public.clinical_safety_alerts (patient_id, acknowledged);

-- 5. Spatial Memory Objects Table: Tracked physical objects with zone & coordinates
CREATE TABLE IF NOT EXISTS public.spatial_memory_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  object_label text NOT NULL,
  location_description text,
  room_zone text,
  coordinates jsonb,
  confidence numeric,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for fast object label recall
CREATE INDEX IF NOT EXISTS idx_spatial_memory_objects_lookup
  ON public.spatial_memory_objects (patient_id, object_label, last_seen_at DESC);

-- Ensure set_updated_at helper function exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at tracking
DROP TRIGGER IF EXISTS trg_medications_updated_at ON public.medications;
CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_spatial_memory_objects_updated_at ON public.spatial_memory_objects;
CREATE TRIGGER trg_spatial_memory_objects_updated_at
  BEFORE UPDATE ON public.spatial_memory_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Disable RLS consistently with previous project migrations
ALTER TABLE public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dosage_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals_telemetry DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_safety_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.spatial_memory_objects DISABLE ROW LEVEL SECURITY;

-- 6. Guarded Supabase Realtime publication setup
-- Re-running never throws duplicate-object errors if tables are already published
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'medications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.medications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dosage_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dosage_logs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vitals_telemetry'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vitals_telemetry;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'clinical_safety_alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_safety_alerts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'spatial_memory_objects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spatial_memory_objects;
  END IF;
END $$;
