"use client";

import React, { useEffect, useRef } from "react";
import { UseRppgVitalsReturn } from "@/hooks/useRppgVitals";

interface RppgVitalsPanelProps {
  rppg: UseRppgVitalsReturn;
  patientName?: string;
  onSwitchCamera?: () => void;
  facingMode?: "user" | "environment";
}

export default function RppgVitalsPanel({
  rppg,
  patientName = "Selected Resident",
  onSwitchCamera,
  facingMode = "user",
}: RppgVitalsPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    faceDetected,
    faceRois,
    vitals,
    warmupProgress,
    isProcessing,
    autoPersist,
    setAutoPersist,
    saveReading,
    isSaving,
    lastSavedVitalId,
    error,
  } = rppg;

  // ─────────────────────────────────────────────────────────────
  // Authentic BVP Pulse Waveform Rendering (Zero Fake Sine Waves)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Subtle medical grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const waveform = vitals?.bvp_waveform || [];

    // Strictly Honest: If no real waveform exists, draw clean baseline center line
    if (waveform.length === 0 || !faceDetected) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.3)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
      ctx.font = "11px ui-monospace, SFMono-Regular, monospace";
      ctx.textAlign = "center";
      const statusMsg = !faceDetected
        ? "AWAITING FACE LOCK"
        : warmupProgress < 100
        ? `BUFFERING SIGNAL (${warmupProgress}%)`
        : "AWAITING REAL PULSE WAVEFORM...";
      ctx.fillText(statusMsg, width / 2, height / 2 - 8);
      return;
    }

    // Render authentic blood volume pulse curve
    ctx.beginPath();
    const step = width / (waveform.length - 1);

    for (let i = 0; i < waveform.length; i++) {
      const normVal = waveform[i]; // in [-1.0, 1.0]
      // Map [-1.0, 1.0] to [0.1 * h, 0.9 * h], inverted for canvas coords
      const y = height / 2 - normVal * (height * 0.38);
      const x = i * step;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    // Glow effect
    ctx.shadowColor = vitals?.agitation_detected ? "rgba(239, 68, 68, 0.8)" : "rgba(20, 184, 166, 0.8)";
    ctx.shadowBlur = 8;
    ctx.strokeStyle = vitals?.agitation_detected ? "#ef4444" : "#14b8a6";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill area under curve
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    if (vitals?.agitation_detected) {
      grad.addColorStop(0, "rgba(239, 68, 68, 0.25)");
      grad.addColorStop(1, "rgba(239, 68, 68, 0.0)");
    } else {
      grad.addColorStop(0, "rgba(20, 184, 166, 0.25)");
      grad.addColorStop(1, "rgba(20, 184, 166, 0.0)");
    }
    ctx.fillStyle = grad;
    ctx.fill();
  }, [vitals?.bvp_waveform, vitals?.agitation_detected, faceDetected, warmupProgress]);

  // Derived metrics
  const hr = vitals?.heart_rate_bpm;
  const hrv = vitals?.hrv_rmssd_ms;
  const sqi = vitals?.signal_quality_index;
  const agitation = vitals?.agitation_detected;

  const sqiBadge =
    sqi === null || sqi === undefined
      ? { text: "Calibrating", color: "bg-slate-800 text-slate-400 border-slate-700" }
      : sqi >= 0.60
      ? { text: `Good (${Math.round(sqi * 100)}%)`, color: "bg-emerald-950/80 text-emerald-400 border-emerald-800/60" }
      : sqi >= 0.30
      ? { text: `Fair (${Math.round(sqi * 100)}%)`, color: "bg-amber-950/80 text-amber-400 border-amber-800/60" }
      : { text: `Low Signal (${Math.round(sqi * 100)}%)`, color: "bg-rose-950/80 text-rose-400 border-rose-800/60" };

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl text-white space-y-4">
      {/* Header with Camera Switch & Mode */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
            <svg className="w-4 h-4 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Contactless rPPG Vitals
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-950 text-teal-400 border border-teal-800/50">
                POS / CHROM
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Patient: <span className="text-slate-200 font-medium">{patientName}</span>
            </p>
          </div>
        </div>

        {onSwitchCamera && (
          <button
            onClick={onSwitchCamera}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Switch between Object Scanner and Vitals front camera"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 3.314 2.015 6.16 4.882 7.37" />
              <path d="M4 14c0 4.418 3.582 8 8 8s8-3.582 8-8c0-3.314-2.015-6.16-4.882-7.37" />
              <polyline points="1 10 4 7 7 10" />
              <polyline points="23 14 20 17 17 14" />
            </svg>
            <span>{facingMode === "user" ? "Back Camera" : "Front Camera"}</span>
          </button>
        )}
      </div>

      {/* Face Tracking & Signal Status Banner */}
      <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              faceDetected ? "bg-emerald-400 animate-ping" : "bg-rose-500"
            }`}
          />
          <span className="font-mono text-slate-300">
            {faceDetected
              ? "Face locked \u00b7 Capillary ROIs active"
              : "No face detected — please face the camera in steady lighting"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && (
            <span className="text-[11px] text-teal-400 animate-pulse font-mono">
              Computing DSP...
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium ${sqiBadge.color}`}
          >
            SQI: {sqiBadge.text}
          </span>
        </div>
      </div>

      {/* Warmup Progress Bar during first 8.0s */}
      {faceDetected && warmupProgress < 100 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>Calibrating resting pulse window</span>
            <span>{warmupProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-300 rounded-full"
              style={{ width: `${warmupProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Dementia Sundowning / Agitation Alert Banner */}
      {agitation && (
        <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/60 text-rose-200 animate-pulse">
          <div className="flex items-start gap-2.5">
            <svg
              className="w-5 h-5 text-rose-400 shrink-0 mt-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <div className="text-xs font-bold text-rose-100 uppercase tracking-wider">
                Sundowning & Agitation Triggered
              </div>
              <p className="text-xs text-rose-200 mt-1 leading-relaxed">
                {vitals?.agitation_reason ||
                  "Sustained elevated pulse and autonomic withdrawal detected."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live BVP Waveform Canvas */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Real BVP Pulse Waveform</span>
          <span>Window: {vitals?.window_seconds ? `${vitals.window_seconds}s` : "0s"}</span>
        </div>
        <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
          <canvas
            ref={canvasRef}
            width={480}
            height={100}
            className="w-full h-24 block"
          />
        </div>
      </div>

      {/* Numeric Telemetry Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Heart Rate */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            Pulse (BPM)
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-teal-400">
            {hr !== null && hr !== undefined ? hr.toFixed(1) : "--"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            {vitals?.baseline_source === "patient_history" ? "vs Personal Baseline" : "vs Clinical Ref"}
          </div>
        </div>

        {/* HRV RMSSD */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            HRV (RMSSD)
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-cyan-400">
            {hrv !== null && hrv !== undefined ? `${hrv.toFixed(1)}ms` : "--"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Autonomic Tone
          </div>
        </div>

        {/* Signal Quality */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-center">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
            Quality (SQI)
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-indigo-400">
            {sqi !== null && sqi !== undefined ? `${Math.round(sqi * 100)}%` : "--"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Spectral SNR
          </div>
        </div>
      </div>

      {/* Action Controls: Auto-Persist & Save Reading */}
      <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
          <input
            type="checkbox"
            checked={autoPersist}
            onChange={(e) => setAutoPersist(e.target.checked)}
            className="w-4 h-4 rounded text-teal-500 bg-slate-800 border-slate-700 focus:ring-teal-500"
          />
          <span>Continuous Telemetry Sync</span>
        </label>

        <button
          onClick={saveReading}
          disabled={isSaving || hr === null || hr === undefined}
          className={`px-3 py-1.5 rounded-lg font-medium transition text-xs flex items-center gap-1.5 ${
            isSaving || hr === null || hr === undefined
              ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800"
              : "bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/30 border border-teal-500"
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-3 h-3 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSavedVitalId ? (
            <>
              <svg className="w-3.5 h-3.5 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Saved</span>
            </>
          ) : (
            <span>Save Reading</span>
          )}
        </button>
      </div>

      {error && (
        <div className="text-[11px] font-mono text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800/40">
          Notice: {error}
        </div>
      )}
    </div>
  );
}
