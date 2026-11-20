// CortexMed - Clinical Contracts and Runtime Schema Validators
// Preserves all existing event spine exports while providing strict clinical typing

export const EVENT_TYPES = [
  "CHAT_USER_UTTERANCE",
  "CHAT_ASSISTANT_RESPONSE",
  "CHAT_STEP",
  "FIND_OBJECT_REQUESTED",
  "OBJECT_LOCATED",
  "OBJECT_NOT_FOUND",
  "ESCALATED",
  "WEB_SEARCH_COMPLETED",
  "CLINICAL_GUIDELINE_CHECKED",
  "CLINICAL_ALERT_TRIGGERED",
  "MEDICATION_LOGGED",
  "VITALS_RECORDED",
  "SPATIAL_OBJECT_UPDATED",
] as const;

export const SEVERITIES = ["GREEN", "YELLOW", "ORANGE", "RED"] as const;
export const SOURCES = ["device", "dashboard", "backend", "cv_team", "clinical_guard"] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Source = (typeof SOURCES)[number];

export type EventInput = {
  patient_id: string;
  type: EventType;
  severity: Severity;
  receipt_text?: string;
  decision?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  source?: Source;
  idempotency_key?: string;
};

const eventTypeSet = new Set<string>(EVENT_TYPES);
const severitySet = new Set<string>(SEVERITIES);
const sourceSet = new Set<string>(SOURCES);

export function parseEventInput(body: Record<string, unknown>): EventInput {
  const { patient_id, type, severity, receipt_text, decision, payload, evidence, source, idempotency_key } = body;

  if (!patient_id || typeof patient_id !== "string") {
    throw new Error("patient_id (string) is required");
  }
  if (!type || typeof type !== "string" || !eventTypeSet.has(type)) {
    throw new Error(`type must be one of: ${EVENT_TYPES.join(", ")}`);
  }
  if (!severity || typeof severity !== "string" || !severitySet.has(severity)) {
    throw new Error(`severity must be one of: ${SEVERITIES.join(", ")}`);
  }
  if (source && (typeof source !== "string" || !sourceSet.has(source))) {
    throw new Error(`source must be one of: ${SOURCES.join(", ")}`);
  }

  return {
    patient_id: patient_id as string,
    type: type as EventType,
    severity: severity as Severity,
    receipt_text: typeof receipt_text === "string" ? receipt_text : undefined,
    decision: (decision as Record<string, unknown>) ?? undefined,
    payload: (payload as Record<string, unknown>) ?? undefined,
    evidence: (evidence as Record<string, unknown>) ?? undefined,
    source: (source as Source) ?? undefined,
    idempotency_key: typeof idempotency_key === "string" ? idempotency_key : undefined,
  };
}

export function parseQueryFilters(params: URLSearchParams): { patient_id: string; since?: string } {
  const patient_id = params.get("patient_id");
  if (!patient_id) throw new Error("patient_id query param is required");
  const since = params.get("since") ?? undefined;
  return { patient_id, since };
}

// ────────────────────────────────────────────────────────────────
// CortexMed Clinical Contracts
// ────────────────────────────────────────────────────────────────

