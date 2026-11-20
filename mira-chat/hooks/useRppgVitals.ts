"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  NormalizedRoi,
  FaceRoiResponse,
  RgbSample,
  RppgProcessResponse,
} from "@/lib/contracts";

interface UseRppgVitalsOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  patientId?: string | null;
  enabled: boolean;
  defaultAutoPersist?: boolean;
}

export interface UseRppgVitalsReturn {
  faceDetected: boolean;
  faceRois: FaceRoiResponse | null;
  vitals: RppgProcessResponse | null;
  warmupProgress: number; // 0 to 100
  isProcessing: boolean;
  autoPersist: boolean;
  setAutoPersist: (val: boolean) => void;
  saveReading: () => Promise<boolean>;
  isSaving: boolean;
  lastSavedVitalId: string | null;
  error: string | null;
}

/**
 * Real Hybrid Face-Locked Contactless rPPG Vitals Hook.
 * Periodically detects facial ROIs via OpenCV backend, samples raw video frame
 * pixels inside forehead/cheek ROIs with YCrCb skin filtering, and streams
 * sliding windows to the POS signal processor.
 * Zero-Mock: Never fabricates pulse, waveform, or HRV.
 */
export function useRppgVitals({
  videoRef,
  patientId,
  enabled,
  defaultAutoPersist = false,
}: UseRppgVitalsOptions): UseRppgVitalsReturn {
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceRois, setFaceRois] = useState<FaceRoiResponse | null>(null);
  const [vitals, setVitals] = useState<RppgProcessResponse | null>(null);
  const [warmupProgress, setWarmupProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPersist, setAutoPersist] = useState(defaultAutoPersist);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedVitalId, setLastSavedVitalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mutable refs for high-frequency sampling without React state churn
  const bufferRef = useRef<RgbSample[]>([]);
  const faceRoisRef = useRef<FaceRoiResponse | null>(null);
  const faceDetectedRef = useRef(false);
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const detectFaceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ─────────────────────────────────────────────────────────────
  // 1. Face & Capillary ROI Calibration Loop (Every 1.5s)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      setFaceDetected(false);
      faceDetectedRef.current = false;
      setFaceRois(null);
      faceRoisRef.current = null;
      bufferRef.current = [];
      setWarmupProgress(0);
      setVitals(null);
      setError(null);
      if (detectFaceTimerRef.current) clearInterval(detectFaceTimerRef.current);
      return;
    }

    // Create offscreen canvas for snapshotting
    const snapshotCanvas = document.createElement("canvas");
    snapshotCanvas.width = 320;
    snapshotCanvas.height = 240;
    const snapCtx = snapshotCanvas.getContext("2d", { willReadFrequently: true });

    async function detectFaceCycle() {
      const vid = videoRef.current;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0) return;

      try {
        if (!snapCtx) return;
        snapCtx.drawImage(vid, 0, 0, 320, 240);
        const b64Jpeg = snapshotCanvas.toDataURL("image/jpeg", 0.65);

        const res = await fetch("/api/rppg/detect-face", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: b64Jpeg }),
        });

        if (!res.ok) {
          throw new Error(`Face detection HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.ok && json.data) {
          const roiData: FaceRoiResponse = json.data;
          setFaceRois(roiData);
          faceRoisRef.current = roiData;

          if (roiData.face_detected) {
            setFaceDetected(true);
            faceDetectedRef.current = true;
            setError(null);
          } else {
            // Face lost: reset sampling buffer and warmup honestly
            setFaceDetected(false);
            faceDetectedRef.current = false;
            bufferRef.current = [];
            setWarmupProgress(0);
            setError("No face detected — please face the camera in steady lighting");
          }
        }
      } catch (err: any) {
        // Honest error reporting
        if (enabled) {
          console.warn("[useRppgVitals] Face detection cycle failed:", err?.message);
        }
      }
    }

    // Immediate first run, then every 1500ms
    detectFaceCycle();
    detectFaceTimerRef.current = setInterval(detectFaceCycle, 1500);

    return () => {
      if (detectFaceTimerRef.current) clearInterval(detectFaceTimerRef.current);
    };
  }, [enabled, videoRef]);

  // ─────────────────────────────────────────────────────────────
  // 2. High-Frequency Real Pixel Mean Extraction Loop
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    if (!samplingCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = 160;
      c.height = 120;
      samplingCanvasRef.current = c;
    }
    const canvas = samplingCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let isRunning = true;
    let lastSampleTime = 0;

    function sampleRgbFrame(now: number) {
      if (!isRunning) return;

      const vid = videoRef.current;
      const currentRois = faceRoisRef.current;

      // Sample at ~30Hz (interval >= 30ms)
      if (
        vid &&
        vid.readyState >= 2 &&
        faceDetectedRef.current &&
        currentRois?.face_detected &&
        now - lastSampleTime >= 30
      ) {
        lastSampleTime = now;

        if (ctx) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const cw = canvas.width;
          const ch = canvas.height;

          // Collect ROIs to sample: Forehead + Left Cheek + Right Cheek
          const roisToSample: NormalizedRoi[] = [];
          if (currentRois.forehead_roi) roisToSample.push(currentRois.forehead_roi);
          if (currentRois.left_cheek_roi) roisToSample.push(currentRois.left_cheek_roi);
          if (currentRois.right_cheek_roi) roisToSample.push(currentRois.right_cheek_roi);
          if (roisToSample.length === 0 && currentRois.face_roi) {
            roisToSample.push(currentRois.face_roi);
          }

          let sumR = 0;
          let sumG = 0;
          let sumB = 0;
          let validPixelCount = 0;

          for (const roi of roisToSample) {
            const rx = Math.max(0, Math.min(Math.floor(roi.x * cw), cw - 1));
            const ry = Math.max(0, Math.min(Math.floor(roi.y * ch), ch - 1));
            const rw = Math.max(1, Math.min(Math.floor(roi.width * cw), cw - rx));
            const rh = Math.max(1, Math.min(Math.floor(roi.height * ch), ch - ry));

            try {
              const imgData = ctx.getImageData(rx, ry, rw, rh);
              const data = imgData.data;

              for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // YCrCb Skin Pixel Verification
                // Y  = 0.299R + 0.587G + 0.114B
                // Cr = (R - Y) * 0.713 + 128
                // Cb = (B - Y) * 0.564 + 128
                const yVal = 0.299 * r + 0.587 * g + 0.114 * b;
                const cr = (r - yVal) * 0.713 + 128;
                const cb = (b - yVal) * 0.564 + 128;

                if (cr >= 133 && cr <= 173 && cb >= 77 && cb <= 127) {
                  sumR += r;
                  sumG += g;
                  sumB += b;
                  validPixelCount++;
                }
              }
            } catch {
              // Ignore canvas read errors
            }
          }

          if (validPixelCount > 10) {
            const avgR = sumR / validPixelCount;
            const avgG = sumG / validPixelCount;
            const avgB = sumB / validPixelCount;

            const tNow = performance.now();
            bufferRef.current.push({
              t_ms: tNow,
              r: avgR,
              g: avgG,
              b: avgB,
            });

            // Keep sliding 12-second window
            const cutoff = tNow - 12000;
            while (bufferRef.current.length > 0 && bufferRef.current[0].t_ms < cutoff) {
              bufferRef.current.shift();
            }

            // Update warmup progress (0% -> 100% over first 8.0 seconds)
            const buf = bufferRef.current;
            if (buf.length > 1) {
              const spanSec = (buf[buf.length - 1].t_ms - buf[0].t_ms) / 1000.0;
              setWarmupProgress(Math.min(100, Math.round((spanSec / 8.0) * 100)));
            }
          }
        }
      }

      // Check if it's time to send window to /api/rppg/process (every 2.0s)
      const nowMs = performance.now();
      const buf = bufferRef.current;
      if (
        faceDetectedRef.current &&
        buf.length > 30 &&
        nowMs - lastProcessTimeRef.current >= 2000
      ) {
        const spanSec = (buf[buf.length - 1].t_ms - buf[0].t_ms) / 1000.0;
        if (spanSec >= 8.0) {
          lastProcessTimeRef.current = nowMs;
          const currentBuffer = [...buf];

          // Async background dispatch
          setIsProcessing(true);
          fetch("/api/rppg/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patient_id: patientId || undefined,
              samples: currentBuffer,
              persist: autoPersist,
            }),
          })
            .then(async (res) => {
              if (!res.ok) {
                const text = await res.text();
                throw new Error(`Process error ${res.status}: ${text}`);
              }
              const json = await res.json();
              if (json.ok && json.data) {
                setVitals(json.data);
                if (json.data.persisted_vital_id) {
                  setLastSavedVitalId(json.data.persisted_vital_id);
                }
                setError(null);
              }
            })
            .catch((err) => {
              console.warn("[useRppgVitals] Process call failed:", err.message);
              setError(err.message);
            })
            .finally(() => {
              setIsProcessing(false);
            });
        }
      }

      animationFrameRef.current = requestAnimationFrame(sampleRgbFrame);
    }

    animationFrameRef.current = requestAnimationFrame(sampleRgbFrame);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [enabled, patientId, autoPersist, videoRef]);

  // ─────────────────────────────────────────────────────────────
  // 3. Manual Save Reading Action
  // ─────────────────────────────────────────────────────────────
  const saveReading = useCallback(async (): Promise<boolean> => {
    if (!vitals || vitals.heart_rate_bpm === null || vitals.heart_rate_bpm === undefined) {
      setError("No valid vitals reading available to save");
      return false;
    }
    if (!patientId) {
      setError("Please select a patient before saving vitals");
      return false;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/clinical/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          heart_rate_bpm: vitals.heart_rate_bpm,
          hrv_rmssd_ms: vitals.hrv_rmssd_ms,
          signal_quality_index: vitals.signal_quality_index,
          agitation_detected: vitals.agitation_detected,
          agitation_reason: vitals.agitation_reason,
          window_seconds: Math.round(vitals.window_seconds),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Save failed: ${text}`);
      }

      const json = await res.json();
      if (json.ok && json.data) {
        setLastSavedVitalId(json.data.id);
        setError(null);
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err?.message || "Failed to persist vitals reading");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [vitals, patientId]);

  return {
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
  };
}
