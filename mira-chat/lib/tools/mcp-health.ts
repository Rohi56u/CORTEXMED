// CortexMed - MCP-Style Clinical Health Tool Layer
// 100% Real Supabase Server Queries, Strict Validation & Zero-Mock Execution

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { appendEvent } from "@/lib/event-spine";
import {
  McpToolDefinition,
  McpToolResult,
  ClinicalVerdict,
  ClinicalAlertType,
  DosageLogStatus,
  VerificationSource,
  ClinicalCitation,
  Medication,
  DosageLog,
  VitalsTelemetry,
  ClinicalSafetyAlert,
  SpatialMemoryObject,
  DOSAGE_LOG_STATUSES,
  VERIFICATION_SOURCES,
  CLINICAL_VERDICTS,
  CLINICAL_ALERT_TYPES,
} from "@/lib/contracts";

export const CORTEXMED_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "get_active_medications",
    description:
      "Fetches all currently active prescribed medications for a patient, including RxNorm identifiers, strength, and minimum interval hours.",
    parameters: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "UUID of the patient whose active medications are being retrieved.",
        },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "check_last_dose",
    description:
      "Queries dosage logs for the most recent taken dose of a medication (by medication_id or drug_name), evaluating temporal cooldown against minimum interval hours to guard against double dosing.",
    parameters: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "UUID of the patient.",
        },
        medication_id: {
          type: "string",
          description: "Optional UUID of the specific prescribed medication.",
        },
        drug_name: {
          type: "string",
          description: "Optional name of the drug to match case-insensitively.",
        },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "log_medication_event",
    description:
      "Inserts a real medication administration event into dosage_logs with verification source, confidence score, and status (TAKEN, BLOCKED_DOUBLE_DOSE, etc.).",
    parameters: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "UUID of the patient.",
        },
        medication_id: {
          type: "string",
          description: "Optional UUID of the matched medication record.",
        },
        detected_drug_name: {
          type: "string",
          description: "Drug name identified by OCR, speech, or caregiver.",
        },
        status: {
          type: "string",
          enum: DOSAGE_LOG_STATUSES,
          description: "Ingestion status: TAKEN, BLOCKED_DOUBLE_DOSE, BLOCKED_INTERACTION, or SKIPPED.",
        },
        verification_source: {
          type: "string",
          enum: VERIFICATION_SOURCES,
          description: "Verification method: BOTTLE_OCR, VOICE_LOG, or CAREGIVER_MANUAL.",
        },
        confidence_score: {
          type: "number",
          description: "Optional confidence score between 0.0 and 1.0.",
        },
        notes: {
          type: "string",
          description: "Clinical notes or context regarding this dose.",
        },
        taken_at: {
          type: "string",
          description: "ISO 8601 timestamp when dose was taken (defaults to now).",
        },
      },
      required: ["patient_id", "status", "verification_source"],
    },
  },
  {
    name: "get_latest_vitals",
    description:
      "Fetches real vitals telemetry records for a patient and computes rolling statistics (average HR, min/max HR, agitation event counts).",
    parameters: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "UUID of the patient.",
        },
        limit: {
          type: "number",
          description: "Maximum number of recent telemetry entries to retrieve (default: 10).",
        },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "query_spatial_object",
    description:
      "Queries spatial memory objects to find the last known room zone, coordinates, and timestamp for an item (e.g. 'glasses', 'pill bottle').",
    parameters: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "UUID of the patient.",
        },
        object_label: {
          type: "string",
          description: "Object label to search for (e.g. 'Donepezil bottle', 'reading glasses').",
        },
      },
      required: ["patient_id", "object_label"],
    },
  },
  {
    name: "create_clinical_alert",
    description:
      "Inserts an auditable safety alert into clinical_safety_alerts AND publishes a synchronized event to the event spine for real-time caregiver notification.",
    parameters: {
      type: "object",
      properties: {
        patient_id: {
          type: "string",
          description: "UUID of the patient.",
        },
        verdict: {
          type: "string",
          enum: CLINICAL_VERDICTS,
          description: "Clinical verdict: SAFE, CAUTION, or CRITICAL_BLOCK.",
        },
        alert_type: {
          type: "string",
          enum: CLINICAL_ALERT_TYPES,
          description: "Alert category: DOUBLE_DOSE, DRUG_INTERACTION, FDA_BOXED_WARNING, SUNDOWNING_AGITATION, or UNRECOGNIZED_MEDICATION.",
        },
        detected_drug: {
          type: "string",
          description: "Drug detected or being queried.",
        },
        conflicting_drug: {
          type: "string",
          description: "Conflicting drug or prescription in patient's profile.",
        },
        spoken_warning_en: {
          type: "string",
          description: "Spoken warning text in English for the resident.",
        },
        spoken_warning_hi: {
          type: "string",
          description: "Spoken warning text in Hindi for multi-lingual residents.",
        },
        source_citations: {
          type: "array",
          description: "Clinical source citations (FDA, DailyMed, RxNorm, PubMed).",
        },
        metadata: {
          type: "object",
          description: "Additional structured metadata.",
        },
      },
      required: ["patient_id", "verdict", "alert_type"],
    },
  },
];

