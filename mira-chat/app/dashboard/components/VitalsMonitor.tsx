"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { VitalsTelemetry } from "@/lib/contracts";

interface VitalsMonitorProps {
  patientId: string;
}

interface RollingStats {
  count: number;
  average_hr: number;
  min_hr: number;
  max_hr: number;
  average_hrv: number | null;
  average_sqi: number | null;
  agitation_events_count: number;
  latest?: VitalsTelemetry;
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return new Date(isoString).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
}

export default function VitalsMonitor({ patientId }: VitalsMonitorProps) {
  const [telemetry, setTelemetry] = useState<VitalsTelemetry[]>([]);
  const [stats, setStats] = useState<RollingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    hr: number;
    hrv?: number | null;
    time: string;
  } | null>(null);

  const fetchVitals = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await fetch(`/api/clinical/vitals?patient_id=${patientId}&limit=25`);
      const data = await res.json();
      if (data.ok && data.data) {
        if (Array.isArray(data.data.telemetry)) {
          setTelemetry(data.data.telemetry);
        }
        if (data.data.stats) {
          setStats(data.data.stats);
        }
      }
    } catch (err) {
      console.error("[VitalsMonitor] Failed to fetch vitals:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchVitals();

    // Subscribe to Supabase Realtime for instant live vitals telemetry inserts
    const channel = supabase
      .channel(`vitals-telemetry-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vitals_telemetry",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const newVital = payload.new as VitalsTelemetry;
          setTelemetry((prev) => {
            const next = [newVital, ...prev.filter((p) => p.id !== newVital.id)];
            return next.slice(0, 30);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, fetchVitals]);

  const latest = telemetry[0] ?? null;

  // Chronological points for SVG trend chart (oldest to newest, max 16 points)
  const chartPoints = useMemo(() => {
    const slice = [...telemetry].slice(0, 16).reverse();
    return slice;
  }, [telemetry]);

  // SVG Chart Geometry
  const svgWidth = 540;
  const svgHeight = 160;
  const padding = { top: 20, right: 24, bottom: 28, left: 36 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Min and max bounds for HR scale
  const hrBounds = useMemo(() => {
    if (chartPoints.length === 0) return { min: 50, max: 120 };
    const hrs = chartPoints.map((p) => Number(p.heart_rate_bpm)).filter((v) => !isNaN(v));
    const minVal = Math.floor(Math.min(...hrs, 55) / 10) * 10;
    const maxVal = Math.ceil(Math.max(...hrs, 105) / 10) * 10;
    return { min: Math.max(30, minVal), max: Math.min(200, maxVal) };
  }, [chartPoints]);

  const hrPath = useMemo(() => {
    if (chartPoints.length < 2) return "";
    const n = chartPoints.length;
    const { min, max } = hrBounds;
    const range = max - min || 1;

    return chartPoints
      .map((p, i) => {
        const x = padding.left + (i / (n - 1)) * plotWidth;
        const hr = Number(p.heart_rate_bpm);
        const y = padding.top + plotHeight - ((hr - min) / range) * plotHeight;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [chartPoints, hrBounds, padding.left, padding.top, plotWidth, plotHeight]);

  const hrvPath = useMemo(() => {
    const validHrvPoints = chartPoints.filter((p) => p.hrv_rmssd_ms !== null && p.hrv_rmssd_ms !== undefined);
    if (validHrvPoints.length < 2) return "";
    const n = chartPoints.length;
    // Map HRV [0, 80ms] to plot height
    return chartPoints
      .filter((p) => p.hrv_rmssd_ms !== null && p.hrv_rmssd_ms !== undefined)
      .map((p, i, arr) => {
        const origIdx = chartPoints.indexOf(p);
        const x = padding.left + (origIdx / (n - 1)) * plotWidth;
        const hrv = Number(p.hrv_rmssd_ms);
        const y = padding.top + plotHeight - Math.min(1, hrv / 75) * plotHeight;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [chartPoints, padding.left, padding.top, plotWidth, plotHeight]);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-muted">Connecting to Realtime Vitals Telemetry...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm card-hover">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600">
            <svg className="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight text-foreground flex items-center gap-2">
              Contactless rPPG Vitals & Sundowning Monitor
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                LIVE REALTIME
              </span>
            </h3>
            <p className="text-xs text-muted">
              Contactless camera photoplethysmography via Plane-Orthogonal-to-Skin (POS)
            </p>
          </div>
        </div>

        {latest && (
          <span className="text-xs font-mono text-muted">
            Last reading: <span className="text-foreground font-semibold">{formatRelativeTime(latest.recorded_at)}</span>
          </span>
        )}
      </div>

      {/* Prominent Dementia Sundowning & Agitation Indicator */}
      {latest?.agitation_detected && (
        <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Sundowning & Acute Agitation Detected
                </span>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-rose-200 text-rose-800">
                  AUTONOMIC AROUSAL
                </span>
              </div>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                {latest.agitation_reason ||
                  "Sustained elevated pulse and parasympathetic autonomic tone withdrawal detected."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Honest Empty State: 0 rows recorded */}
      {telemetry.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-xl border border-dashed border-border bg-slate-50/50">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-teal-50 flex items-center justify-center text-teal-600">
            <svg className="w-6 h-6 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-foreground">
            No contactless vitals recorded yet
          </h4>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            Start a Contactless Vitals Check-In on <span className="font-mono text-teal-600">/stream</span> to capture real
            pulse and HRV telemetry using the resident-facing front camera.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Latest Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Heart Rate */}
            <div className="bg-background border border-border rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Heart Rate (BPM)
              </div>
              <div className="text-2xl font-black font-mono text-teal-600 tracking-tight">
                {Number(latest.heart_rate_bpm).toFixed(1)}
              </div>
              <div className="text-[10px] font-mono text-muted mt-0.5">
                {stats?.average_hr ? `Avg: ${stats.average_hr} BPM` : "Pulse Rate"}
              </div>
            </div>

            {/* HRV RMSSD */}
            <div className="bg-background border border-border rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                HRV (RMSSD)
              </div>
              <div className="text-2xl font-black font-mono text-cyan-600 tracking-tight">
                {latest.hrv_rmssd_ms !== null && latest.hrv_rmssd_ms !== undefined
                  ? `${Number(latest.hrv_rmssd_ms).toFixed(1)}ms`
                  : "--"}
              </div>
              <div className="text-[10px] font-mono text-muted mt-0.5">
                Autonomic Tone
              </div>
            </div>

            {/* Signal Quality */}
            <div className="bg-background border border-border rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Signal Quality
              </div>
              <div className="text-2xl font-black font-mono text-indigo-600 tracking-tight">
                {latest.signal_quality_index !== null && latest.signal_quality_index !== undefined
                  ? `${Math.round(Number(latest.signal_quality_index) * 100)}%`
                  : "--"}
              </div>
              <div className="text-[10px] font-mono text-muted mt-0.5">
                Spectral SNR
              </div>
            </div>

            {/* Window Seconds / Agitation Events */}
            <div className="bg-background border border-border rounded-xl p-3.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                Agitation Events
              </div>
              <div className={`text-2xl font-black font-mono tracking-tight ${
                stats?.agitation_events_count ? "text-rose-600" : "text-emerald-600"
              }`}>
                {stats?.agitation_events_count ?? (latest.agitation_detected ? 1 : 0)}
              </div>
              <div className="text-[10px] font-mono text-muted mt-0.5">
                In rolling window
              </div>
            </div>
          </div>

          {/* Responsive SVG Trend Line Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground text-xs">
                Physiological Pulse Trend
              </span>
              <div className="flex items-center gap-4 text-[11px] font-mono text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
                  Heart Rate (BPM)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-0.5 bg-cyan-500 inline-block" />
                  HRV RMSSD (ms)
                </span>
              </div>
            </div>

            <div className="relative rounded-xl border border-border bg-slate-900 text-white overflow-hidden p-2">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-40 block"
                preserveAspectRatio="none"
              >
                {/* Y-axis grid lines and labels */}
                {[0, 0.5, 1.0].map((frac, idx) => {
                  const y = padding.top + plotHeight * frac;
                  const val = Math.round(hrBounds.max - frac * (hrBounds.max - hrBounds.min));
                  return (
                    <g key={idx}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        fill="rgba(148, 163, 184, 0.7)"
                        fontSize="9"
                        fontFamily="ui-monospace, monospace"
                        textAnchor="end"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* HRV Trend Curve (cyan dashed) */}
                {hrvPath && (
                  <path
                    d={hrvPath}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.75"
                    strokeDasharray="4 2"
                    strokeLinecap="round"
                  />
                )}

                {/* Heart Rate Trend Curve (teal bold) */}
                {hrPath && (
                  <path
                    d={hrPath}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Points on HR Curve */}
                {chartPoints.map((p, i) => {
                  const x = padding.left + (i / (chartPoints.length - 1)) * plotWidth;
                  const hr = Number(p.heart_rate_bpm);
                  const y = padding.top + plotHeight - ((hr - hrBounds.min) / (hrBounds.max - hrBounds.min || 1)) * plotHeight;
                  const isAgitated = p.agitation_detected;

                  return (
                    <circle
                      key={p.id || i}
                      cx={x}
                      cy={y}
                      r={isAgitated ? 5 : 3.5}
                      fill={isAgitated ? "#ef4444" : "#14b8a6"}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      className="cursor-pointer hover:scale-150 transition-transform"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          x,
                          y,
                          hr,
                          hrv: p.hrv_rmssd_ms,
                          time: formatRelativeTime(p.recorded_at),
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}
              </svg>

              {/* Hover Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute pointer-events-none bg-slate-800 text-white text-[11px] font-mono px-2 py-1 rounded shadow-lg border border-slate-700"
                  style={{
                    left: `${(hoveredPoint.x / svgWidth) * 100}%`,
                    top: `${(hoveredPoint.y / svgHeight) * 100}%`,
                    transform: "translate(-50%, -120%)",
                  }}
                >
                  <div>HR: {hoveredPoint.hr.toFixed(1)} BPM</div>
                  {hoveredPoint.hrv && <div>HRV: {Number(hoveredPoint.hrv).toFixed(1)} ms</div>}
                  <div className="text-[9px] text-slate-400">{hoveredPoint.time}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
