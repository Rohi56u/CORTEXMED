-- =============================================================================
-- CORTEXMED COMPLETE SUPABASE DATABASE SETUP & CLINICAL MIGRATION
-- Run this script in the Supabase Dashboard -> SQL Editor (New Query)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. BASE SYSTEM SCHEMA (Patients, Events, State)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  display_name text NOT NULL,
  room_number text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.patient_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  card_json jsonb NOT NULL,
  source text NOT NULL DEFAULT 'manual_entry',
  schema_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_cards_patient_latest
  ON public.patient_cards (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'GREEN',
  receipt_text text,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'backend',
  schema_version int NOT NULL DEFAULT 1,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_idempotency_key
  ON public.events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_patient_created_desc
  ON public.events (patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_patient_type
  ON public.events (patient_id, type);

CREATE TABLE IF NOT EXISTS public.object_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  object_name text NOT NULL,
  context text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'FOUND', 'NOT_FOUND')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_location jsonb,
  confidence float
);

CREATE INDEX IF NOT EXISTS idx_object_requests_patient_status
  ON public.object_requests (patient_id, status);

CREATE TABLE IF NOT EXISTS public.object_state (
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  object_name text NOT NULL,
  location jsonb,
  confidence float,
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text,
  UNIQUE (patient_id, object_name)
);

CREATE TABLE IF NOT EXISTS public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  channel text NOT NULL,
  target text,
  status text NOT NULL,
  attempt_count int NOT NULL DEFAULT 1,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalations_patient_created_desc
  ON public.escalations (patient_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. CORTEXMED CLINICAL DECISION SUPPORT SCHEMA
-- -----------------------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS idx_dosage_logs_cooldown
  ON public.dosage_logs (patient_id, medication_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS idx_dosage_logs_patient_taken
  ON public.dosage_logs (patient_id, taken_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_vitals_telemetry_patient_recorded
  ON public.vitals_telemetry (patient_id, recorded_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_spatial_memory_objects_lookup
  ON public.spatial_memory_objects (patient_id, object_label, last_seen_at DESC);

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS & RLS CONFIGURATION
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_medications_updated_at ON public.medications;
CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_spatial_memory_objects_updated_at ON public.spatial_memory_objects;
CREATE TRIGGER trg_spatial_memory_objects_updated_at
  BEFORE UPDATE ON public.spatial_memory_objects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.object_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dosage_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitals_telemetry DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_safety_alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.spatial_memory_objects DISABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOR t IN SELECT unnest(ARRAY[
    'events',
    'object_requests',
    'object_state',
    'medications',
    'dosage_logs',
    'vitals_telemetry',
    'clinical_safety_alerts',
    'spatial_memory_objects'
  ])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION 
      WHEN duplicate_object THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. SEED DEMO PATIENTS & ACTIVE PRESCRIPTIONS
-- -----------------------------------------------------------------------------

INSERT INTO public.patients (id, display_name, room_number) VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001', 'Margaret Chen', '204'),
  ('a1b2c3d4-0002-4000-8000-000000000002', 'Robert Williams', '112'),
  ('a1b2c3d4-0003-4000-8000-000000000003', 'Helen Garcia', '318')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, room_number = EXCLUDED.room_number;

-- Margaret Chen's Active Prescriptions (Donepezil, Warfarin, Metformin)
INSERT INTO public.medications (id, patient_id, drug_name, generic_name, rxcui, strength, dosage_instructions, min_interval_hours, prescribed_times, is_active)
VALUES
  ('b1b2c3d4-0001-4000-8000-000000000001', 'a1b2c3d4-0001-4000-8000-000000000001', 'Donepezil', 'donepezil', '135447', '5mg', 'Take 1 tablet by mouth daily at bedtime', 24, ARRAY['21:00'], true),
  ('b1b2c3d4-0001-4000-8000-000000000002', 'a1b2c3d4-0001-4000-8000-000000000001', 'Warfarin', 'warfarin', '11289', '5mg', 'Take 1 tablet by mouth daily as directed', 24, ARRAY['18:00'], true),
  ('b1b2c3d4-0001-4000-8000-000000000003', 'a1b2c3d4-0001-4000-8000-000000000001', 'Metformin', 'metformin', '6809', '500mg', 'Take 1 tablet twice daily with meals', 10, ARRAY['08:00', '20:00'], true)
ON CONFLICT (id) DO NOTHING;
