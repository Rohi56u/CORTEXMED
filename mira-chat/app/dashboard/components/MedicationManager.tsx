"use client";

import { useEffect, useState, useCallback } from "react";
import { Medication } from "@/lib/contracts";

interface MedicationManagerProps {
  patientId: string;
}

export default function MedicationManager({ patientId }: MedicationManagerProps) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [drugName, setDrugName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [strength, setStrength] = useState("");
  const [minIntervalHours, setMinIntervalHours] = useState("24");
  const [dosageInstructions, setDosageInstructions] = useState("");
  const [prescribedTimes, setPrescribedTimes] = useState("09:00");

  const fetchMedications = useCallback(async () => {
    if (!patientId) return;
    try {
      const res = await fetch(`/api/clinical/medications?patient_id=${patientId}&active_only=false`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setMedications(data.data);
      }
    } catch (err) {
      console.error("[MedicationManager] Failed to fetch medications:", err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchMedications();
  }, [patientId, fetchMedications]);

  const handleToggleActive = async (med: Medication) => {
    try {
      const res = await fetch("/api/clinical/medications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: med.id,
          is_active: !med.is_active,
        }),
      });
      if (res.ok) {
        setMedications((prev) =>
          prev.map((m) => (m.id === med.id ? { ...m, is_active: !m.is_active } : m))
        );
      }
    } catch (err) {
      console.error("[MedicationManager] Toggle error:", err);
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!drugName.trim()) {
      setFormError("Drug name is required");
      return;
    }
    if (!strength.trim()) {
      setFormError("Strength is required (e.g., '10mg')");
      return;
    }

    const interval = parseFloat(minIntervalHours);
    if (isNaN(interval) || interval < 0) {
      setFormError("Minimum interval hours must be a valid non-negative number");
      return;
    }

    const times = prescribedTimes
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await fetch("/api/clinical/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          drug_name: drugName.trim(),
          generic_name: genericName.trim() || undefined,
          strength: strength.trim(),
          min_interval_hours: interval,
          dosage_instructions: dosageInstructions.trim() || undefined,
          prescribed_times: times,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (data.ok && data.data) {
        setMedications((prev) => [...prev, data.data]);
        setShowAddModal(false);
        // Reset form
        setDrugName("");
        setGenericName("");
        setStrength("");
        setMinIntervalHours("24");
        setDosageInstructions("");
        setPrescribedTimes("09:00");
      } else {
        setFormError(data.error || "Failed to add medication");
      }
    } catch (err: any) {
      setFormError(err?.message || "Network error while saving medication");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
              <path d="m8.5 8.5 7 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted">
              Prescription Cooldown Manager ({medications.length})
            </h3>
            <p className="text-[11px] text-muted">Active prescriptions and temporal cooldown intervals</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
        >
          <span>+</span> Prescribe Medication
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-xs text-muted">Loading prescriptions...</div>
      ) : medications.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted border border-dashed border-border rounded-xl">
          No prescriptions on file. Use the button above to add one.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {medications.map((med) => (
            <div
              key={med.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                med.is_active ? "bg-background border-border" : "bg-muted/10 border-border/40 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-foreground">{med.drug_name}</span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-foreground px-2 py-0.5 rounded font-mono">
                    {med.strength}
                  </span>
                  {!med.is_active && (
                    <span className="text-[10px] uppercase font-bold text-muted bg-muted/20 px-1.5 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                  {med.generic_name && <span>Generic: {med.generic_name}</span>}
                  <span>&bull;</span>
                  <span className="text-teal-600 font-medium">Cooldown: {med.min_interval_hours}h</span>
                  {med.prescribed_times && med.prescribed_times.length > 0 && (
                    <>
                      <span>&bull;</span>
                      <span>Schedule: {med.prescribed_times.join(", ")}</span>
                    </>
                  )}
                </div>
                {med.dosage_instructions && (
                  <div className="text-[11px] text-muted/80 mt-0.5 italic">
                    {med.dosage_instructions}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleToggleActive(med)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded border transition-colors ${
                  med.is_active
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-teal-200 text-teal-600 hover:bg-teal-50"
                }`}
              >
                {med.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Medication Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-foreground">Add New Prescription</h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 text-xs bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddMedication} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Drug Name (Brand or Generic)*
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Warfarin, Donepezil, Coumadin"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Generic Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. warfarin"
                    value={genericName}
                    onChange={(e) => setGenericName(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Strength*
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 5mg, 500mg"
                    value={strength}
                    onChange={(e) => setStrength(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Min Cooldown (Hours)*
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={minIntervalHours}
                    onChange={(e) => setMinIntervalHours(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Prescribed Times (CSV)
                  </label>
                  <input
                    type="text"
                    placeholder="09:00, 21:00"
                    value={prescribedTimes}
                    onChange={(e) => setPrescribedTimes(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Dosage Instructions
                </label>
                <input
                  type="text"
                  placeholder="e.g. Take 1 tablet daily with dinner"
                  value={dosageInstructions}
                  onChange={(e) => setDosageInstructions(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-medium text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving Prescription..." : "Save Prescription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
