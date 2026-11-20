"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { ClinicalSafetyAlert } from "@/lib/contracts";

interface ClinicalSafetyAlertsProps {
  patientId: string;
}

export default function ClinicalSafetyAlerts({ patientId }: ClinicalSafetyAlertsProps) {
  const [alerts, setAlerts] = useState<ClinicalSafetyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await fetch(`/api/clinical/alerts?patient_id=${patientId}&limit=30`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setAlerts(data.data);
      }
    } catch (err) {
      console.error("[ClinicalSafetyAlerts] Failed to load alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchAlerts();

    // Subscribe to Supabase Realtime for instant clinical alerts
    const channel = supabase
      .channel(`clinical-alerts-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "clinical_safety_alerts",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const newAlert = payload.new as ClinicalSafetyAlert;
          setAlerts((prev) => [newAlert, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clinical_safety_alerts",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          const updatedAlert = payload.new as ClinicalSafetyAlert;
          setAlerts((prev) =>
            prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, fetchAlerts]);

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id);
    try {
      const res = await fetch("/api/clinical/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, acknowledged: true }),
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
        );
      }
    } catch (err) {
      console.error("[ClinicalSafetyAlerts] Acknowledge error:", err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const unackBlocks = alerts.filter((a) => a.verdict === "CRITICAL_BLOCK" && !a.acknowledged);

  return (
    <div className="space-y-4">
      {/* Elevated Caregiver Alert Banner for unacknowledged critical blocks */}
      {unackBlocks.length > 0 && (
        <div className="bg-red-950/40 border border-red-500/60 rounded-xl p-4 shadow-lg shadow-red-950/20 backdrop-blur-md animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-300 tracking-wide uppercase">
                CRITICAL MEDICATION SAFETY BLOCK DETECTED ({unackBlocks.length})
              </div>
              <p className="text-xs text-red-200 mt-0.5">
                Immediate clinical attention required: Scanned drug blocked by CortexMed Double-Dose or FDA Interaction Guard.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Alerts Card */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted">
                Clinical Safety Alerts ({alerts.length})
              </h3>
              <p className="text-[11px] text-muted">Real-time alerts via Supabase Realtime channel</p>
            </div>
          </div>
          <button
            onClick={fetchAlerts}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-xs text-muted">Loading clinical alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted border border-dashed border-border rounded-xl">
            No clinical safety alerts recorded for this resident.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {alerts.map((alert) => {
              const isBlock = alert.verdict === "CRITICAL_BLOCK";
              const isCaution = alert.verdict === "CAUTION";
              const badgeClass = isBlock
                ? "bg-red-100 text-red-700 border-red-200"
                : isCaution
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-emerald-100 text-emerald-700 border-emerald-200";

              return (
                <div
                  key={alert.id || alert.created_at}
                  className={`border rounded-xl p-3.5 transition-all ${
                    alert.acknowledged
                      ? "bg-background/40 border-border opacity-70"
                      : isBlock
                      ? "bg-red-50/50 border-red-200"
                      : "bg-amber-50/40 border-amber-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}
                      >
                        {alert.verdict}
                      </span>
                      <span className="text-xs font-semibold text-foreground">
                        {alert.alert_type.replace(/_/g, " ")}
                      </span>
                      {alert.detected_drug && (
                        <span className="text-xs text-muted">
                          Drug: <strong className="text-foreground">{alert.detected_drug}</strong>
                        </span>
                      )}
                      {alert.conflicting_drug && (
                        <span className="text-xs text-red-600">
                          vs <strong>{alert.conflicting_drug}</strong>
                        </span>
                      )}
                    </div>
                    {alert.id && (
                      <button
                        onClick={() => handleAcknowledge(alert.id!)}
                        disabled={alert.acknowledged || acknowledgingId === alert.id}
                        className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                          alert.acknowledged
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-800 text-white hover:bg-slate-700"
                        }`}
                      >
                        {alert.acknowledged ? "ACKNOWLEDGED ✓" : acknowledgingId === alert.id ? "SAVING..." : "ACKNOWLEDGE"}
                      </button>
                    )}
                  </div>

                  {/* Warning Messages */}
                  {alert.spoken_warning_en && (
                    <p className="text-xs text-foreground mt-2 font-medium leading-relaxed">
                      {alert.spoken_warning_en}
                    </p>
                  )}
                  {alert.spoken_warning_hi && (
                    <p className="text-[11px] text-muted mt-1 italic">
                      🇮🇳 {alert.spoken_warning_hi}
                    </p>
                  )}

                  {/* Citations */}
                  {alert.source_citations && alert.source_citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-border/60">
                      <div className="text-[10px] font-bold uppercase text-muted tracking-wider mb-1">
                        Citations & DailyMed Sources:
                      </div>
                      <div className="space-y-1">
                        {alert.source_citations.map((c, ci) => (
                          <div key={ci} className="text-[11px] text-muted flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-foreground">{c.source}</span>
                            {c.url && (
                              <a
                                href={c.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-teal-600 hover:underline font-mono text-[10px]"
                              >
                                View DailyMed SPL ↗
                              </a>
                            )}
                            {c.snippet && (
                              <span className="text-muted/80 block w-full text-[10px] truncate">
                                {c.snippet}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
