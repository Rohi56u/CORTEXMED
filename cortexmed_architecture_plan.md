# CortexMed — Architectural Audit & 5-Phase Implementation Plan

## Goal Description
We are upgrading the existing Mira eldercare repository into **CortexMed** — a zero-hardware (browser/webcam-first), privacy-first 3D Spatial Memory & Clinical Medication Guardian for Dementia Patients.

This system integrates:
1. **Pillar 1: Browser-Side YOLOv8n ONNX HUD & Pill Bottle Trigger** (`mira-chat/yolo/`, `/stream`) running WebGL/WASM client-side inference on standard webcam feeds with ROI bottle cropping.
2. **Pillar 2: Zero-Hallucination Clinical Safety & Medication Guardrail** (`vic-backend/clinical/`) using LangGraph CDSS patterns: Vision OCR, Supabase dosage cooldown verification, and real OpenFDA/RxNorm live API interaction validation.
3. **Pillar 3: Contactless Camera Vitals & Agitation Detection** (`vic-backend/rppg/`) based on rPPG-Toolbox principles: face ROI extraction, CHROM/POS signal analysis, rolling HR/HRV stress proxy, and dementia sundowning detection.
4. **Pillar 4: Unified Privacy-First Health Memory & MCP Tool Layer** (`mirobody` pattern + Supabase migration `004_cortexmed_clinical.sql`), PII redaction middleware, and strongly-typed MCP tools.

---

## User Review Required

> [!IMPORTANT]
> **API Key Requirements (Summary for User)**:
> 1. **Supabase (Mandatory)**: URL, Anon Key, and Service Role Key (for database storage, medication logs, and Realtime dashboard alerts).
> 2. **OpenRouter API Key or OpenAI API Key (Mandatory)**: For conversational chat, patient Q&A, and Whisper STT / OpenAI TTS.
> 3. **Google Gemini API Key (Mandatory)**: For 3D Spatial Memory (`explorer/`) and high-precision pill bottle OCR extraction.
> 4. **OpenFDA & RxNorm APIs (NO KEY NEEDED — 100% FREE & PUBLIC)**: Public US Government REST endpoints (`api.fda.gov` and `rxnav.nlm.nih.gov`). Strict live queries with honest actionable error states if unreachable (Zero-Mock policy).
> 5. **Twilio (Optional)**: For real SMS caregiver alerts. Falls back gracefully to in-app real-time dashboard notifications if omitted.
> 6. **YOLOv8n & rPPG (NO KEY NEEDED)**: Runs 100% locally in browser and local Python process.

> [!WARNING]
> **Clean Deletion of 8 Unused Folders**:
> Audit confirms **zero** code imports from `android/`, `securitycam/`, `assets/`, `depthanything/`, `hloc_localization/`, `reconstruction/`, `scenegraph/`, and `segmentation/`. They will be deleted once Phase 1 commences to keep the workspace lightweight and focused.

---

## Repository Audit

### 1. What Works Out-of-the-Box
- **Next.js 16 / React 19 Frontend (`mira-chat/`)**: Fully functional page structures for `/` (Landing), `/device` (Voice/Chat interface), `/dashboard` (Supervisor real-time telemetry and alerts), and `/stream` (AR HUD view).
- **YOLO Pipeline Skeleton (`mira-chat/yolo/`)**: `useDetection.ts` has frame capture, NCHW Float32 tensor conversion, YOLOv8 `[1, 84, 8400]` output parsing, and Non-Maximum Suppression (NMS). `DetectionOverlay.tsx` has glow HUD bounding box rendering.
- **WASM Webpack Setup (`mira-chat/next.config.ts`)**: Preconfigured with `type: "asset/resource"` for `.wasm` and `serverExternalPackages: ["onnxruntime-web"]`.
- **Supabase Core Migrations (`mira-chat/supabase/migrations/`)**: `001_schema.sql`, `002_enable_realtime.sql`, and `003_seed_demo.sql` exist and provide tables for patients, patient_cards, events, and object_state.
- **Spatial Object Finder (`explorer/`)**: `object_finder.py` and `gemini_client.py` support 3D object localization via multi-view bounding box consensus.