const VALID_STATUSES = new Set<string>(DOSAGE_LOG_STATUSES);
const VALID_SOURCES = new Set<string>(VERIFICATION_SOURCES);
const VALID_VERDICTS = new Set<string>(CLINICAL_VERDICTS);
const VALID_ALERT_TYPES = new Set<string>(CLINICAL_ALERT_TYPES);

function checkSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function dbUnconfiguredResult<T>(): McpToolResult<T> {
  return {
    ok: false,
    error: "Database configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    code: "DATABASE_UNCONFIGURED",
    timestamp: new Date().toISOString(),
  };
}

export async function executeMcpTool<T = unknown>(
  name: string,
  args: Record<string, unknown>
): Promise<McpToolResult<T>> {
  const now = new Date().toISOString();

  try {
    switch (name) {
      case "get_active_medications": {
        const patientId = args.patient_id;
        if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
          return {
            ok: false,
            error: "Missing or invalid 'patient_id' parameter",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }

        if (!checkSupabaseConfig()) return dbUnconfiguredResult<T>();

        const supabase = getSupabaseServerClient();
        const { data, error } = await supabase
          .from("medications")
          .select("*")
          .eq("patient_id", patientId.trim())
          .eq("is_active", true)
          .order("drug_name", { ascending: true });

        if (error) {
          return {
            ok: false,
            error: error.message,
            code: "SUPABASE_QUERY_ERROR",
            timestamp: now,
          };
        }

        return {
          ok: true,
          data: (data ?? []) as unknown as T,
          timestamp: now,
        };
      }

      case "check_last_dose": {
        const patientId = args.patient_id;
        const medicationId = typeof args.medication_id === "string" ? args.medication_id.trim() : undefined;
        const drugName = typeof args.drug_name === "string" ? args.drug_name.trim() : undefined;

        if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
          return {
            ok: false,
            error: "Missing or invalid 'patient_id' parameter",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }

        if (!medicationId && !drugName) {
          return {
            ok: false,
            error: "Must supply either 'medication_id' or 'drug_name'",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }

        if (!checkSupabaseConfig()) return dbUnconfiguredResult<T>();

        const supabase = getSupabaseServerClient();

        // 1. Locate matched medication record if possible
        let matchedMed: Medication | null = null;
        if (medicationId) {
          const { data } = await supabase
            .from("medications")
            .select("*")
            .eq("id", medicationId)
            .maybeSingle();
          matchedMed = data;
        } else if (drugName) {
          const { data } = await supabase
            .from("medications")
            .select("*")
            .eq("patient_id", patientId.trim())
            .ilike("drug_name", `%${drugName}%`)
            .limit(1)
            .maybeSingle();
          matchedMed = data;
        }

        // Clean drug name for search (e.g. "Donepezil 10mg" -> "Donepezil")
        const searchDrug = drugName
          ? drugName.replace(/\s+\d+(\.\d+)?\s*(mg|mcg|g|ml)\b/i, "").trim()
          : matchedMed?.drug_name
            ? matchedMed.drug_name.replace(/\s+\d+(\.\d+)?\s*(mg|mcg|g|ml)\b/i, "").trim()
            : undefined;

        // 2. Query most recent TAKEN dosage log
        let query = supabase
          .from("dosage_logs")
          .select("*")
          .eq("patient_id", patientId.trim())
          .eq("status", "TAKEN")
          .order("taken_at", { ascending: false })
          .limit(1);

        if (matchedMed?.id && searchDrug) {
          query = query.or(`medication_id.eq.${matchedMed.id},detected_drug_name.ilike.%${searchDrug}%`);
        } else if (matchedMed?.id) {
          query = query.eq("medication_id", matchedMed.id);
        } else if (searchDrug) {
          query = query.ilike("detected_drug_name", `%${searchDrug}%`);
        }

        const { data: logRow, error: logErr } = await query.maybeSingle();
        if (logErr) {
          return {
            ok: false,
            error: logErr.message,
            code: "SUPABASE_QUERY_ERROR",
            timestamp: now,
          };
        }

        const minIntervalHours = typeof args.min_interval_hours === "number" && args.min_interval_hours > 0
          ? args.min_interval_hours
          : (matchedMed?.min_interval_hours ?? 24);
        let hoursSinceLastDose: number | null = null;
        let withinCooldownWindow = false;

        if (logRow && logRow.taken_at) {
          const takenTime = new Date(logRow.taken_at).getTime();
          const elapsedMs = Math.max(0, Date.now() - takenTime);
          hoursSinceLastDose = parseFloat((elapsedMs / (1000 * 60 * 60)).toFixed(2));
          withinCooldownWindow = hoursSinceLastDose < minIntervalHours;
        }

        const resultData = {
          medication: matchedMed,
          last_dose: (logRow as DosageLog) ?? null,
          hours_since_last_dose: hoursSinceLastDose,
          min_interval_hours: minIntervalHours,
          within_cooldown_window: withinCooldownWindow,
          cooldown_remaining_hours:
            withinCooldownWindow && hoursSinceLastDose !== null
              ? parseFloat((minIntervalHours - hoursSinceLastDose).toFixed(2))
              : 0,
        };

        return {
          ok: true,
          data: resultData as unknown as T,
          timestamp: now,
        };
      }

      case "log_medication_event": {
        const patientId = args.patient_id;
        const status = args.status;
        const verificationSource = args.verification_source;

        if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
          return {
            ok: false,
            error: "Missing or invalid 'patient_id' parameter",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }
        if (!status || typeof status !== "string" || !VALID_STATUSES.has(status)) {
          return {
            ok: false,
            error: `status must be one of: ${DOSAGE_LOG_STATUSES.join(", ")}`,
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }
        if (
          !verificationSource ||
          typeof verificationSource !== "string" ||
          !VALID_SOURCES.has(verificationSource)
        ) {
          return {
            ok: false,
            error: `verification_source must be one of: ${VERIFICATION_SOURCES.join(", ")}`,
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }

        if (!checkSupabaseConfig()) return dbUnconfiguredResult<T>();

        const supabase = getSupabaseServerClient();
        const insertPayload = {
          patient_id: patientId.trim(),
          medication_id: typeof args.medication_id === "string" ? args.medication_id.trim() : null,
          detected_drug_name:
            typeof args.detected_drug_name === "string" ? args.detected_drug_name.trim() : null,
          status: status as DosageLogStatus,
          verification_source: verificationSource as VerificationSource,
          confidence_score: typeof args.confidence_score === "number" ? args.confidence_score : null,
          notes: typeof args.notes === "string" ? args.notes.trim() : null,
          taken_at: typeof args.taken_at === "string" ? args.taken_at : new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("dosage_logs")
          .insert(insertPayload)
          .select("*")
          .single();

        if (error) {
          return {
            ok: false,
            error: error.message,
            code: "SUPABASE_INSERT_ERROR",
            timestamp: now,
          };
        }

        // Synchronize with Event Spine for Caregiver Dashboard Realtime feeds
        try {
          const severityByStatus: Record<DosageLogStatus, "GREEN" | "YELLOW" | "RED"> = {
            TAKEN: "GREEN",
            SKIPPED: "YELLOW",
            BLOCKED_DOUBLE_DOSE: "RED",
            BLOCKED_INTERACTION: "RED",
          };

          await appendEvent({
            patient_id: patientId.trim(),
            type: "MEDICATION_LOGGED",
            severity: severityByStatus[status as DosageLogStatus] || "GREEN",
            receipt_text: `Medication Dose [${status}]: ${insertPayload.detected_drug_name || "Prescription"} via ${verificationSource}`,
            payload: {
              dosage_log_id: data.id,
              medication_id: insertPayload.medication_id,
              detected_drug_name: insertPayload.detected_drug_name,
              status,
              verification_source: verificationSource,
              confidence_score: insertPayload.confidence_score,
              taken_at: insertPayload.taken_at,
            },
            source: verificationSource === "CAREGIVER_MANUAL" ? "dashboard" : "device",
          });
        } catch (eventErr) {
          console.warn("[MCP log_medication_event] Event spine sync warning:", eventErr);
        }

        return {
          ok: true,
          data: data as unknown as T,
          timestamp: now,
        };
      }

      case "get_latest_vitals": {
        const patientId = args.patient_id;
        if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
          return {
            ok: false,
            error: "Missing or invalid 'patient_id' parameter",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }

        const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 100) : 10;

        if (!checkSupabaseConfig()) return dbUnconfiguredResult<T>();

        const supabase = getSupabaseServerClient();
        const { data, error } = await supabase
          .from("vitals_telemetry")
          .select("*")
          .eq("patient_id", patientId.trim())
          .order("recorded_at", { ascending: false })
          .limit(limit);

        if (error) {
          return {
            ok: false,
            error: error.message,
            code: "SUPABASE_QUERY_ERROR",
            timestamp: now,
          };
        }

        const rows: VitalsTelemetry[] = data ?? [];

        let rollingStats = null;
        if (rows.length > 0) {
          const hrValues = rows.map((r) => Number(r.heart_rate_bpm)).filter((v) => !isNaN(v));
          const avgHr = hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : 0;
          const minHr = hrValues.length > 0 ? Math.min(...hrValues) : 0;
          const maxHr = hrValues.length > 0 ? Math.max(...hrValues) : 0;
          const agitationCount = rows.filter((r) => r.agitation_detected).length;

          const hrvValues = rows.map((r) => Number(r.hrv_rmssd_ms)).filter((v) => !isNaN(v) && v > 0);
          const avgHrv = hrvValues.length > 0 ? parseFloat((hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length).toFixed(1)) : null;

          const sqiValues = rows.map((r) => Number(r.signal_quality_index)).filter((v) => !isNaN(v) && v >= 0);
          const avgSqi = sqiValues.length > 0 ? parseFloat((sqiValues.reduce((a, b) => a + b, 0) / sqiValues.length).toFixed(2)) : null;

          rollingStats = {
            count: rows.length,
            average_hr: parseFloat(avgHr.toFixed(1)),
            min_hr: minHr,
            max_hr: maxHr,
            average_hrv: avgHrv,
            average_sqi: avgSqi,
            agitation_events_count: agitationCount,
            latest: rows[0],
          };
        }

        return {
          ok: true,
          data: {
            telemetry: rows,
            stats: rollingStats,
          } as unknown as T,
          timestamp: now,
        };
      }

      case "query_spatial_object": {
        const patientId = args.patient_id;
        const objectLabel = args.object_label;

        if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
          return {
            ok: false,
            error: "Missing or invalid 'patient_id' parameter",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }
        if (!objectLabel || typeof objectLabel !== "string" || !objectLabel.trim()) {
          return {
            ok: false,
            error: "Missing or invalid 'object_label' parameter",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }

        if (!checkSupabaseConfig()) return dbUnconfiguredResult<T>();

        const supabase = getSupabaseServerClient();
        const { data, error } = await supabase
          .from("spatial_memory_objects")
          .select("*")
          .eq("patient_id", patientId.trim())
          .ilike("object_label", `%${objectLabel.trim()}%`)
          .order("last_seen_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          return {
            ok: false,
            error: error.message,
            code: "SUPABASE_QUERY_ERROR",
            timestamp: now,
          };
        }

        return {
          ok: true,
          data: ((data as SpatialMemoryObject) ?? null) as unknown as T,
          timestamp: now,
        };
      }

      case "create_clinical_alert": {
        const patientId = args.patient_id;
        const verdict = args.verdict;
        const alertType = args.alert_type;

        if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
          return {
            ok: false,
            error: "Missing or invalid 'patient_id' parameter",
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }
        if (!verdict || typeof verdict !== "string" || !VALID_VERDICTS.has(verdict)) {
          return {
            ok: false,
            error: `verdict must be one of: ${CLINICAL_VERDICTS.join(", ")}`,
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }
        if (!alertType || typeof alertType !== "string" || !VALID_ALERT_TYPES.has(alertType)) {
          return {
            ok: false,
            error: `alert_type must be one of: ${CLINICAL_ALERT_TYPES.join(", ")}`,
            code: "VALIDATION_ERROR",
            timestamp: now,
          };
        }

        if (!checkSupabaseConfig()) return dbUnconfiguredResult<T>();

        const supabase = getSupabaseServerClient();
        const alertPayload = {
          patient_id: patientId.trim(),
          verdict: verdict as ClinicalVerdict,
          alert_type: alertType as ClinicalAlertType,
          detected_drug: typeof args.detected_drug === "string" ? args.detected_drug.trim() : null,
          conflicting_drug: typeof args.conflicting_drug === "string" ? args.conflicting_drug.trim() : null,
          spoken_warning_en: typeof args.spoken_warning_en === "string" ? args.spoken_warning_en.trim() : null,
          spoken_warning_hi: typeof args.spoken_warning_hi === "string" ? args.spoken_warning_hi.trim() : null,
          source_citations: Array.isArray(args.source_citations) ? args.source_citations : [],
          acknowledged: false,
          metadata: args.metadata && typeof args.metadata === "object" ? args.metadata : {},
        };

        const { data: alertData, error: alertError } = await supabase
          .from("clinical_safety_alerts")
          .insert(alertPayload)
          .select("*")
          .single();

        if (alertError) {
          return {
            ok: false,
            error: alertError.message,
            code: "SUPABASE_INSERT_ERROR",
            timestamp: now,
          };
        }

        // Synchronize with Event Spine for Realtime Caregiver Dashboard feeds
        try {
          const severityMap: Record<ClinicalVerdict, "GREEN" | "YELLOW" | "RED"> = {
            SAFE: "GREEN",
            CAUTION: "YELLOW",
            CRITICAL_BLOCK: "RED",
          };

          await appendEvent({
            patient_id: patientId.trim(),
            type: "CLINICAL_ALERT_TRIGGERED",
            severity: severityMap[verdict as ClinicalVerdict],
            receipt_text:
              alertPayload.spoken_warning_en ||
              `Clinical Safety Alert: ${alertType} [${verdict}] - ${alertPayload.detected_drug || "Medication"}`,
            payload: {
              alert_id: alertData.id,
              verdict,
              alert_type: alertType,
              detected_drug: alertPayload.detected_drug,
              conflicting_drug: alertPayload.conflicting_drug,
              source_citations: alertPayload.source_citations,
            },
            source: "clinical_guard",
          });
        } catch (eventErr) {
          console.warn("[MCP create_clinical_alert] Event spine sync warning:", eventErr);
        }

        return {
          ok: true,
          data: alertData as unknown as T,
          timestamp: now,
        };
      }

      default:
        return {
          ok: false,
          error: `Unrecognized MCP tool: '${name}'`,
          code: "UNKNOWN_TOOL",
          timestamp: now,
        };
    }
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Internal MCP tool execution failure",
      code: "TOOL_EXECUTION_ERROR",
      timestamp: now,
    };
  }
}
