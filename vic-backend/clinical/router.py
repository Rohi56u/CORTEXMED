"""
CortexMed Clinical FastAPI Router
Provides /api/clinical/verify-bottle and /api/clinical/check-interactions.
"""

import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
import httpx
from clinical.schemas import (
    BottleVerificationRequest,
    BottleVerificationResponse,
    InteractionCheckRequest,
    InteractionCheckResponse,
    ClinicalCitation,
)
from clinical.graph import run_bottle_verification
from clinical.rxnorm_openfda import evaluate_drug_pair_safety
from clinical import supabase_client

logger = logging.getLogger("cortexmed.router")

router = APIRouter(prefix="/api/clinical", tags=["Clinical Decision Support"])


@router.post("/verify-bottle", response_model=BottleVerificationResponse)
async def verify_medication_bottle(request: BottleVerificationRequest):
    """
    Main CortexMed Clinical CDSS Entrypoint:
    Executes compiled LangGraph workflow:
    Vision OCR -> RxNorm Normalization -> Temporal Cooldown Guard -> OpenFDA Interactions -> Verdict & Persistence.
    """
    try:
        response = await run_bottle_verification(
            patient_id=request.patient_id,
            detected_drug_name=request.detected_drug_name,
            detected_strength=request.detected_strength,
            source=request.source,
            confidence_score=request.confidence_score,
            image_base64=request.image_base64,
        )
        return response
    except Exception as e:
        logger.error(f"Error executing bottle verification workflow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Clinical verification engine error: {str(e)}")


@router.post("/check-interactions", response_model=InteractionCheckResponse)
async def check_medication_interactions(request: InteractionCheckRequest):
    """
    Direct endpoint for checking potential interactions between a candidate drug
    and all active prescribed medications for a patient.
    """
    patient_id = request.patient_id
    candidate_drug = request.drug_name

    active_meds = await supabase_client.get_active_medications(patient_id)
    if not active_meds:
        return InteractionCheckResponse(
            has_interaction=False,
            citations=[],
            spoken_warning_en=f"No active medications on file for patient {patient_id}. No known interactions.",
            spoken_warning_hi=f"Patient ke record mein koi active dawai darj nahi hai. Koi reaction nahi mila.",
        )

    meds_to_check = [
        med for med in active_meds
        if (med.get("drug_name") or "").lower() != candidate_drug.lower()
    ]

    interactions_found = []
    all_citations = []
    first_conflicting = None

    if meds_to_check:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": "CortexMed-Clinical-CDSS/1.0", "Accept": "application/json"}) as client:
            tasks = [
                evaluate_drug_pair_safety(candidate_drug, med.get("drug_name") or "", client=client)
                for med in meds_to_check
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for med, pair_result in zip(meds_to_check, results):
                if isinstance(pair_result, Exception):
                    logger.warning(f"Error checking interaction with {med.get('drug_name')}: {pair_result}")
                    continue
                if pair_result and pair_result.get("has_interaction"):
                    med_name = med.get("drug_name") or ""
                    interactions_found.append(med_name)
                    if not first_conflicting:
                        first_conflicting = med_name
                    for c in pair_result.get("citations", []):
                        all_citations.append(c)

    has_interaction = len(interactions_found) > 0
    spoken_en = (
        f"Warning: {candidate_drug} interacts with your active medication(s): {', '.join(interactions_found)}."
        if has_interaction
        else f"{candidate_drug} has no interactions with your current medications."
    )
    spoken_hi = (
        f"Savdhaan: {candidate_drug} aapki vartamaan dawaiyon ({', '.join(interactions_found)}) ke saath react kar sakti hai."
        if has_interaction
        else f"{candidate_drug} ka aapki vartamaan dawaiyon ke saath koi hanikarak reaction nahi hai."
    )

    return InteractionCheckResponse(
        has_interaction=has_interaction,
        severity="HIGH" if has_interaction else None,
        conflicting_drug=first_conflicting,
        citations=all_citations,
        spoken_warning_en=spoken_en,
        spoken_warning_hi=spoken_hi,
    )
