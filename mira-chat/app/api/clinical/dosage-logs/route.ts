import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseDosageLogInput } from "@/lib/contracts";
import { appendEvent } from "@/lib/event-spine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const medicationId = searchParams.get("medication_id");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (!patientId) {
      return NextResponse.json(
        { ok: false, error: "patient_id query parameter is required" },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Database configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("dosage_logs")
      .select("*")
      .eq("patient_id", patientId)
      .order("taken_at", { ascending: false })
      .limit(Math.min(limit, 200));

    if (medicationId) {
      query = query.eq("medication_id", medicationId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
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
    const validated = parseDosageLogInput(body);

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Database configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("dosage_logs")
      .insert({
        patient_id: validated.patient_id,
        medication_id: validated.medication_id ?? null,
        detected_drug_name: validated.detected_drug_name ?? null,
        status: validated.status,
        verification_source: validated.verification_source,
        confidence_score: validated.confidence_score ?? null,
        notes: validated.notes ?? null,
        taken_at: validated.taken_at || new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Synchronize to Event Spine for Caregiver Dashboard Realtime updates
    try {
      await appendEvent({
        patient_id: validated.patient_id,
        type: "MEDICATION_LOGGED",
        severity: validated.status === "TAKEN" ? "GREEN" : "RED",
        receipt_text: `Dose logged: ${validated.detected_drug_name || "Medication"} (${validated.status})`,
        source: "dashboard",
        payload: {
          dosage_log_id: data.id,
          medication_id: validated.medication_id,
          status: validated.status,
        },
      });
    } catch (eventErr) {
      console.warn("[dosage-logs] Event spine append warning:", eventErr);
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Invalid dosage log input" },
      { status: 400 }
    );
  }
}
