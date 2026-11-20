"""
CortexMed Contactless rPPG & Agitation Endpoints
FastAPI Router for Real Face/Capillary ROI Localization and POS DSP Vitals Processing.
"""

import logging
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any

from .schemas import (
    DetectFaceRequest,
    FaceRoiResponse,
    RppgProcessRequest,
    RppgProcessResponse,
)
from .face_roi import FaceRoiDetector
from .pos_processor import POSProcessor
from .agitation import AgitationDetector

logger = logging.getLogger("cortexmed.rppg.router")

router = APIRouter(prefix="/api/rppg", tags=["Contactless rPPG Vitals"])

# Instantiate singletons for low-overhead CPU reuse
_face_detector: FaceRoiDetector = FaceRoiDetector()
_pos_processor: POSProcessor = POSProcessor(target_fs=30.0, min_window_sec=8.0)

@router.post(
    "/detect-face",
    response_model=FaceRoiResponse,
    summary="Detect Face & Capillary ROIs",
    description="Locates face bounding box and extracts forehead/cheek sub-ROIs for contactless rPPG sampling.",
)
async def detect_face(request: DetectFaceRequest) -> FaceRoiResponse:
    try:
        response = _face_detector.process_base64_frame(request.image_base64)
        return response
    except Exception as e:
        logger.error(f"Error in face detection: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face detection pipeline error: {str(e)}",
        )

@router.post(
    "/process",
    response_model=RppgProcessResponse,
    summary="Process POS rPPG Vitals & Agitation",
    description="Applies Wang et al. POS algorithm, Butterworth filtering, and Welch PSD to extract real BPM, HRV, and agitation.",
)
async def process_rppg(request: RppgProcessRequest) -> RppgProcessResponse:
    try:
        # 1. Run POS DSP processing pipeline
        dsp_res = _pos_processor.process_rgb_samples(
            samples=request.samples,
            patient_id=request.patient_id,
        )

        # If DSP returned low quality, buffering, or error, return immediately
        if dsp_res.status != "OK" or dsp_res.heart_rate_bpm is None:
            return dsp_res

        # 2. Run deterministic Dementia Sundowning & Agitation evaluation
        agitation_res = await AgitationDetector.process_agitation_and_persist(
            patient_id=request.patient_id,
            heart_rate_bpm=dsp_res.heart_rate_bpm,
            hrv_rmssd_ms=dsp_res.hrv_rmssd_ms,
            signal_quality_index=dsp_res.signal_quality_index,
            window_seconds=dsp_res.window_seconds,
            persist=request.persist,
        )

        # Merge agitation and persistence attributes
        dsp_res.agitation_detected = agitation_res.get("agitation_detected", False)
        dsp_res.agitation_reason = agitation_res.get("agitation_reason")
        dsp_res.baseline_source = agitation_res.get("baseline_source")
        dsp_res.persisted_vital_id = agitation_res.get("persisted_vital_id")
        dsp_res.alert_created = agitation_res.get("alert_created", False)

        return dsp_res
    except Exception as e:
        logger.error(f"Error in rPPG processing pipeline: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"rPPG signal processing error: {str(e)}",
        )
