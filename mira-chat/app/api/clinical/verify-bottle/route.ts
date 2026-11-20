import { NextRequest, NextResponse } from "next/server";
import { parseBottleVerificationRequestInput, BottleVerificationResponse } from "@/lib/contracts";
import { sendSms } from "@/lib/twilio";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validatedRequest = parseBottleVerificationRequestInput(rawBody);

    const backendUrl = process.env.NEXT_PUBLIC_VIC_BACKEND_URL || "http://localhost:8000";
    const endpoint = `${backendUrl.replace(/\/+$/, "")}/api/clinical/verify-bottle`;

    // Enforce 30-second AbortController timeout discipline
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let backendResponse: Response;
    try {
      backendResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(validatedRequest),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === "AbortError";
      const errorMsg = isTimeout
        ? "CortexMed Clinical Backend timed out after 30 seconds"
        : `Cannot connect to CortexMed Clinical Backend at ${backendUrl}: ${fetchErr.message}`;

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
          error: `CortexMed Clinical Backend returned HTTP ${backendResponse.status}: ${errText}`,
          code: "BACKEND_ERROR",
        },
        { status: backendResponse.status }
      );
    }

    const verificationResult: BottleVerificationResponse = await backendResponse.json();

    // If verdict is CRITICAL_BLOCK, trigger caregiver SMS escalation if Twilio is configured
    if (verificationResult.verdict === "CRITICAL_BLOCK") {
      const detected =
        verificationResult.alert?.detected_drug ||
        verificationResult.matched_medication?.drug_name ||
        (validatedRequest.detected_drug_name && validatedRequest.detected_drug_name !== "PENDING_OCR"
          ? validatedRequest.detected_drug_name
          : undefined) ||
        "Medication";
      const warning = verificationResult.spoken_warning_en || "Critical medication safety block triggered.";
      const smsBody = `CORTEXMED CLINICAL ALERT: Patient ${validatedRequest.patient_id.slice(0, 8)} medication blocked. Detected: ${detected}. Reason: ${warning}`;

      // Graceful fire-and-forget; never crashes the HTTP response if Twilio credentials are missing
      sendSms(smsBody).catch((smsErr) => {
        console.warn("[verify-bottle] Caregiver SMS alert dispatch skipped or failed:", smsErr);
      });
    }

    return NextResponse.json({
      ok: true,
      data: verificationResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Invalid bottle verification request payload",
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }
}
