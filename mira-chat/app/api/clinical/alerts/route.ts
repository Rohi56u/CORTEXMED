import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { executeMcpTool } from "@/lib/tools/mcp-health";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const unacknowledgedOnly = searchParams.get("unacknowledged_only") === "true";
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
      .from("clinical_safety_alerts")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));

    if (unacknowledgedOnly) {
      query = query.eq("acknowledged", false);
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, acknowledged } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { ok: false, error: "id (alert UUID string) is required" },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Database configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const isAck = typeof acknowledged === "boolean" ? acknowledged : true;
    const updatePayload = {
      acknowledged: isAck,
      acknowledged_at: isAck ? new Date().toISOString() : null,
    };

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("clinical_safety_alerts")
      .update(updatePayload)
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await executeMcpTool("create_clinical_alert", body);
    if (!result.ok) {
      const statusCode = result.code === "VALIDATION_ERROR" ? 400 : result.code === "DATABASE_UNCONFIGURED" ? 503 : 500;
      return NextResponse.json(result, { status: statusCode });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
