"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface HealthData {
  ok: boolean;
  brand: string;
  version: string;
  total_check_latency_ms: number;
  timestamp: string;
  services: {
    frontend: { ok: boolean; brand: string; version: string };
    yolo_model: {
      present: boolean;
      file_size_bytes: number;
      valid_size: boolean;
      path: string;
      error?: string;
    };
    supabase: {
      configured: boolean;
      reachable: boolean;
      latency_ms: number;
      error?: string;
    };
    vic_backend: {
      configured: boolean;
      reachable: boolean;
      latency_ms: number;
      langgraph_ready: boolean;
      rppg_ready: boolean;
      gemini_configured: boolean;
      error?: string;
    };
    voice_tts: {
      server_tts_configured: boolean;
      browser_speech_fallback: boolean;
    };
  };
}

export default function SystemHealthBar() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/system/health", { cache: "no-store" });
      const data = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch (e) {
      console.warn("[SystemHealthBar] Health fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const yoloMb = health?.services?.yolo_model?.file_size_bytes
    ? (health.services.yolo_model.file_size_bytes / (1024 * 1024)).toFixed(1)
    : null;

  return (
    <div className="w-full max-w-4xl bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200/60 flex items-center justify-center">
            <svg className="w-4 h-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground">
                CortexMed End-to-End System Readiness
              </h3>
              {loading && !health ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ) : health?.ok ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  All Services Operational
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Partial Readiness
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              Live zero-mock health check polled every 10s · {lastChecked ? `Updated ${lastChecked.toLocaleTimeString()}` : "Checking..."}
            </p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100/70 px-3 py-1.5 rounded-lg border border-teal-200/60 transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Re-Check
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* YOLO ONNX */}
        <div className="p-3 rounded-xl border border-slate-200/60 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">YOLOv8n ONNX</span>
            {health?.services?.yolo_model?.valid_size ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </div>
          <div className="text-sm font-bold text-foreground mt-1">
            {health?.services?.yolo_model?.valid_size ? `${yoloMb} MB Model` : "Missing"}
          </div>
          <div className="text-[10px] text-muted truncate mt-0.5">
            {health?.services?.yolo_model?.valid_size ? "Authentic ONNX Ready" : "Run export_yolo"}
          </div>
        </div>

        {/* Supabase DB */}
        <div className="p-3 rounded-xl border border-slate-200/60 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Supabase DB</span>
            {health?.services?.supabase?.reachable ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </div>
          <div className="text-sm font-bold text-foreground mt-1">
            {health?.services?.supabase?.reachable
              ? `${health.services.supabase.latency_ms}ms Ping`
              : health?.services?.supabase?.configured
              ? "Connecting..."
              : "Unconfigured"}
          </div>
          <div className="text-[10px] text-muted truncate mt-0.5">
            {health?.services?.supabase?.reachable ? "Live Patients & Meds" : health?.services?.supabase?.error || "Offline"}
          </div>
        </div>

        {/* CDSS Safety Guardrails */}
        <Link
          href="/cdss"
          className="p-3 rounded-xl border border-slate-200/60 bg-slate-50/50 hover:border-teal-300 hover:bg-teal-50/40 transition-all cursor-pointer block group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted group-hover:text-teal-700 transition-colors">
              Clinical CDSS
            </span>
            {health?.services?.vic_backend?.reachable ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </div>
          <div className="text-sm font-bold text-foreground mt-1 flex items-center justify-between">
            <span>{health?.services?.vic_backend?.reachable ? "LangGraph Live" : "Port 8000"}</span>
            <span className="text-xs text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
          </div>
          <div className="text-[10px] text-muted truncate mt-0.5">
            {health?.services?.vic_backend?.reachable ? "NIH RxNorm & OpenFDA" : "Start vic-backend"}
          </div>
        </Link>

        {/* Contactless rPPG */}
        <div className="p-3 rounded-xl border border-slate-200/60 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">rPPG DSP Engine</span>
            {health?.services?.vic_backend?.rppg_ready ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-400" />
            )}
          </div>
          <div className="text-sm font-bold text-foreground mt-1">
            {health?.services?.vic_backend?.rppg_ready ? "OpenCV + POS" : "Standby"}
          </div>
          <div className="text-[10px] text-muted truncate mt-0.5">
            {health?.services?.voice_tts?.server_tts_configured ? "TTS + Web Speech" : "Web Speech API"}
          </div>
        </div>
      </div>
    </div>
  );
}
