import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseMedicationInput } from "@/lib/contracts";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const activeOnly = searchParams.get("active_only") !== "false";

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
      .from("medications")
      .select("*")
      .eq("patient_id", patientId)
      .order("drug_name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
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
    const validated = parseMedicationInput(body);

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Database configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("medications")
      .insert({
        patient_id: validated.patient_id,
        drug_name: validated.drug_name,
        generic_name: validated.generic_name ?? null,
        rxcui: validated.rxcui ?? null,
        strength: validated.strength,
        dosage_instructions: validated.dosage_instructions ?? null,
        min_interval_hours: validated.min_interval_hours,
        prescribed_times: validated.prescribed_times ?? [],
        is_active: validated.is_active ?? true,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Invalid medication input" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { ok: false, error: "id (medication UUID string) is required for updates" },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Database configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const allowedFields = [
      "drug_name",
      "generic_name",
      "rxcui",
      "strength",
      "dosage_instructions",
      "min_interval_hours",
      "prescribed_times",
      "is_active",
    ];

    const patchPayload: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        patchPayload[field] = updates[field];
      }
    }

    if (updates.min_interval_hours !== undefined) {
      const hours = Number(updates.min_interval_hours);
      if (isNaN(hours) || hours < 0) {
        return NextResponse.json(
          { ok: false, error: "min_interval_hours must be a non-negative number" },
          { status: 400 }
        );
      }
      patchPayload.min_interval_hours = hours;
    }

    if (updates.drug_name !== undefined) {
      if (typeof updates.drug_name !== "string" || !updates.drug_name.trim()) {
        return NextResponse.json(
          { ok: false, error: "drug_name cannot be empty" },
          { status: 400 }
        );
      }
      patchPayload.drug_name = updates.drug_name.trim();
    }

    if (updates.strength !== undefined) {
      if (typeof updates.strength !== "string" || !updates.strength.trim()) {
        return NextResponse.json(
          { ok: false, error: "strength cannot be empty" },
          { status: 400 }
        );
      }
      patchPayload.strength = updates.strength.trim();
    }

    if (updates.is_active !== undefined) {
      patchPayload.is_active = Boolean(updates.is_active);
    }

    if (Object.keys(patchPayload).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    patchPayload.updated_at = new Date().toISOString();

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("medications")
      .update(patchPayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