### 2. Broken Imports, Missing Dependencies & Configurations
- **`mira-chat/public/models/yolov8n.onnx` is missing**: The model file (~12MB) is absent; must be placed into `public/models/` for browser-side ONNX inference.
- **`mira-chat/node_modules` is not installed**: Dependencies in `package.json` (`onnxruntime-web`, `@supabase/supabase-js`, `streamdown`, `ws`, `next`) need installation.
- **`/stream` Page YOLO & Video decoupling**:
  - `page.tsx` hardcodes YOLO to `enabled: false`.
  - `page.tsx` binds `videoRef` to an MJPEG/SSE canvas rather than standard browser webcam `<video>` (`getUserMedia`).
  - No bottle ROI crop trigger exists to send detected pill bottles to the Clinical Safety API.
- **`vic-backend` is legacy**:
  - `main.py` is an old GCS/Firestore capture server; it completely lacks LangGraph clinical decision support, OpenFDA/RxNorm interaction checking, and rPPG camera vitals endpoints.
  - `requirements.txt` lacks `langgraph`, `pydantic>=2.0`, `supabase`, `scipy`, `opencv-python-headless`.
- **Database Schema Gaps**:
  - Missing clinical tables: `medications`, `dosage_logs`, `vitals_telemetry`, `clinical_safety_alerts`, `spatial_memory_objects`.
  - Missing Realtime publications for clinical safety events.
- **Missing `.env.example`**: Neither `mira-chat` nor `vic-backend` has `.env.example` documentation.

---

## System Architecture Diagram (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT (CortexMed HUD)                            │
│                                                                                        │
│   Webcam Stream (navigator.mediaDevices.getUserMedia)                                  │
│         │                                                                              │
│         ├────────► [YOLOv8n ONNX Runtime Web] (WebGL / WASM)                           │
│         │               │                                                              │
│         │               ├─► Real-time AR HUD Bounding Boxes (Overlay Canvas)           │
│         │               └─► Detection = "bottle" ──► [Crop Pill Bottle ROI Canvas]     │
│         │                                                          │                   │
│         ├────────► [Face ROI Extractor] (5-10 FPS sample)          │ Base64 Image      │
│         │               │                                          │                   │
│         │               └─► Telemetry Stream (Webcam Frames)       │                   │
└─────────┼───────────────────────────┼──────────────────────────────┼───────────────────┘
          │                           │                              │
          ▼                           ▼                              ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────────────────────┐
│        NEXT.JS API LAYER          │ │         VIC-BACKEND / CLINICAL WORKER            │
│           (mira-chat)             │ │               (FastAPI + Python)                 │
│                                   │ │                                                  │
│  /api/chat                        │ │  1. LangGraph Clinical CDSS Workflow:            │
│    ├─► PII Redaction Middleware   │ │      Node A: Medication Vision / OCR Parser      │
│    │     (Strip name, phone, etc.)│ │              (Pydantic v2 JSON Schema)           │
│    └─► OpenRouter (LLM Reasoning) │ │                    │                             │
│                                   │ │      Node B: Temporal Double-Dose Guard          │
│  /api/clinical/verify-bottle ─────┼─┼─────►        (Queries Supabase dosage_logs)      │
│    (Pass-through to Python CDSS)  │ │                    │                             │
│                                   │ │      Node C: Real-Time Drug Interaction          │
│  /api/escalate                    │ │              (Live OpenFDA Boxed Warnings +      │
│    ├─► Caregiver Twilio SMS       │ │               Live RxNorm API Queries)           │
│    └─► CRITICAL_BLOCK Event       │ │                    │                             │
│                                   │ │      Output: [SAFE | CAUTION | CRITICAL_BLOCK]   │
│  /api/events                      │ │              Spoken Plain-Language Warning       │
│    └─► Event Spine Dispatch       │ │                                                  │
│                                   │ │  2. Contactless rPPG Worker:                     │
│                                   │ │      Face ROI ──► POS / CHROM RGB Filtering      │
│                                   │ │      ──► Bandpass (0.7-3.0 Hz) ──► Welch PSD     │
│                                   │ │      ──► HR (BPM) + RMSSD (HRV) + SQI            │
│                                   │ │      ──► Agitation / Sundowning Spike Detector   │
└─────────────────┬─────────────────┘ └────────────────────────────┬─────────────────────┘
                  │                                                │
                  ▼                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               SUPABASE REALTIME POSTGRESQL                             │
│                                                                                        │
│   • patients & patient_cards (Profiles & Medical History)                              │
│   • medications & dosage_logs (Timestamps, Dosage, Status)                             │
│   • vitals_telemetry (BPM, HRV, SQI, Agitation Alert Flags)                            │
│   • clinical_safety_alerts (CRITICAL_BLOCK, Source Citations, Logs)                    │
│   • events (Event Spine for Device & Caregiver Dashboard)                              │
│                                                                                        │
│   Realtime WebSocket Subscriptions ──────────────────► Caregiver Dashboard (/dashboard)│
│                                                    ──► AR Stream HUD (/stream)         │
│                                                    ──► Resident Voice Device (/device) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Exact `.env.example` Specification

