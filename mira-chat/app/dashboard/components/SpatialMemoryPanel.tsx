"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { SpatialMemoryObject } from "@/lib/contracts";

interface SpatialMemoryPanelProps {
  patientId: string;
}

function formatRelativeTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch {
    return dateString;
  }
}

function getObjectIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("bottle") || l.includes("pill") || l.includes("med")) {
    return (
      <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    );
  }
  if (l.includes("glass")) {
    return (
      <svg className="w-4 h-4 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="12" r="4" />
        <circle cx="18" cy="12" r="4" />
        <path d="M10 12h4" />
      </svg>
    );
  }
  if (l.includes("phone") || l.includes("cell")) {
    return (
      <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  if (l.includes("book")) {
    return (
      <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  if (l.includes("cup") || l.includes("mug")) {
    return (
      <svg className="w-4 h-4 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" y1="2" x2="6" y2="4" />
        <line x1="10" y1="2" x2="10" y2="4" />
        <line x1="14" y1="2" x2="14" y2="4" />
      </svg>
    );
  }
  // Default pin
  return (
    <svg className="w-4 h-4 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function SpatialMemoryPanel({ patientId }: SpatialMemoryPanelProps) {
  const [objects, setObjects] = useState<SpatialMemoryObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>("");
  const [selectedZone, setSelectedZone] = useState<string>("ALL");

  const loadObjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/clinical/spatial-memory?patient_id=${patientId}`);
      const json = await res.json();
      if (res.ok && json.ok && Array.isArray(json.data)) {
        setObjects(json.data);
      }
    } catch (err) {
      console.error("[SpatialMemoryPanel] Failed to load objects:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    setLoading(true);
    loadObjects();

    // Subscribe via Supabase Realtime to spatial_memory_objects
    const channel = supabase
      .channel(`spatial-objects-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "spatial_memory_objects",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setObjects((prev) => [payload.new as SpatialMemoryObject, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setObjects((prev) =>
              prev.map((o) => (o.id === payload.new.id ? (payload.new as SpatialMemoryObject) : o))
            );
          } else if (payload.eventType === "DELETE") {
            setObjects((prev) => prev.filter((o) => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, loadObjects]);

  // Extract unique room zones
  const roomZones = useMemo(() => {
    const zones = new Set<string>();
    objects.forEach((o) => {
      if (o.room_zone) zones.add(o.room_zone);
    });
    return Array.from(zones);
  }, [objects]);

  // Filtered objects
  const filteredObjects = useMemo(() => {
    return objects.filter((o) => {
      const matchesSearch =
        !filterText.trim() ||
        o.object_label.toLowerCase().includes(filterText.toLowerCase()) ||
        (o.location_description && o.location_description.toLowerCase().includes(filterText.toLowerCase())) ||
        (o.room_zone && o.room_zone.toLowerCase().includes(filterText.toLowerCase()));
      const matchesZone = selectedZone === "ALL" || o.room_zone === selectedZone;
      return matchesSearch && matchesZone;
    });
  }, [objects, filterText, selectedZone]);

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm card-hover mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              Spatial Memory Index
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-200/60">
                {objects.length} tracked
              </span>
            </h3>
            <p className="text-xs text-muted">
              Live physical object locations remembered from YOLOv8n vision HUD
            </p>
          </div>
        </div>

        {/* Search & Zone Filter */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search item..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500 w-32 sm:w-40"
          />
          {roomZones.length > 0 && (
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Rooms</option>
              {roomZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-8 text-center text-xs text-muted flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Loading spatial memory...
        </div>
      ) : filteredObjects.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-border rounded-xl bg-slate-50/50">
          <svg className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">No objects indexed yet</p>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Use <strong className="text-teal-700">&quot;Remember Objects&quot;</strong> on the AR Vision HUD (
            <span className="font-mono text-teal-800">/stream</span>) to index physical items with YOLOv8n.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredObjects.map((obj) => (
            <div
              key={obj.id}
              className="p-3.5 rounded-xl border border-border bg-background/80 hover:border-teal-300 transition-colors shadow-xs flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                {getObjectIcon(obj.object_label)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <h4 className="font-bold text-xs text-foreground truncate capitalize">
                    {obj.object_label}
                  </h4>
                  <span className="text-[10px] text-muted shrink-0 font-medium">
                    {formatRelativeTime(obj.last_seen_at)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/50">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                    {obj.room_zone || "Living Room"}
                  </span>

                  {obj.confidence && (
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {Math.round(Number(obj.confidence) * 100)}% conf
                    </span>
                  )}
                </div>

                {obj.location_description && (
                  <p className="text-[11px] text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {obj.location_description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
