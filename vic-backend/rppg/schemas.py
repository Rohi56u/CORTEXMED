"""
Pydantic v2 schemas for CortexMed Contactless rPPG Vitals & Sundowning Pipeline.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class NormalizedRoi(BaseModel):
    """
    Normalized [0.0, 1.0] coordinates relative to full video frame.
    """
    x: float = Field(..., ge=0.0, le=1.0, description="Normalized X coordinate of top-left corner")
    y: float = Field(..., ge=0.0, le=1.0, description="Normalized Y coordinate of top-left corner")
    width: float = Field(..., ge=0.0, le=1.0, description="Normalized width of ROI")
    height: float = Field(..., ge=0.0, le=1.0, description="Normalized height of ROI")
    label: Optional[str] = Field(None, description="Region label (e.g., face, forehead, left_cheek, right_cheek)")


class DetectFaceRequest(BaseModel):
    """
    Input image frame for face and skin-ROI detection (raw base64 or data URL).
    """
    image_base64: str = Field(..., description="Base64 encoded JPEG or PNG image frame")


class FaceRoiResponse(BaseModel):
    """
    Honest face and capillary-rich sub-ROI detection result.
    Strict Honesty: If no face is detected, face_detected is False and ROIs are None.
    """
    face_detected: bool = Field(..., description="True if genuine human face with skin pixels was detected")
    frame_width: int = Field(0, description="Width of decoded frame in pixels")
    frame_height: int = Field(0, description="Height of decoded frame in pixels")
    face_roi: Optional[NormalizedRoi] = Field(None, description="Full detected face bounding box")
    forehead_roi: Optional[NormalizedRoi] = Field(None, description="Forehead capillary-rich sub-ROI")
    left_cheek_roi: Optional[NormalizedRoi] = Field(None, description="Left cheek capillary-rich sub-ROI")
    right_cheek_roi: Optional[NormalizedRoi] = Field(None, description="Right cheek capillary-rich sub-ROI")
    skin_pixel_ratio: Optional[float] = Field(None, description="YCrCb genuine skin pixel fraction in detected face")
    message: str = Field("Face detector ready", description="Human-readable status message")


class RgbSample(BaseModel):
    """
    Timestamped spatial mean RGB sample collected from face-locked ROIs.
    """
    t_ms: float = Field(..., description="Timestamp in milliseconds from performance.now() or epoch")
    r: float = Field(..., description="Spatial mean Red channel intensity [0.0, 255.0]")
    g: float = Field(..., description="Spatial mean Green channel intensity [0.0, 255.0]")
    b: float = Field(..., description="Spatial mean Blue channel intensity [0.0, 255.0]")


class RppgProcessRequest(BaseModel):
    """
    Real sliding window of RGB samples for POS rPPG processing and agitation analysis.
    """
    patient_id: Optional[str] = Field(None, description="Optional UUID of patient for history/cooldown lookup")
    samples: List[RgbSample] = Field(..., min_length=1, description="Sequential timestamped RGB samples")
    persist: bool = Field(False, description="Persist valid high-SQI reading to Supabase vitals_telemetry")


class RppgProcessResponse(BaseModel):
    """
    Authentic rPPG vitals telemetry and dementia sundowning evaluation.
    Zero-Mock: Returns null when signal quality is low or buffering.
    """
    status: str = Field(..., description="OK, BUFFERING, LOW_SIGNAL_QUALITY, or INSUFFICIENT_DATA")
    heart_rate_bpm: Optional[float] = Field(None, description="Pulse rate in BPM extracted via Welch PSD")
    hrv_rmssd_ms: Optional[float] = Field(None, description="Heart Rate Variability RMSSD in milliseconds")
    signal_quality_index: Optional[float] = Field(None, ge=0.0, le=1.0, description="Spectral SNR mapped to [0.0, 1.0]")
    agitation_detected: bool = Field(False, description="True if sustained tachycardia or sympathetic arousal detected")
    agitation_reason: Optional[str] = Field(None, description="Clinical reason for agitation flag, including Sundowning window")
    baseline_source: Optional[str] = Field(None, description="'patient_history' or 'clinical_reference'")
    bvp_waveform: List[float] = Field(default_factory=list, description="Downsampled real filtered BVP pulse waveform")
    window_seconds: float = Field(0.0, description="Total duration of valid samples in seconds")
    persisted_vital_id: Optional[str] = Field(None, description="UUID of persisted row in public.vitals_telemetry if saved")
    alert_created: bool = Field(False, description="True if a clinical_safety_alerts row was created")
    message: Optional[str] = Field(None, description="Observability or clinical guidance message")
