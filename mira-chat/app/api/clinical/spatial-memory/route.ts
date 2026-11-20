import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { parseSpatialMemoryObjectInput } from "@/lib/contracts";
import { appendEvent } from "@/lib/event-spine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patient_id = searchParams.get("patient_id");
    const label = searchParams.get("label");

    if (!patient_id || !patient_id.trim()) {
      return NextResponse.json(
        { ok: false, error: "patient_id query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("spatial_memory_objects")
      .select("*")
      .eq("patient_id", patient_id.trim())
      .order("last_seen_at", { ascending: false });

    if (label && label.trim()) {
      query = query.ilike("object_label", `%${label.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[SpatialMemory GET] Supabase query error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to query spatial memory objects" },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (err: any) {
    console.error("[SpatialMemory GET] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let validatedInput;

    try {
      validatedInput = parseSpatialMemoryObjectInput(body);
    } catch (parseErr: any) {
      return NextResponse.json(
        { ok: false, error: parseErr?.message || "Invalid spatial memory object input" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const rowToInsert = {
      patient_id: validatedInput.patient_id,
      object_label: validatedInput.object_label,
      location_description: validatedInput.location_description || null,
      room_zone: validatedInput.room_zone || "Living Room",
      coordinates: validatedInput.coordinates || null,
      confidence: validatedInput.confidence ?? null,
      last_seen_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("spatial_memory_objects")
      .insert(rowToInsert)
      .select("*")
      .single();

    if (error) {
      console.error("[SpatialMemory POST] Supabase insert error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to persist spatial memory object" },
        { status: 503 }
      );
    }

    // Publish SPATIAL_OBJECT_UPDATED event to Event Spine
    try {
      await appendEvent({
        patient_id: validatedInput.patient_id,
        type: "SPATIAL_OBJECT_UPDATED",
        severity: "GREEN",
        receipt_text: `Spatial item '${validatedInput.object_label}' indexed in ${validatedInput.room_zone || "Living Room"}.`,
        payload: {
          object_id: data.id,
          object_label: validatedInput.object_label,
          room_zone: validatedInput.room_zone || "Living Room",
          location_description: validatedInput.location_description,
          confidence: validatedInput.confidence,
          coordinates: validatedInput.coordinates,
        },
        source: "cv_team",
      });
    } catch (eventErr) {
      console.warn("[SpatialMemory POST] Non-fatal event spine logging error:", eventErr);
    }

    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (err: any) {
    console.error("[SpatialMemory POST] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