export interface Medication {
  id: string;
  patient_id: string;
  drug_name: string;
  generic_name?: string | null;
  rxcui?: string | null;
  strength: string;
  dosage_instructions?: string | null;
  min_interval_hours: number;
  prescribed_times?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const DOSAGE_LOG_STATUSES = [
  "TAKEN",
  "BLOCKED_DOUBLE_DOSE",
  "BLOCKED_INTERACTION",
  "SKIPPED",
] as const;
export type DosageLogStatus = (typeof DOSAGE_LOG_STATUSES)[number];

export const VERIFICATION_SOURCES = [
  "BOTTLE_OCR",
  "VOICE_LOG",
  "CAREGIVER_MANUAL",
] as const;
export type VerificationSource = (typeof VERIFICATION_SOURCES)[number];

export interface DosageLog {
  id: string;
  patient_id: string;
  medication_id?: string | null;
  detected_drug_name?: string | null;
  status: DosageLogStatus;
  taken_at: string;
  verification_source: VerificationSource;
  confidence_score?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface VitalsTelemetry {
  id: string;
  patient_id: string;
  heart_rate_bpm: number;
  hrv_rmssd_ms?: number | null;
  signal_quality_index?: number | null;
  agitation_detected: boolean;
  agitation_reason?: string | null;
  window_seconds?: number | null;
  recorded_at: string;
}

export const CLINICAL_VERDICTS = ["SAFE", "CAUTION", "CRITICAL_BLOCK"] as const;
export type ClinicalVerdict = (typeof CLINICAL_VERDICTS)[number];

export const CLINICAL_ALERT_TYPES = [
  "DOUBLE_DOSE",
  "DRUG_INTERACTION",
  "FDA_BOXED_WARNING",
  "SUNDOWNING_AGITATION",
  "UNRECOGNIZED_MEDICATION",
] as const;
export type ClinicalAlertType = (typeof CLINICAL_ALERT_TYPES)[number];

export interface ClinicalCitation {
  source: string;
  url?: string;
  evidence_level?: "high" | "moderate" | "low" | string;
  snippet?: string;
  rxcui?: string;
  fda_set_id?: string;
}

export interface ClinicalSafetyAlert {
  id: string;
  patient_id: string;
  verdict: ClinicalVerdict;
  alert_type: ClinicalAlertType;
  detected_drug?: string | null;
  conflicting_drug?: string | null;
  spoken_warning_en?: string | null;
  spoken_warning_hi?: string | null;
  source_citations: ClinicalCitation[];
  acknowledged: boolean;
  acknowledged_at?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface SpatialMemoryObject {
  id: string;
  patient_id: string;
  object_label: string;
  location_description?: string | null;
  room_zone?: string | null;
  coordinates?: { x?: number; y?: number; z?: number; [key: string]: unknown } | null;
  confidence?: number | null;
  last_seen_at: string;
  updated_at: string;
}

export interface BottleVerificationRequest {
  patient_id: string;
  detected_drug_name: string;
  detected_strength?: string;
  source: VerificationSource;
  confidence_score?: number;
  image_base64?: string;
}

export interface BottleVerificationResponse {
  verdict: ClinicalVerdict;
  matched_medication?: Medication | null;
  hours_since_last_dose?: number | null;
  within_cooldown_window: boolean;
  cooldown_remaining_hours?: number | null;
  alert?: ClinicalSafetyAlert | null;
  spoken_warning_en?: string;
  spoken_warning_hi?: string;
  citations: ClinicalCitation[];
  node_trace?: Array<{ node: string; status: string; latency_ms: number; detail?: string }>;
  extracted_ocr?: Record<string, any> | null;
}

// ────────────────────────────────────────────────────────────────
// CortexMed Contactless rPPG Contracts
// ────────────────────────────────────────────────────────────────

export interface NormalizedRoi {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string | null;
}

export interface FaceRoiResponse {
  face_detected: boolean;
  frame_width: number;
  frame_height: number;
  face_roi?: NormalizedRoi | null;
  forehead_roi?: NormalizedRoi | null;
  left_cheek_roi?: NormalizedRoi | null;
  right_cheek_roi?: NormalizedRoi | null;
  skin_pixel_ratio?: number | null;
  message: string;
}

export interface RgbSample {
  t_ms: number;
  r: number;
  g: number;
  b: number;
}

export interface RppgProcessResponse {
  status: "OK" | "BUFFERING" | "LOW_SIGNAL_QUALITY" | "INSUFFICIENT_DATA" | string;
  heart_rate_bpm?: number | null;
  hrv_rmssd_ms?: number | null;
  signal_quality_index?: number | null;
  agitation_detected: boolean;
  agitation_reason?: string | null;
  baseline_source?: "patient_history" | "clinical_reference" | string | null;
  bvp_waveform: number[];
  window_seconds: number;
  persisted_vital_id?: string | null;
  alert_created: boolean;
  message?: string | null;
}


// ────────────────────────────────────────────────────────────────
// MCP Tool Contracts
// ────────────────────────────────────────────────────────────────

export interface McpToolProperty {
  type: string;
  description?: string;
  enum?: readonly string[] | string[];
  items?: Record<string, unknown>;
  default?: unknown;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

export type McpToolResult<T = unknown> =
  | {
      ok: true;
      data: T;
      timestamp: string;
    }
  | {
      ok: false;
      error: string;
      code: string;
      timestamp: string;
    };

// ────────────────────────────────────────────────────────────────
// Runtime Input Validation Helpers
// ────────────────────────────────────────────────────────────────

const dosageStatusSet = new Set<string>(DOSAGE_LOG_STATUSES);
const verificationSourceSet = new Set<string>(VERIFICATION_SOURCES);
const verdictSet = new Set<string>(CLINICAL_VERDICTS);
const alertTypeSet = new Set<string>(CLINICAL_ALERT_TYPES);

export function parseMedicationInput(body: Record<string, unknown>): {
  patient_id: string;
  drug_name: string;
  generic_name?: string;
  rxcui?: string;
  strength: string;
  dosage_instructions?: string;
  min_interval_hours: number;
  prescribed_times?: string[];
  is_active?: boolean;
} {
  const {
    patient_id,
    drug_name,
    generic_name,
    rxcui,
    strength,
    dosage_instructions,
    min_interval_hours,
    prescribed_times,
    is_active,
  } = body;

  if (!patient_id || typeof patient_id !== "string") {
    throw new Error("patient_id (string) is required");
  }
  if (!drug_name || typeof drug_name !== "string" || !drug_name.trim()) {
    throw new Error("drug_name (string) is required");
  }
  if (!strength || typeof strength !== "string" || !strength.trim()) {
    throw new Error("strength (string, e.g. '10mg') is required");
  }

  const minInterval = typeof min_interval_hours === "number"
    ? min_interval_hours
    : typeof min_interval_hours === "string"
      ? parseFloat(min_interval_hours)
      : NaN;

  if (isNaN(minInterval) || minInterval < 0) {
    throw new Error("min_interval_hours (non-negative number) is required");
  }

  let validTimes: string[] | undefined;
  if (Array.isArray(prescribed_times)) {
    validTimes = prescribed_times.filter((t): t is string => typeof t === "string");
  }

  return {
    patient_id: patient_id.trim(),
    drug_name: drug_name.trim(),
    generic_name: typeof generic_name === "string" ? generic_name.trim() : undefined,
    rxcui: typeof rxcui === "string" ? rxcui.trim() : undefined,
    strength: strength.trim(),
    dosage_instructions: typeof dosage_instructions === "string" ? dosage_instructions.trim() : undefined,
    min_interval_hours: minInterval,
    prescribed_times: validTimes,
    is_active: typeof is_active === "boolean" ? is_active : true,
  };
}

export function parseDosageLogInput(body: Record<string, unknown>): {
  patient_id: string;
  medication_id?: string;
  detected_drug_name?: string;
  status: DosageLogStatus;
  verification_source: VerificationSource;
  confidence_score?: number;
  notes?: string;
  taken_at?: string;
} {
  const {
    patient_id,
    medication_id,
    detected_drug_name,
    status,
    verification_source,
    confidence_score,
    notes,
    taken_at,
  } = body;

  if (!patient_id || typeof patient_id !== "string") {
    throw new Error("patient_id (string) is required");
  }
  if (!status || typeof status !== "string" || !dosageStatusSet.has(status)) {
    throw new Error(`status must be one of: ${DOSAGE_LOG_STATUSES.join(", ")}`);
  }
  if (
    !verification_source ||
    typeof verification_source !== "string" ||
    !verificationSourceSet.has(verification_source)
  ) {
    throw new Error(`verification_source must be one of: ${VERIFICATION_SOURCES.join(", ")}`);
  }

  return {
    patient_id: patient_id.trim(),
    medication_id: typeof medication_id === "string" && medication_id.trim() ? medication_id.trim() : undefined,
    detected_drug_name: typeof detected_drug_name === "string" ? detected_drug_name.trim() : undefined,
    status: status as DosageLogStatus,
    verification_source: verification_source as VerificationSource,
    confidence_score: typeof confidence_score === "number" ? confidence_score : undefined,
    notes: typeof notes === "string" ? notes.trim() : undefined,
    taken_at: typeof taken_at === "string" ? taken_at : undefined,
  };
}

export function parseVitalsTelemetryInput(body: Record<string, unknown>): {
  patient_id: string;
  heart_rate_bpm: number;
  hrv_rmssd_ms?: number;
  signal_quality_index?: number;
  agitation_detected?: boolean;
  agitation_reason?: string;
  window_seconds?: number;
  recorded_at?: string;
} {
  const {
    patient_id,
    heart_rate_bpm,
    hrv_rmssd_ms,
    signal_quality_index,
    agitation_detected,
    agitation_reason,
    window_seconds,
    recorded_at,
  } = body;

  if (!patient_id || typeof patient_id !== "string") {
    throw new Error("patient_id (string) is required");
  }

  const hr = typeof heart_rate_bpm === "number" ? heart_rate_bpm : parseFloat(String(heart_rate_bpm));
  if (isNaN(hr) || hr <= 0 || hr > 300) {
    throw new Error("heart_rate_bpm must be a plausible number between 1 and 300");
  }

  let sqi: number | undefined;
  if (signal_quality_index !== undefined && signal_quality_index !== null) {
    const val = typeof signal_quality_index === "number" ? signal_quality_index : parseFloat(String(signal_quality_index));
    if (isNaN(val) || val < 0 || val > 1) {
      throw new Error("signal_quality_index must be a number between 0 and 1");
    }
    sqi = val;
  }

  return {
    patient_id: patient_id.trim(),
    heart_rate_bpm: hr,
    hrv_rmssd_ms: typeof hrv_rmssd_ms === "number" ? hrv_rmssd_ms : undefined,
    signal_quality_index: sqi,
    agitation_detected: Boolean(agitation_detected),
    agitation_reason: typeof agitation_reason === "string" ? agitation_reason.trim() : undefined,
    window_seconds: typeof window_seconds === "number" ? window_seconds : undefined,
    recorded_at: typeof recorded_at === "string" ? recorded_at : undefined,
  };
}

export function parseClinicalSafetyAlertInput(body: Record<string, unknown>): {
  patient_id: string;
  verdict: ClinicalVerdict;
  alert_type: ClinicalAlertType;
  detected_drug?: string;
  conflicting_drug?: string;
  spoken_warning_en?: string;
  spoken_warning_hi?: string;
  source_citations?: ClinicalCitation[];
  metadata?: Record<string, unknown>;
} {
  const {
    patient_id,
    verdict,
    alert_type,
    detected_drug,
    conflicting_drug,
    spoken_warning_en,
    spoken_warning_hi,
    source_citations,
    metadata,
  } = body;

  if (!patient_id || typeof patient_id !== "string") {
    throw new Error("patient_id (string) is required");
  }
  if (!verdict || typeof verdict !== "string" || !verdictSet.has(verdict)) {
    throw new Error(`verdict must be one of: ${CLINICAL_VERDICTS.join(", ")}`);
  }
  if (!alert_type || typeof alert_type !== "string" || !alertTypeSet.has(alert_type)) {
    throw new Error(`alert_type must be one of: ${CLINICAL_ALERT_TYPES.join(", ")}`);
  }

  return {
    patient_id: patient_id.trim(),
    verdict: verdict as ClinicalVerdict,
    alert_type: alert_type as ClinicalAlertType,
    detected_drug: typeof detected_drug === "string" ? detected_drug.trim() : undefined,
    conflicting_drug: typeof conflicting_drug === "string" ? conflicting_drug.trim() : undefined,
    spoken_warning_en: typeof spoken_warning_en === "string" ? spoken_warning_en.trim() : undefined,
    spoken_warning_hi: typeof spoken_warning_hi === "string" ? spoken_warning_hi.trim() : undefined,
    source_citations: Array.isArray(source_citations) ? (source_citations as ClinicalCitation[]) : [],
    metadata: metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : undefined,
  };
}

export function parseSpatialMemoryObjectInput(body: Record<string, unknown>): {
  patient_id: string;
  object_label: string;
  location_description?: string;
  room_zone?: string;
  coordinates?: { x?: number; y?: number; z?: number; [key: string]: unknown };
  confidence?: number;
} {
  const { patient_id, object_label, location_description, room_zone, coordinates, confidence } = body;

  if (!patient_id || typeof patient_id !== "string") {
    throw new Error("patient_id (string) is required");
  }
  if (!object_label || typeof object_label !== "string" || !object_label.trim()) {
    throw new Error("object_label (string) is required");
  }

  return {
    patient_id: patient_id.trim(),
    object_label: object_label.trim(),
    location_description: typeof location_description === "string" ? location_description.trim() : undefined,
    room_zone: typeof room_zone === "string" ? room_zone.trim() : undefined,
    coordinates: coordinates && typeof coordinates === "object" ? (coordinates as any) : undefined,
    confidence: typeof confidence === "number" ? confidence : undefined,
  };
}

export function parseBottleVerificationRequestInput(body: Record<string, unknown>): BottleVerificationRequest {
  const { patient_id, detected_drug_name, detected_strength, source, confidence_score, image_base64 } = body;

  if (!patient_id || typeof patient_id !== "string" || !patient_id.trim()) {
    throw new Error("patient_id (string) is required");
  }

  const effectiveDrugName =
    typeof detected_drug_name === "string" && detected_drug_name.trim()
      ? detected_drug_name.trim()
      : typeof image_base64 === "string" && image_base64.trim()
        ? "PENDING_OCR"
        : "";

  if (!effectiveDrugName) {
    throw new Error("detected_drug_name (string) is required");
  }
  if (!source || typeof source !== "string" || !verificationSourceSet.has(source)) {
    throw new Error(`source must be one of: ${VERIFICATION_SOURCES.join(", ")}`);
  }

  return {
    patient_id: patient_id.trim(),
    detected_drug_name: effectiveDrugName,
    detected_strength: typeof detected_strength === "string" ? detected_strength.trim() : undefined,
    source: source as VerificationSource,
    confidence_score: typeof confidence_score === "number" ? confidence_score : undefined,
    image_base64: typeof image_base64 === "string" ? image_base64 : undefined,
  };
}
