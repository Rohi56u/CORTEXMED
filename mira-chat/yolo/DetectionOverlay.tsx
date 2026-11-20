"use client";

import { useEffect, useRef } from "react";
import { Detection, getColor } from "./types";

interface DetectionOverlayProps {
  detections: Detection[];
  /** Video element dimensions (used to map box coords to canvas) */
  videoWidth: number;
  videoHeight: number;
  /** Canvas CSS size (usually the container size) */
  canvasWidth: number;
  canvasHeight: number;
  inferenceMs?: number;
  showFps?: boolean;
  provider?: string | null;
  objectFit?: "cover" | "contain";
  targetedDetection?: Detection | null;
}

export default function DetectionOverlay({
  detections,
  videoWidth,
  videoHeight,
  canvasWidth,
  canvasHeight,
  inferenceMs = 0,
  showFps = true,
  provider = null,
  objectFit = "cover",
  targetedDetection = null,
}: DetectionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas resolution to match container
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const safeVideoW = videoWidth > 0 ? videoWidth : 640;
    const safeVideoH = videoHeight > 0 ? videoHeight : 640;
    const videoRatio = safeVideoW / safeVideoH;
    const containerRatio = canvasWidth / (canvasHeight || 1);

    // Compute exact rendered dimensions and offsets to prevent drift with object-cover/contain
    let renderW = canvasWidth;
    let renderH = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (objectFit === "contain") {
      if (containerRatio > videoRatio) {
        renderH = canvasHeight;
        renderW = canvasHeight * videoRatio;
        offsetX = (canvasWidth - renderW) / 2;
        offsetY = 0;
      } else {
        renderW = canvasWidth;
        renderH = canvasWidth / videoRatio;
        offsetX = 0;
        offsetY = (canvasHeight - renderH) / 2;
      }
    } else {
      // "cover" (standard full-viewport camera mode)
      if (containerRatio > videoRatio) {
        renderW = canvasWidth;
        renderH = canvasWidth / videoRatio;
        offsetX = 0;
        offsetY = (canvasHeight - renderH) / 2;
      } else {
        renderH = canvasHeight;
        renderW = canvasHeight * videoRatio;
        offsetX = (canvasWidth - renderW) / 2;
        offsetY = 0;
      }
    }

    const sx = renderW / safeVideoW;
    const sy = renderH / safeVideoH;

    for (const det of detections) {
      const isTargeted =
        targetedDetection != null &&
        (targetedDetection === det ||
          (targetedDetection.label === det.label &&
            Math.abs(targetedDetection.x - det.x) < 1e-3 &&
            Math.abs(targetedDetection.y - det.y) < 1e-3));

      const x = det.x * sx + offsetX;
      const y = det.y * sy + offsetY;
      const w = det.width * sx;
      const h = det.height * sy;
      const color = isTargeted ? "rgba(0,255,200,1)" : getColor(det.label);
      const pct = Math.round(det.confidence * 100);

      // Box outline
      ctx.strokeStyle = isTargeted ? "rgba(0,255,200,0.9)" : color;
      ctx.lineWidth = isTargeted ? 3 : 2;
      ctx.shadowColor = isTargeted ? "rgba(0,255,200,0.8)" : color;
      ctx.shadowBlur = isTargeted ? 12 : 6;
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // Clinical target reticle accents
      const cornerLen = Math.min(w, h, isTargeted ? 24 : 16);
      ctx.lineWidth = isTargeted ? 4 : 3;
      ctx.strokeStyle = isTargeted ? "#00ffc8" : color;

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + h - cornerLen);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + cornerLen, y + h);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - cornerLen);
      ctx.stroke();

      // If targeted medication bottle, draw center crosshair reticle
      if (isTargeted) {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const arm = Math.min(14, w / 4, h / 4);

        ctx.strokeStyle = "rgba(0,255,200,0.9)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy);
        ctx.lineTo(cx + arm, cy);
        ctx.moveTo(cx, cy - arm);
        ctx.lineTo(cx, cy + arm);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, arm * 0.7, 0, 2 * Math.PI);
        ctx.stroke();
      }

      ctx.lineWidth = 1;

      // Label background
      const label = isTargeted
        ? `MEDICATION TARGET · ${pct}%`
        : `${det.label} ${pct}%`;
      ctx.font = "bold 11px 'DM Mono', monospace";
      const textWidth = ctx.measureText(label).width;
      const labelH = 18;
      const labelY = y > labelH + 4 ? y - labelH - 2 : y + h + 2;

      ctx.fillStyle = isTargeted ? "rgba(0,30,20,0.85)" : "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(x, labelY, textWidth + 14, labelH, 4);
      ctx.fill();

      // Label border
      ctx.strokeStyle = isTargeted ? "#00ffc8" : color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, labelY, textWidth + 14, labelH, 4);
      ctx.stroke();

      // Label text
      ctx.fillStyle = isTargeted ? "#00ffc8" : color;
      ctx.fillText(label, x + 7, labelY + 13);
    }

    // Telemetry badge
    if (showFps && inferenceMs > 0) {
      const fps = Math.round(1000 / inferenceMs);
      const provStr = provider ? provider.toUpperCase() : "ORT";
      const info = `CortexMed YOLOv8n (${provStr}) · ${inferenceMs}ms · ${fps} FPS · ${detections.length} obj`;
      ctx.font = "600 10px 'DM Mono', monospace";
      const tw = ctx.measureText(info).width;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.beginPath();
      ctx.roundRect(canvasWidth - tw - 20, 10, tw + 14, 20, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,255,200,0.25)";
      ctx.stroke();
      ctx.fillStyle = "rgba(120,255,200,0.9)";
      ctx.fillText(info, canvasWidth - tw - 13, 24);
    }
  }, [
    detections,
    videoWidth,
    videoHeight,
    canvasWidth,
    canvasHeight,
    inferenceMs,
    showFps,
    provider,
    objectFit,
    targetedDetection,
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}
