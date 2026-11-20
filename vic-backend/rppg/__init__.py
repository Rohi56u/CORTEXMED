"""
CortexMed Contactless rPPG Biomedical Signal Processing Package
Real OpenCV Face & Skin ROI Detection, POS Algorithm (Wang et al.),
and Deterministic Dementia Sundowning / Agitation Detection Engine.
"""

from .face_roi import FaceRoiDetector
from .pos_processor import POSProcessor
from .agitation import AgitationDetector
from .schemas import (
    NormalizedRoi,
    FaceRoiResponse,
    RgbSample,
    RppgProcessRequest,
    RppgProcessResponse,
)

__all__ = [
    "FaceRoiDetector",
    "POSProcessor",
    "AgitationDetector",
    "NormalizedRoi",
    "FaceRoiResponse",
    "RgbSample",
    "RppgProcessRequest",
    "RppgProcessResponse",
]
