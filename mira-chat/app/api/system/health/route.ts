import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const tStart = Date.now();

  // 1. Frontend & Brand metadata
  const frontendInfo = {
    ok: true,
    brand: "CortexMed",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  };

  // 2. YOLO ONNX Model Disk Integrity Check
  let yoloStatus = {
    present: false,
    file_size_bytes: 0,
    valid_size: false,
    path: "public/models/yolov8n.onnx",
    error: undefined as string | undefined,
  };

  try {
    const modelPath = path.join(process.cwd(), "public", "models", "yolov8n.onnx");
    if (fs.existsSync(modelPath)) {
      const stats = fs.statSync(modelPath);
      yoloStatus = {
        present: true,
        file_size_bytes: stats.size,
        valid_size: stats.size > 10 * 1024 * 1024, // >10 MB authentic ONNX
        path: "public/models/yolov8n.onnx",
        error: undefined,
      };
    } else {
      yoloStatus.error = "yolov8n.onnx not found at public/models/yolov8n.onnx";
    }
  } catch (err: any) {
    yoloStatus.error = err?.message || "Failed to inspect ONNX model file";
  }

  // 3. Supabase Database Connectivity Check (with 4s timeout)
  let supabaseStatus = {
    configured: false,
    reachable: false,
    latency_ms: 0,
    error: undefined as string | undefined,
  };

  const hasSupabaseUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  );
  const hasSupabaseKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  supabaseStatus.configured = hasSupabaseUrl && hasSupabaseKey;

  if (supabaseStatus.configured) {
    const sbStart = Date.now();
    try {
      const supabase = getSupabaseServerClient();
      const sbPromise = supabase.from("patients").select("id").limit(1);
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: "Database check timed out (4s)" } }), 4000)
      );

      const result = await Promise.race([sbPromise, timeoutPromise]);
      supabaseStatus.latency_ms = Date.now() - sbStart;

      if (result.error) {
        supabaseStatus.error = result.error.message;
        supabaseStatus.reachable = false;
      } else {
        supabaseStatus.reachable = true;
      }
    } catch (err: any) {
      supabaseStatus.latency_ms = Date.now() - sbStart;
      supabaseStatus.error = err?.message || "Connection failed";
      supabaseStatus.reachable = false;
    }
  } else {
    supabaseStatus.error = "Supabase environment variables not configured";
  }

  // 4. FastAPI vic-backend Readiness Check (with 4s timeout)
  let vicBackendStatus = {
    configured: true,
    reachable: false,
    latency_ms: 0,
    url: process.env.NEXT_PUBLIC_VIC_BACKEND_URL || "http://127.0.0.1:8000",
    langgraph_ready: false,
    rppg_ready: false,
    gemini_configured: false,
    error: undefined as string | undefined,
  };

  const vicUrl = (process.env.NEXT_PUBLIC_VIC_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const vicStart = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${vicUrl}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeoutId);
    vicBackendStatus.latency_ms = Date.now() - vicStart;

    if (res.ok) {
      const data = await res.json();
      vicBackendStatus.reachable = true;
      vicBackendStatus.langgraph_ready = Boolean(data.graph_compiled);
      vicBackendStatus.rppg_ready = Boolean(data.rppg_ready);
      vicBackendStatus.gemini_configured = Boolean(data.providers?.gemini_vision_configured);
    } else {
      vicBackendStatus.error = `HTTP ${res.status} from backend`;
    }
  } catch (err: any) {
    vicBackendStatus.latency_ms = Date.now() - vicStart;
    vicBackendStatus.error = err?.name === "AbortError" ? "Backend health check timed out (4s)" : (err?.message || "Could not reach backend");
  }

  // 5. Voice TTS Engine Status
  const voiceTtsStatus = {
    server_tts_configured: Boolean(process.env.OPENAI_API_KEY),
    browser_speech_fallback: true,
  };

  // Overall system readiness verdict
  const overallHealthy =
    frontendInfo.ok &&
    yoloStatus.valid_size &&
    supabaseStatus.reachable &&
    vicBackendStatus.reachable;

  return NextResponse.json(
    {
      ok: overallHealthy,
      brand: "CortexMed",
      version: "1.0.0",
      total_check_latency_ms: Date.now() - tStart,
      timestamp: new Date().toISOString(),
      services: {
        frontend: frontendInfo,
        yolo_model: yoloStatus,
        supabase: supabaseStatus,
        vic_backend: vicBackendStatus,
        voice_tts: voiceTtsStatus,
      },
    },
    { status: overallHealthy ? 200 : 207 }
  );
}
