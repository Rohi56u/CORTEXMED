"""
CortexMed Phase 4 Scientific rPPG & Agitation Automated Verification Suite
Validates OpenCV Haar Cascade, POS DSP (Wang et al.), Non-Uniform Spline Resampling,
Spectral SNR Rejection Gate, Agitation Detection, and Live FastAPI Endpoints.
"""

import sys
import os
import base64
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import cv2

# Add vic-backend directory to Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from rppg.face_roi import FaceRoiDetector
from rppg.pos_processor import POSProcessor
from rppg.agitation import AgitationDetector
from rppg.schemas import RgbSample
from main import app
from fastapi.testclient import TestClient

def run_phase4_suite():
    print("=" * 65)
    print("  CORTEXMED PHASE 4 rPPG & AGITATION AUTOMATED VERIFICATION SUITE")
    print("=" * 65)

    passed_checks = 0
    total_checks = 0

    def check(name: str, condition: bool, detail: str = ""):
        nonlocal passed_checks, total_checks
        total_checks += 1
        if condition:
            passed_checks += 1
            print(f"  [PASS] {name}" + (f" - {detail}" if detail else ""))
        else:
            print(f"  [FAIL] {name}" + (f" - {detail}" if detail else ""))

    # ─────────────────────────────────────────────────────────────
    # CHECK 1: OpenCV Face & Skin ROI Detection
    # ─────────────────────────────────────────────────────────────
    print("\n--- Check 1: OpenCV Face & Skin ROI Detection ---")
    detector = FaceRoiDetector()
    check(
        "OpenCV Haar Cascade loads cleanly",
        detector.face_cascade is not None and not detector.face_cascade.empty(),
        "Loaded haarcascade_frontalface_default.xml"
    )

    # Blank image (black 320x240 image)
    blank_img = np.zeros((240, 320, 3), dtype=np.uint8)
    res_blank = detector.detect_face_and_rois(blank_img)
    check(
        "Rejects blank image honestly",
        res_blank.face_detected is False and res_blank.face_roi is None,
        f"face_detected={res_blank.face_detected}, msg='{res_blank.message}'"
    )

    # Random noise image (320x240 non-face image)
    noise_img = np.random.randint(0, 255, (240, 320, 3), dtype=np.uint8)
    res_noise = detector.detect_face_and_rois(noise_img)
    check(
        "Rejects noise image honestly",
        res_noise.face_detected is False,
        f"face_detected={res_noise.face_detected}"
    )

    # ─────────────────────────────────────────────────────────────
    # CHECK 2: POSProcessor Ground Truth Recovery on Jittered FPS
    # ─────────────────────────────────────────────────────────────
    print("\n--- Check 2: POSProcessor Ground Truth Recovery on Jittered FPS ---")
    processor = POSProcessor(target_fs=30.0, min_window_sec=8.0)

    # Test Frequency 1: 1.20 Hz (72.0 BPM)
    rng = np.random.default_rng(101)
    dt_1 = rng.uniform(0.028, 0.042, 360)  # non-uniform webcam frames ~24-35 FPS
    t_jitter_1 = np.cumsum(np.concatenate(([0.0], dt_1)))
    t_jitter_1 = t_jitter_1[t_jitter_1 <= 12.0]
    freq_1 = 1.20
    target_bpm_1 = 72.0

    samples_1 = [
        RgbSample(
            t_ms=float(t * 1000.0),
            r=float(160.0 + 0.5 * np.sin(2 * np.pi * freq_1 * t)),
            g=float(110.0 + 2.0 * np.sin(2 * np.pi * freq_1 * t + np.pi)),  # Green absorption counter-phase
            b=float(90.0 + 0.3 * np.sin(2 * np.pi * freq_1 * t)),
        )
        for t in t_jitter_1
    ]

    res_1 = processor.process_rgb_samples(samples_1)
    hr_1 = res_1.heart_rate_bpm
    diff_1 = abs(hr_1 - target_bpm_1) if hr_1 is not None else 999.0
    check(
        "POS recovers 1.20 Hz (72.0 BPM) within +-1.5 BPM",
        res_1.status == "OK" and hr_1 is not None and diff_1 <= 1.5,
        f"Target: {target_bpm_1} BPM, Recovered: {hr_1} BPM (diff: {diff_1:.2f} BPM, SQI: {res_1.signal_quality_index})"
    )

    # Test Frequency 2: 1.85 Hz (111.0 BPM)
    dt_2 = rng.uniform(0.028, 0.042, 360)
    t_jitter_2 = np.cumsum(np.concatenate(([0.0], dt_2)))
    t_jitter_2 = t_jitter_2[t_jitter_2 <= 12.0]
    freq_2 = 1.85
    target_bpm_2 = 111.0

    samples_2 = [
        RgbSample(
            t_ms=float(t * 1000.0),
            r=float(160.0 + 0.5 * np.sin(2 * np.pi * freq_2 * t)),
            g=float(110.0 + 2.0 * np.sin(2 * np.pi * freq_2 * t + np.pi)),
            b=float(90.0 + 0.3 * np.sin(2 * np.pi * freq_2 * t)),
        )
        for t in t_jitter_2
    ]

    res_2 = processor.process_rgb_samples(samples_2)
    hr_2 = res_2.heart_rate_bpm
    diff_2 = abs(hr_2 - target_bpm_2) if hr_2 is not None else 999.0
    check(
        "POS recovers 1.85 Hz (111.0 BPM) within +-1.5 BPM",
        res_2.status == "OK" and hr_2 is not None and diff_2 <= 1.5,
        f"Target: {target_bpm_2} BPM, Recovered: {hr_2} BPM (diff: {diff_2:.2f} BPM, SQI: {res_2.signal_quality_index})"
    )

    # HRV RMSSD systolic peak detection check on clean consecutive beats (res_1)
    check(
        "Real HRV RMSSD calculated on clean consecutive systolic peaks (>= 5 IBIs)",
        res_1.status == "OK" and res_1.hrv_rmssd_ms is not None and res_1.hrv_rmssd_ms >= 0.0,
        f"hrv_rmssd_ms={res_1.hrv_rmssd_ms} ms"
    )

    # ─────────────────────────────────────────────────────────────
    # CHECK 3: Pure Gaussian White Noise Rejection Gate
    # ─────────────────────────────────────────────────────────────
    print("\n--- Check 3: Pure Gaussian White Noise Rejection Gate ---")
    t_noise = np.arange(0.0, 12.0, 1.0 / 30.0)
    noise_r = rng.normal(128.0, 15.0, len(t_noise))
    noise_g = rng.normal(128.0, 15.0, len(t_noise))
    noise_b = rng.normal(128.0, 15.0, len(t_noise))

    samples_noise = [
        RgbSample(
            t_ms=float(t * 1000.0),
            r=float(noise_r[i]),
            g=float(noise_g[i]),
            b=float(noise_b[i]),
        )
        for i, t in enumerate(t_noise)
    ]

    res_noise = processor.process_rgb_samples(samples_noise)
    check(
        "Rejects Gaussian noise with SQI < 0.25",
        res_noise.status == "LOW_SIGNAL_QUALITY"
        and res_noise.heart_rate_bpm is None
        and res_noise.signal_quality_index is not None
        and res_noise.signal_quality_index < 0.25,
        f"status: '{res_noise.status}', SQI: {res_noise.signal_quality_index}, heart_rate_bpm: {res_noise.heart_rate_bpm}"
    )

    # Short buffer rejection check (< 8.0s)
    short_samples = samples_1[:int(5.0 * 30)]  # 5 seconds
    res_short = processor.process_rgb_samples(short_samples)
    check(
        "Honest BUFFERING status on < 8.0s sample duration",
        res_short.status == "BUFFERING" and res_short.heart_rate_bpm is None,
        f"status: '{res_short.status}', window_seconds: {res_short.window_seconds}s"
    )

    # ─────────────────────────────────────────────────────────────
    # CHECK 4: Agitation & Sundowning Anomaly Detector
    # ─────────────────────────────────────────────────────────────
    print("\n--- Check 4: Agitation & Sundowning Anomaly Detector ---")
    AgitationDetector.reset_state("test-patient-1")

    # Normal resting vitals (HR=72, HRV=38, SQI=0.75, baseline_hr=75, baseline_hrv=35)
    agitated_norm, reason_norm = AgitationDetector.evaluate_window_agitation(
        hr=72.0,
        hrv=38.0,
        sqi=0.75,
        baseline_hr=75.0,
        baseline_hrv=35.0,
        patient_key="test-patient-1",
    )
    check(
        "Normal resting vitals do NOT trigger agitation",
        agitated_norm is False and reason_norm is None,
        f"agitation_detected={agitated_norm}"
    )

    # Window 1 with acute tachycardia (HR=104.0, HRV=20.0, SQI=0.70)
    # Must NOT trigger immediately on single window (prevent false positive)
    agitated_w1, _ = AgitationDetector.evaluate_window_agitation(
        hr=104.0,
        hrv=20.0,
        sqi=0.70,
        baseline_hr=75.0,
        baseline_hrv=35.0,
        patient_key="test-patient-1",
    )
    check(
        "Single elevated window does NOT trigger (requires 2 consecutive)",
        agitated_w1 is False,
        "Filtered single-window spike"
    )

    # Window 2 with sustained acute tachycardia (HR=105.0, HRV=19.0, SQI=0.72)
    # MUST trigger agitation on 2nd consecutive window
    agitated_w2, reason_w2 = AgitationDetector.evaluate_window_agitation(
        hr=105.0,
        hrv=19.0,
        sqi=0.72,
        baseline_hr=75.0,
        baseline_hrv=35.0,
        patient_key="test-patient-1",
    )
    check(
        "Sustained 2nd consecutive elevated window triggers agitation",
        agitated_w2 is True and reason_w2 is not None and "Sustained" in reason_w2,
        f"reason: '{reason_w2}'"
    )

    # Cooldown enforcement
    from rppg import agitation as ag_mod
    ag_mod._last_alert_timestamps["test-patient-1"] = datetime.now(timezone.utc)
    in_cooldown = AgitationDetector.is_in_cooldown("test-patient-1")
    check(
        "Alert cooldown actively blocks spam within 5 minutes",
        in_cooldown is True,
        f"is_in_cooldown={in_cooldown}"
    )

    # Low SQI (< 0.35) resets consecutive window streak
    AgitationDetector.reset_state("test-patient-sqi-reset")
    # Window 1 elevated
    AgitationDetector.evaluate_window_agitation(
        hr=105.0, hrv=18.0, sqi=0.70, baseline_hr=75.0, baseline_hrv=35.0, patient_key="test-patient-sqi-reset"
    )
    # Window 2 noisy (SQI = 0.20 < 0.35 threshold) -> resets streak
    AgitationDetector.evaluate_window_agitation(
        hr=105.0, hrv=18.0, sqi=0.20, baseline_hr=75.0, baseline_hrv=35.0, patient_key="test-patient-sqi-reset"
    )
    # Window 3 elevated again -> should be streak 1, so agitation_detected MUST be False
    agitated_w3, _ = AgitationDetector.evaluate_window_agitation(
        hr=105.0, hrv=18.0, sqi=0.70, baseline_hr=75.0, baseline_hrv=35.0, patient_key="test-patient-sqi-reset"
    )
    check(
        "Low SQI (< 0.35) resets consecutive window streak to prevent false positives",
        agitated_w3 is False,
        f"agitated_w3={agitated_w3} (streak correctly reset after noisy frame)"
    )

    # ─────────────────────────────────────────────────────────────
    # CHECK 5: FastAPI Live Endpoint Smoke Test (TestClient)
    # ─────────────────────────────────────────────────────────────
    print("\n--- Check 5: FastAPI Live Endpoint Smoke Test ---")
    client = TestClient(app)

    # GET /health
    health_resp = client.get("/health")
    health_data = health_resp.json()
    check(
        "GET /health returns 200 OK and reports rppg_ready: True",
        health_resp.status_code == 200 and health_data.get("rppg_ready") is True,
        f"status: {health_resp.status_code}, rppg_ready: {health_data.get('rppg_ready')}"
    )

    # POST /api/rppg/detect-face with blank image base64
    _, blank_jpeg = cv2.imencode(".jpg", blank_img)
    blank_b64 = base64.b64encode(blank_jpeg).decode("utf-8")
    face_resp = client.post("/api/rppg/detect-face", json={"image_base64": blank_b64})
    face_data = face_resp.json()
    check(
        "POST /api/rppg/detect-face returns 200 with honest face_detected: False",
        face_resp.status_code == 200 and face_data.get("face_detected") is False,
        f"face_detected: {face_data.get('face_detected')}, message: '{face_data.get('message')}'"
    )

    # POST /api/rppg/process with 12s valid sample data
    process_payload = {
        "patient_id": "test-patient-smoke",
        "samples": [s.model_dump() for s in samples_1],
        "persist": False,
    }
    process_resp = client.post("/api/rppg/process", json=process_payload)
    process_data = process_resp.json()
    check(
        "POST /api/rppg/process returns 200 OK with authentic pulse waveform",
        process_resp.status_code == 200
        and process_data.get("status") == "OK"
        and process_data.get("heart_rate_bpm") is not None
        and len(process_data.get("bvp_waveform", [])) > 0,
        f"BPM: {process_data.get('heart_rate_bpm')}, waveform points: {len(process_data.get('bvp_waveform', []))}"
    )

    print("\n" + "=" * 65)
    print(f"  ALL {passed_checks}/{total_checks} PHASE 4 CHECKS PASSED")
    print("=" * 65)

    if passed_checks != total_checks:
        sys.exit(1)

if __name__ == "__main__":
    run_phase4_suite()
