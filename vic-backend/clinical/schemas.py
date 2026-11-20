"""
CortexMed Clinical Contracts and Pydantic v2 Models
Aligns 1:1 with mira-chat/lib/contracts.ts
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

# ────────────────────────────────────────────────────────────────
# Clinical Enums and Types
# ────────────────────────────────────────────────────────────────

ClinicalVerdict = Literal["SAFE", "CAUTION", "CRITICAL_BLOCK"]

ClinicalAlertType = Literal[
    "DOUBLE_DOSE",
    "DRUG_INTERACTION",
    "FDA_BOXED_WARNING",
    "SUNDOWNING_AGITATION",
    "UNRECOGNIZED_MEDICATION",
]

DosageLogStatus = Literal[
    "TAKEN",
    "BLOCKED_DOUBLE_DOSE",
    "BLOCKED_INTERACTION",
    "SKIPPED",
]

VerificationSource = Literal[
    "BOTTLE_OCR",
    "VOICE_LOG",
    "CAREGIVER_MANUAL",
]

# ────────────────────────────────────────────────────────────────
# Citation & Entity Models
# ────────────────────────────────────────────────────────────────

class ClinicalCitation(BaseModel):
    source: str
    url: Optional[str] = None
    evidence_level: Optional[str] = None
    snippet: Optional[str] = None
    rxcui: Optional[str] = None
    fda_set_id: Optional[str] = None

class Medication(BaseModel):
    id: str
    patient_id: str
    drug_name: str
    generic_name: Optional[str] = None
    rxcui: Optional[str] = None
    strength: str
    dosage_instructions: Optional[str] = None
    min_interval_hours: float
    prescribed_times: Optional[List[str]] = Field(default_factory=list)
    is_active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class DosageLog(BaseModel):
    id: str
    patient_id: str
    medication_id: Optional[str] = None
    detected_drug_name: Optional[str] = None
    status: DosageLogStatus
    taken_at: str
    verification_source: VerificationSource
    confidence_score: Optional[float] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None

class ClinicalSafetyAlert(BaseModel):
    id: Optional[str] = None
    patient_id: str
    verdict: ClinicalVerdict
    alert_type: ClinicalAlertType
    detected_drug: Optional[str] = None
    conflicting_drug: Optional[str] = None
    spoken_warning_en: Optional[str] = None
    spoken_warning_hi: Optional[str] = None
    source_citations: List[ClinicalCitation] = Field(default_factory=list)
    acknowledged: bool = False
    acknowledged_at: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    created_at: Optional[str] = None

# ────────────────────────────────────────────────────────────────
# API Request & Response Shapes
# ────────────────────────────────────────────────────────────────

class BottleVerificationRequest(BaseModel):
    patient_id: str
    detected_drug_name: Optional[str] = ""
    detected_strength: Optional[str] = None
    source: VerificationSource = "BOTTLE_OCR"
    confidence_score: Optional[float] = None
    image_base64: Optional[str] = None

class NodeTraceItem(BaseModel):
    node: str
    status: str
    latency_ms: float
    detail: Optional[str] = None

class BottleVerificationResponse(BaseModel):
    verdict: ClinicalVerdict
    matched_medication: Optional[Medication] = None
    hours_since_last_dose: Optional[float] = None
    within_cooldown_window: bool = False
    cooldown_remaining_hours: Optional[float] = None
    alert: Optional[ClinicalSafetyAlert] = None
    spoken_warning_en: Optional[str] = None
    spoken_warning_hi: Optional[str] = None
    citations: List[ClinicalCitation] = Field(default_factory=list)
    node_trace: List[NodeTraceItem] = Field(default_factory=list)
    extracted_ocr: Optional[Dict[str, Any]] = None

class InteractionCheckRequest(BaseModel):
    patient_id: str
    drug_name: str
    rxcui: Optional[str] = None

class InteractionCheckResponse(BaseModel):
    has_interaction: bool
    severity: Optional[str] = None
    conflicting_drug: Optional[str] = None
    citations: List[ClinicalCitation] = Field(default_factory=list)
    spoken_warning_en: Optional[str] = None
    spoken_warning_hi: Optional[str] = None