### 1. `mira-chat/.env.example`
```bash
# =============================================================================
# CortexMed Frontend (mira-chat) Environment Configuration
# =============================================================================

# [MANDATORY] Supabase Database & Realtime
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# [MANDATORY] LLM Intelligence (Voice/Chat reasoning & medical QA)
# Provides GPT-4o / GPT-5-mini access via OpenRouter
OPENROUTER_API_KEY="sk-or-v1-..."

# [OPTIONAL / FALLBACK] Direct OpenAI Key (for Whisper Speech-to-Text & TTS)
OPENAI_API_KEY="sk-proj-..."

# [MANDATORY] Python Backend Integration URL
NEXT_PUBLIC_VIC_BACKEND_URL="http://localhost:8000"

# [OPTIONAL] Caregiver SMS Alerts via Twilio (Graceful fallback to Supabase Dashboard)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
TWILIO_ALERT_TO=""
```

### 2. `vic-backend/.env.example`
```bash
# =============================================================================
# CortexMed Clinical & Vision Worker (vic-backend) Environment Configuration
# =============================================================================

# [MANDATORY] Python Server Port
PORT=8000
HOST="0.0.0.0"

# [MANDATORY] Supabase Direct Access for Dosage Logs & Clinical Alerts
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# [MANDATORY] Gemini API Key for High-Precision Pill Bottle OCR & Extraction
GEMINI_API_KEY="AIzaSy..."

# [OPTIONAL] OpenFDA API Key (Defaults to public unauthenticated tier, 40 req/min)
OPENFDA_API_KEY=""

# [OPTIONAL] OpenRouter API Key for LangGraph Clinical Decision Reasoning
OPENROUTER_API_KEY="sk-or-v1-..."
```

---

## 5-Phase Implementation Plan

### Phase 1: Base Setup + YOLO ONNX HUD & Pill Bottle Trigger
- **Clean Unused Folders**: Verify 0 imports and remove `android/`, `securitycam/`, `assets/`, `depthanything/`, `hloc_localization/`, `reconstruction/`, `scenegraph/`, `segmentation/`.
- **Model Generation**: Export authentic `yolov8n.onnx` (`imgsz=640`, `opset=12`) into `mira-chat/public/models/` and verify tensor shape `[1, 84, 8400]`.
- **Next.js & Frontend Config**: Ensure `onnxruntime-web` WASM configuration is fully operational in `next.config.ts` and runtime binaries copied to `public/ort/`.
- **Webcam Integration in `/stream/page.tsx`**: Add direct browser webcam (`getUserMedia`) with `<video>` element alongside MJPEG stream toggle.
- **Pill Bottle Scan Flow**: Enable bottle class detection (`COCO label: bottle`), compute high-confidence bbox, render glowing HUD target, and add "Verify Medication Bottle" raw-frame ROI canvas crop trigger with preview card.

### Phase 2: Supabase Clinical Schema + MCP Tool Layer + PII Redactor
- **Additive Migration (`004_cortexmed_clinical.sql`)**:
  - `medications`: Patient active prescriptions, dosage, frequency, max daily doses.
  - `dosage_logs`: Exact timestamp of administration, verification status, dose quantity.
  - `vitals_telemetry`: Heart rate (BPM), HRV stress index, SQI, agitation flags.
  - `clinical_safety_alerts`: Severity (`CRITICAL_BLOCK`, `CAUTION`, `SAFE`), FDA warning codes, citations.
  - `spatial_memory_objects`: 3D coordinates, room location, confidence.
  - Enable Supabase Realtime for all new tables.
- **TypeScript Contracts (`lib/contracts.ts`)**: Add types for all clinical schemas, vitals, alerts, and tool inputs.
- **PII Redaction Middleware (`lib/pii.ts`)**: Redact patient names, room numbers, addresses, phone numbers prior to LLM/external API calls.
- **MCP Tool Wrappers (`lib/tools/mcp-health.ts`)**:
  - `get_active_medications(patient_id)`
  - `check_last_dose(patient_id, medication_name)`
  - `log_medication_event(patient_id, medication_name, dose, status)`
  - `get_latest_vitals(patient_id)`
  - `query_spatial_object(patient_id, object_name)`

