import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseVitalsTelemetryInput } from "@/lib/contracts";
import { executeMcpTool } from "@/lib/tools/mcp-health";
import { appendEvent } from "@/lib/event-spine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!patientId) {
      return NextResponse.json(
        { ok: false, error: "patient_id query parameter is required" },
        { status: 400 }
      );
    }

    const result = await executeMcpTool("get_latest_vitals", {
      patient_id: patientId,
      limit,
    });

    if (!result.ok) {
      const statusCode = result.code === "DATABASE_UNCONFIGURED" ? 503 : 500;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = parseVitalsTelemetryInput(body);

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Database configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("vitals_telemetry")
      .insert({
        patient_id: validated.patient_id,
        heart_rate_bpm: validated.heart_rate_bpm,
        hrv_rmssd_ms: validated.hrv_rmssd_ms ?? null,
        signal_quality_index: validated.signal_quality_index ?? null,
        agitation_detected: validated.agitation_detected ?? false,
        agitation_reason: validated.agitation_reason ?? null,
        window_seconds: validated.window_seconds ?? null,
        recorded_at: validated.recorded_at || new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Synchronize to Event Spine for Caregiver Dashboard Realtime updates
    try {
      const isAgitated = validated.agitation_detected ?? false;
      const hr = validated.heart_rate_bpm;
      const hrv = validated.hrv_rmssd_ms;
      const hrvStr = hrv !== null && hrv !== undefined ? `, HRV ${hrv.toFixed(1)}ms` : "";
      const receipt = `Contactless Vitals: ${hr.toFixed(1)} BPM${hrvStr}${isAgitated ? " [AGITATION FLAGGED]" : ""}`;

      await appendEvent({
        patient_id: validated.patient_id,
        type: "VITALS_RECORDED",
        severity: isAgitated ? "YELLOW" : "GREEN",
        receipt_text: receipt,
        source: "clinical_guard",
        payload: {
          vitals_id: data.id,
          heart_rate_bpm: hr,
          hrv_rmssd_ms: hrv,
          signal_quality_index: validated.signal_quality_index,
          agitation_detected: isAgitated,
          agitation_reason: validated.agitation_reason,
        },
      });
    } catch (eventErr) {
      console.warn("[vitals] Event spine append warning:", eventErr);
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Invalid vitals telemetry input" },
      { status: 400 }
    );
  }
}
