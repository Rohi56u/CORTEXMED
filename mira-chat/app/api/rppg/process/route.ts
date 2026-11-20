import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    if (!rawBody || !Array.isArray(rawBody.samples)) {
      return NextResponse.json(
        { ok: false, error: "samples (array of { t_ms, r, g, b }) is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const backendUrl = process.env.NEXT_PUBLIC_VIC_BACKEND_URL || "http://localhost:8000";
    const endpoint = `${backendUrl.replace(/\/+$/, "")}/api/rppg/process`;

    // Enforce 15-second AbortController timeout discipline
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let backendResponse: Response;
    try {
      backendResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          patient_id: rawBody.patient_id || undefined,
          samples: rawBody.samples,
          persist: Boolean(rawBody.persist),
        }),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === "AbortError";
      const errorMsg = isTimeout
        ? "CortexMed rPPG Backend timed out after 15 seconds"
        : `Cannot connect to CortexMed Backend at ${backendUrl}: ${fetchErr.message}`;

      return NextResponse.json(
        {
          ok: false,
          error: errorMsg,
          code: isTimeout ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE",
        },
        { status: 503 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!backendResponse.ok) {
      const errText = await backendResponse.text();
      return NextResponse.json(
        {
          ok: false,
          error: `CortexMed Backend returned HTTP ${backendResponse.status}: ${errText}`,
          code: "BACKEND_ERROR",
        },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Invalid rPPG process request",
        code: "INTERNAL_ERROR",
      },
      { status: 400 }
    );
  }
}