### Phase 3: LangGraph + OpenFDA/RxNorm Safety Guardrail
- **Modular Clinical Agent in `vic-backend/clinical/`**:
  - `schemas.py`: Pydantic v2 models for `MedicationBottleOCR`, `DoseGuardResult`, `DrugInteractionResult`, `ClinicalSafetyVerdict`.
  - `vision_parser.py`: Extracts medication name, strength, dosage instructions from cropped image.
  - `dose_guard.py`: Temporal double-dose query against Supabase `dosage_logs` checking cooldown interval.
  - `interaction_validator.py`: Queries live OpenFDA drug interaction API and RxNorm interaction endpoint; handles network errors cleanly with transparent clinical status (Zero Mocks policy).
  - `graph.py`: LangGraph stateful execution connecting Vision -> Dose Guard -> Interaction Validator -> Safety Verdict.
- **FastAPI Endpoints**:
  - `POST /api/clinical/verify-bottle`: Accepts Base64 crop or metadata, runs LangGraph, writes alert to Supabase if `CRITICAL_BLOCK`.
- **Frontend Integration**:
  - Connect `/stream` bottle crop to `/api/clinical/verify-bottle`.
  - Wire real-time `CRITICAL_BLOCK` audio announcement and supervisor banner on `/dashboard`.

### Phase 4: Contactless rPPG Vitals Pipeline & Sundowning Alert
- **Lightweight rPPG Engine (`vic-backend/rppg/`)**:
  - `processor.py`: Face ROI detection (OpenCV Haar/MediaPipe), Green channel spatial averaging, Plane-Orthogonal-to-Skin (POS) and CHROM chromaticity algorithm.
  - Temporal filtering: Butterworth bandpass filter (0.7 Hz to 3.0 Hz / 42 to 180 BPM).
  - Fast Fourier Transform (FFT) / Welch PSD for Heart Rate (BPM).
  - Peak detection for Inter-Beat Interval (IBI) and Root Mean Square of Successive Differences (RMSSD) as HRV stress proxy.
  - Signal Quality Index (SQI) estimation based on spectral peak sharpness.
  - Agitation / Sundowning anomaly detection (sustained BPM > 100 + HRV drop > 30% below baseline).
- **FastAPI WebSocket / REST Endpoint**:
  - `POST /api/vitals/frame-chunk`: Ingests video frames from client webcam.
  - Stores telemetry into Supabase `vitals_telemetry`.
- **Caregiver Dashboard Widget (`mira-chat/app/dashboard/`)**:
  - Real-time live vitals telemetry card (BPM gauge, HRV indicator, Signal Quality bar).
  - Sundowning / Acute Agitation alert notification banner.

### Phase 5: End-to-End Integration, Bilingual Voice & System Hardening
- **Bilingual Voice Support**: English and Hindi plain-language synthesized reminders for spatial finding ("Aapke chashme nightstand par hain") and medication safety ("Rukiye! Yeh dawai aap pehle hi le chuke hain").
- **100% Real API & Device Operations**: Clear, actionable error UI states on camera denial or API network timeout (Zero Mocks / Zero Simulated Vitals policy).
- **Verification & Testing**:
  - TypeScript compilation check (`npm run build`).
  - Python tests for LangGraph safety verdicts (`pytest`).
  - End-to-end live testing of pill bottle verification, double-dose block, and vitals streaming.

---

## Verification Plan

### Automated Verification
```bash
# 1. Frontend Build & Typecheck
cd mira-chat
npm run build

# 2. Python Backend & LangGraph Safety Tests
cd ../vic-backend
pytest tests/test_clinical_guardrail.py
pytest tests/test_rppg.py

# 3. Supabase Schema Verification
# Validate migration 004 syntax and seed data
```

### Manual Verification
1. **YOLO Detection & Crop**: Navigate to `/stream`, enable webcam, point camera at a bottle, observe glowing HUD box, click "Verify Medication Bottle", verify cropped preview.
2. **Double-Dose Prevention**: Scan "Metformin 500mg" within cooldown window; observe `CRITICAL_BLOCK` alert, calm voice warning, and immediate Caregiver Dashboard alert card.
3. **OpenFDA Drug Interaction**: Test concurrent prescription of interacting drugs; verify citation of live FDA boxed warning.
4. **Contactless rPPG**: Face the camera; observe rolling real-time BPM and HRV metrics updating on supervisor dashboard.
