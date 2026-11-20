"""
CortexMed Clinical Decision Support System (CDSS)
Compiled LangGraph StateGraph Workflow with Deterministic Clinical Safety Precedence.
"""

import time
import re
import asyncio
import logging
from datetime import datetime, timezone
from typing import TypedDict, List, Optional, Dict, Any
import httpx

from langgraph.graph import StateGraph, START, END

from clinical.schemas import (
    ClinicalVerdict,
    ClinicalAlertType,
    DosageLogStatus,
    VerificationSource,
    ClinicalCitation,
    Medication,
    ClinicalSafetyAlert,
    NodeTraceItem,
    BottleVerificationResponse,
)
from clinical.rxnorm_openfda import (
    normalize_drug_rxnorm,
    get_openfda_drug_label,
    evaluate_drug_pair_safety,
    RxNormData,
)
from clinical.ocr_vision import extract_pill_bottle_ocr
from clinical import supabase_client

logger = logging.getLogger("cortexmed.graph")


# ────────────────────────────────────────────────────────────────
# State Definition
# ────────────────────────────────────────────────────────────────

class ClinicalGraphState(TypedDict):
    # Inputs
    patient_id: str
    image_base64: Optional[str]
    detected_drug_name: Optional[str]
    detected_strength: Optional[str]
    source: str
    confidence_score: Optional[float]

    # Node 1: Vision OCR output
    ocr_result: Optional[Dict[str, Any]]
    ocr_error: Optional[str]

    # Node 2: Normalized context
    scanned_rx: Optional[Dict[str, Any]]
    patient_medications: List[Dict[str, Any]]
    matched_medication: Optional[Dict[str, Any]]
    is_unprescribed: bool

    # Node 3: Temporal Cooldown Guard
    hours_since_last_dose: Optional[float]
    within_cooldown_window: bool
    cooldown_remaining_hours: Optional[float]
    double_dose_detected: bool
    last_taken_time: Optional[str]

    # Node 4: Drug Interactions & FDA SPL
    interactions_found: List[Dict[str, Any]]
    conflicting_drug: Optional[str]
    has_boxed_warning: bool
    boxed_warning_text: Optional[str]
    citations: List[Dict[str, Any]]

    # Node 5: Clinical Verdict & Persistence
    verdict: Optional[str]  # SAFE, CAUTION, CRITICAL_BLOCK
    alert_type: Optional[str]
    spoken_warning_en: Optional[str]
    spoken_warning_hi: Optional[str]
    persisted_alert_id: Optional[str]
    persisted_dosage_log_id: Optional[str]

    # Observability
    node_trace: List[Dict[str, Any]]
    error: Optional[str]


def is_valid_drug_name(name: Optional[str]) -> bool:
    """Returns True only if name is non-empty and not a placeholder."""
    if not name:
        return False
    clean = name.strip()
    return bool(clean and clean.upper() != "PENDING_OCR")


# ────────────────────────────────────────────────────────────────
# Node 1: Vision OCR Node
# ────────────────────────────────────────────────────────────────

async def vision_ocr_node(state: ClinicalGraphState) -> Dict[str, Any]:
    t0 = time.perf_counter()
    image_b64 = state.get("image_base64")
    detected_name = state.get("detected_drug_name") or ""
    clean_detected = detected_name if is_valid_drug_name(detected_name) else ""

    trace_item: Dict[str, Any] = {
        "node": "vision_ocr_node",
        "status": "SKIPPED",
        "latency_ms": 0.0,
        "detail": "Direct drug_name provided; OCR bypassed" if clean_detected else "No initial drug_name provided",
    }

    if image_b64:
        ocr_res = await extract_pill_bottle_ocr(image_b64)
        latency = (time.perf_counter() - t0) * 1000.0

        if not ocr_res.get("success"):
            trace_item = {
                "node": "vision_ocr_node",
                "status": "ERROR",
                "latency_ms": round(latency, 2),
                "detail": ocr_res.get("error", "Vision OCR failed"),
            }
            return {
                "ocr_result": ocr_res,
                "ocr_error": ocr_res.get("error"),
                "detected_drug_name": clean_detected,
                "node_trace": state.get("node_trace", []) + [trace_item],
            }

        extracted_drug = (ocr_res.get("drug_name") or "").strip()
        confidence = float(ocr_res.get("ocr_confidence") or 0.0)
        is_bottle = bool(ocr_res.get("is_medication_bottle", False))

        is_reliable = is_bottle and is_valid_drug_name(extracted_drug) and confidence >= 0.5
        effective_drug = extracted_drug if is_reliable else clean_detected

        trace_item = {
            "node": "vision_ocr_node",
            "status": "COMPLETED" if is_reliable else "WARNING",
            "latency_ms": round(latency, 2),
            "detail": (
                f"Extracted: '{extracted_drug}' (Confidence: {confidence:.2f})"
                if is_reliable
                else f"Low confidence or unreadable label (Confidence: {confidence:.2f})"
            ),
        }

        return {
            "ocr_result": ocr_res,
            "detected_drug_name": effective_drug,
            "detected_strength": ocr_res.get("strength") or state.get("detected_strength"),
            "confidence_score": confidence or state.get("confidence_score"),
            "node_trace": state.get("node_trace", []) + [trace_item],
        }

    latency = (time.perf_counter() - t0) * 1000.0
    trace_item["latency_ms"] = round(latency, 2)
    return {
        "detected_drug_name": clean_detected,
        "node_trace": state.get("node_trace", []) + [trace_item],
    }


def should_continue_after_ocr(state: ClinicalGraphState) -> str:
    """Conditional edge checking whether a valid medication was identified."""
    ocr_result = state.get("ocr_result")
    drug_name = (state.get("detected_drug_name") or "").strip()

    # If OCR was attempted and failed to reliably extract a medication bottle
    if ocr_result:
        if not ocr_result.get("success"):
            return "clinical_verdict_and_persist_node"
        if not ocr_result.get("is_medication_bottle"):
            return "clinical_verdict_and_persist_node"
        if float(ocr_result.get("ocr_confidence") or 0.0) < 0.5:
            return "clinical_verdict_and_persist_node"
        if not is_valid_drug_name(ocr_result.get("drug_name")):
            return "clinical_verdict_and_persist_node"

    if not is_valid_drug_name(drug_name):
        return "clinical_verdict_and_persist_node"

    return "normalize_and_load_context_node"


# ────────────────────────────────────────────────────────────────
# Node 2: Normalize and Load Context Node
# ────────────────────────────────────────────────────────────────

async def normalize_and_load_context_node(state: ClinicalGraphState) -> Dict[str, Any]:
    t0 = time.perf_counter()
    patient_id = state["patient_id"]
    drug_name = (state.get("detected_drug_name") or "").strip()

    # 1. Normalize drug via NIH RxNorm & RxClass
    rx_norm_data, norm_err = await normalize_drug_rxnorm(drug_name)

    # 2. Fetch active patient medications from Supabase
    active_meds = await supabase_client.get_active_medications(patient_id)

    # 3. Match against active prescriptions
    matched_med = None
    scanned_terms = rx_norm_data.all_matching_terms()

    for med in active_meds:
        med_name = (med.get("drug_name") or "").lower()
        med_gen = (med.get("generic_name") or "").lower()
        med_rxcui = str(med.get("rxcui")).strip() if med.get("rxcui") else None

        # Direct RxCUI match
        if med_rxcui and rx_norm_data.rxcui and med_rxcui == str(rx_norm_data.rxcui).strip():
            matched_med = med
            break
        # Ingredient RxCUI match (e.g. prescription has generic, scanned has brand)
        if med_rxcui and any(med_rxcui == str(cui).strip() for cui in rx_norm_data.ingredient_rxcuis):
            matched_med = med
            break
        # Word boundary exact term match
        if any(re.search(r"\b" + re.escape(term) + r"\b", med_name) for term in scanned_terms):
            matched_med = med
            break
        if med_gen and any(re.search(r"\b" + re.escape(term) + r"\b", med_gen) for term in scanned_terms):
            matched_med = med
            break

    is_unprescribed = matched_med is None
    latency = (time.perf_counter() - t0) * 1000.0

    trace_item: Dict[str, Any] = {
        "node": "normalize_and_load_context_node",
        "status": "COMPLETED",
        "latency_ms": round(latency, 2),
        "detail": f"RxNorm: '{rx_norm_data.canonical_name}' (RxCUI: {rx_norm_data.rxcui}). Matched prescription: {bool(matched_med)}",
    }

    return {
        "scanned_rx": {
            "query_name": rx_norm_data.query_name,
            "rxcui": rx_norm_data.rxcui,
            "canonical_name": rx_norm_data.canonical_name,
            "ingredients": rx_norm_data.ingredients,
            "ingredient_rxcuis": rx_norm_data.ingredient_rxcuis,
            "epc_classes": rx_norm_data.epc_classes,
        },
        "patient_medications": active_meds,
        "matched_medication": matched_med,
        "is_unprescribed": is_unprescribed,
        "node_trace": state.get("node_trace", []) + [trace_item],
    }


# ────────────────────────────────────────────────────────────────
# Node 3: Temporal Double-Dose Guard Node
# ────────────────────────────────────────────────────────────────

async def temporal_double_dose_guard_node(state: ClinicalGraphState) -> Dict[str, Any]:
    t0 = time.perf_counter()
    patient_id = state["patient_id"]
    matched_med = state.get("matched_medication")
    scanned_rx = state.get("scanned_rx") or {}
    drug_name = scanned_rx.get("canonical_name") or state.get("detected_drug_name") or ""

    med_id = matched_med.get("id") if matched_med else None
    min_interval = float(matched_med.get("min_interval_hours") or 0) if matched_med else 0.0

    # Query latest dose log for this drug or medication
    last_log = await supabase_client.get_latest_dose_log(
        patient_id=patient_id,
        medication_id=med_id,
        drug_name=drug_name,
    )

    hours_since_last_dose = None
    within_cooldown = False
    cooldown_remaining = None
    double_dose_detected = False
    last_taken_iso = None

    if last_log and last_log.get("taken_at"):
        last_taken_iso = last_log["taken_at"]
        try:
            taken_dt = datetime.fromisoformat(last_taken_iso.replace("Z", "+00:00"))
            # Critical clinical fix: ensure offset-awareness to prevent naive datetime subtraction crash
            if taken_dt.tzinfo is None:
                taken_dt = taken_dt.replace(tzinfo=timezone.utc)
            now_dt = datetime.now(timezone.utc)
            delta_seconds = (now_dt - taken_dt).total_seconds()
            hours_since_last_dose = max(0.0, delta_seconds / 3600.0)

            if min_interval > 0 and hours_since_last_dose < min_interval:
                within_cooldown = True
                double_dose_detected = True
                cooldown_remaining = round(min_interval - hours_since_last_dose, 2)
        except Exception as e:
            logger.warning(f"Error parsing taken_at timestamp '{last_taken_iso}': {e}")

    latency = (time.perf_counter() - t0) * 1000.0
    detail = (
        f"Double-dose alert! {hours_since_last_dose:.1f}h since last dose (cooldown: {min_interval}h, remaining: {cooldown_remaining}h)"
        if double_dose_detected
        else (
            f"Cooldown OK: {hours_since_last_dose:.1f}h since last dose (min: {min_interval}h)"
            if hours_since_last_dose is not None
            else "No prior dose recorded on file"
        )
    )

    trace_item: Dict[str, Any] = {
        "node": "temporal_double_dose_guard_node",
        "status": "CRITICAL_FLAG" if double_dose_detected else "COMPLETED",
        "latency_ms": round(latency, 2),
        "detail": detail,
    }

    return {
        "hours_since_last_dose": round(hours_since_last_dose, 2) if hours_since_last_dose is not None else None,
        "within_cooldown_window": within_cooldown,
        "cooldown_remaining_hours": cooldown_remaining,
        "double_dose_detected": double_dose_detected,
        "last_taken_time": last_taken_iso,
        "node_trace": state.get("node_trace", []) + [trace_item],
    }


# ────────────────────────────────────────────────────────────────
# Node 4: Drug Interaction & FDA SPL Node
# ────────────────────────────────────────────────────────────────

async def drug_interaction_fda_node(state: ClinicalGraphState) -> Dict[str, Any]:
    t0 = time.perf_counter()
    scanned_rx_dict = state.get("scanned_rx") or {}
    scanned_name = scanned_rx_dict.get("canonical_name") or state.get("detected_drug_name") or ""
    patient_meds = state.get("patient_medications", [])

    citations: List[Dict[str, Any]] = []
    interactions_found: List[Dict[str, Any]] = []
    conflicting_drugs: List[str] = []

    # Reconstruct RxNormData object to pass into evaluator without re-querying
    scanned_rx_obj = RxNormData(
        query_name=scanned_rx_dict.get("query_name") or scanned_name,
        rxcui=scanned_rx_dict.get("rxcui"),
        canonical_name=scanned_rx_dict.get("canonical_name") or scanned_name,
        ingredients=scanned_rx_dict.get("ingredients") or [],
        ingredient_rxcuis=scanned_rx_dict.get("ingredient_rxcuis") or [],
        epc_classes=scanned_rx_dict.get("epc_classes") or [],
    )

    has_boxed_warning = False
    boxed_warning_text = None

    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": "CortexMed-Clinical-CDSS/1.0", "Accept": "application/json"}) as client:
        # 1. Fetch FDA label for scanned drug once
        scanned_label, _ = await get_openfda_drug_label(scanned_name, client=client)

        if scanned_label and scanned_label.boxed_warning:
            has_boxed_warning = True
            boxed_warning_text = scanned_label.boxed_warning
            citations.append({
                "source": "OpenFDA Drug Label (SPL)",
                "url": scanned_label.dailymed_url,
                "evidence_level": "high",
                "snippet": f"[{scanned_label.drug_name.upper()} BOXED WARNING]: {scanned_label.boxed_warning[:200]}...",
                "fda_set_id": scanned_label.set_id,
                "rxcui": scanned_rx_obj.rxcui,
            })

        # 2. Concurrently cross-check against all active medications
        scanned_rxcui = scanned_rx_obj.rxcui
        meds_to_check = []
        for med in patient_meds:
            med_name = med.get("drug_name") or ""
            med_rxcui = str(med.get("rxcui")).strip() if med.get("rxcui") else None

            # Skip self-comparison
            if (med_rxcui and scanned_rxcui and med_rxcui == str(scanned_rxcui).strip()) or (med_name.lower() == scanned_name.lower()):
                continue
            if med_rxcui and any(med_rxcui == str(cui).strip() for cui in scanned_rx_obj.ingredient_rxcuis):
                continue
            meds_to_check.append(med)

        if meds_to_check:
            eval_tasks = [
                evaluate_drug_pair_safety(
                    scanned_name=scanned_name,
                    active_name=med.get("drug_name") or "",
                    client=client,
                    scanned_rx_precomputed=scanned_rx_obj,
                    scanned_label_precomputed=scanned_label,
                )
                for med in meds_to_check
            ]
            results = await asyncio.gather(*eval_tasks, return_exceptions=True)

            for med, pair_result in zip(meds_to_check, results):
                if isinstance(pair_result, Exception):
                    logger.warning(f"Error evaluating interaction with {med.get('drug_name')}: {pair_result}")
                    continue
                if pair_result and pair_result.get("has_interaction"):
                    med_name = med.get("drug_name") or ""
                    interactions_found.append({
                        "conflicting_drug": med_name,
                        "matched_term": pair_result.get("matched_term"),
                    })
                    if med_name not in conflicting_drugs:
                        conflicting_drugs.append(med_name)
                    for cit in pair_result.get("citations", []):
                        citations.append(cit.model_dump() if hasattr(cit, "model_dump") else cit)

    conflicting_drug = ", ".join(conflicting_drugs) if conflicting_drugs else None
    latency = (time.perf_counter() - t0) * 1000.0
    status = "CRITICAL_FLAG" if interactions_found else ("WARNING" if has_boxed_warning else "COMPLETED")
    detail = (
        f"Severe interaction with '{conflicting_drug}'"
        if interactions_found
        else (f"FDA Boxed Warning detected" if has_boxed_warning else "No active drug interactions detected")
    )

    trace_item: Dict[str, Any] = {
        "node": "drug_interaction_fda_node",
        "status": status,
        "latency_ms": round(latency, 2),
        "detail": detail,
    }

    return {
        "interactions_found": interactions_found,
        "conflicting_drug": conflicting_drug,
        "has_boxed_warning": has_boxed_warning,
        "boxed_warning_text": boxed_warning_text,
        "citations": state.get("citations", []) + citations,
        "node_trace": state.get("node_trace", []) + [trace_item],
    }


# ────────────────────────────────────────────────────────────────
# Node 5: Clinical Verdict & Persistence Node
# ────────────────────────────────────────────────────────────────

async def clinical_verdict_and_persist_node(state: ClinicalGraphState) -> Dict[str, Any]:
    t0 = time.perf_counter()
    patient_id = state["patient_id"]
    ocr_res = state.get("ocr_result")
    drug_name = state.get("detected_drug_name") or ""
    double_dose = state.get("double_dose_detected", False)
    interactions = state.get("interactions_found", [])
    conflicting = state.get("conflicting_drug")
    has_boxed = state.get("has_boxed_warning", False)
    is_unprescribed = state.get("is_unprescribed", False)
    matched_med = state.get("matched_medication")
    hours_since = state.get("hours_since_last_dose")
    remaining_hours = state.get("cooldown_remaining_hours")

    verdict: ClinicalVerdict = "SAFE"
    alert_type: Optional[ClinicalAlertType] = None
    spoken_en = ""
    spoken_hi = ""

    # 1. Unrecognized Bottle / Failed OCR / No Valid Drug Name
    if not is_valid_drug_name(drug_name) or (ocr_res and (not ocr_res.get("is_medication_bottle") or float(ocr_res.get("ocr_confidence") or 0.0) < 0.5)):
        verdict = "CAUTION"
        alert_type = "UNRECOGNIZED_MEDICATION"
        spoken_en = "Caution: The camera could not clearly identify a medication bottle label. Please hold the label closer to the camera and ensure good lighting."
        spoken_hi = "Dhyan dein: Camera dawai ke label ko theek se nahi pehchan paya. Kripya bottle ko camera ke paas layein aur roshni mein rakhein."

    # 2. Critical Block: Double Dose
    elif double_dose:
        verdict = "CRITICAL_BLOCK"
        alert_type = "DOUBLE_DOSE"
        h_text = f"{hours_since:.1f}" if hours_since is not None else "recent"
        rem_text = f"{remaining_hours:.1f}" if remaining_hours is not None else "several"
        spoken_en = f"STOP! You already took your {drug_name} {h_text} hours ago. Please wait {rem_text} more hours before taking another dose to prevent an accidental double-dose."
        spoken_hi = f"Rukiye! Aap apni {drug_name} dawai {h_text} ghante pehle hi le chuke hain. Double-dose se bachne ke liye agli khuraak se pehle {rem_text} ghante intezaar karein."

    # 3. Critical Block: Drug Interaction
    elif interactions:
        verdict = "CRITICAL_BLOCK"
        alert_type = "DRUG_INTERACTION"
        spoken_en = f"CRITICAL SAFETY ALERT! {drug_name} has a severe interaction with your active medication {conflicting}. Do NOT take this medication without consulting your doctor."
        spoken_hi = f"Savdhaan! Yeh dawai ({drug_name}) aapki chal rahi dawai ({conflicting}) ke saath hanikarak reaction kar sakti hai. Doctor se bina pooche yeh bilkul na lein."

    # 4. Caution: FDA Boxed Warning
    elif has_boxed:
        verdict = "CAUTION"
        alert_type = "FDA_BOXED_WARNING"
        spoken_en = f"Caution: {drug_name} has an official FDA boxed safety warning on file. Please take this medication with extra care according to your prescription directions."
        spoken_hi = f"Dhyan dein: {drug_name} par FDA dwara vishesh boxed warning jaari hai. Kripya nirdharit niyam ke anusaar hi yeh khuraak lein."

    # 5. Caution: Unprescribed / Unmatched medication
    elif is_unprescribed:
        verdict = "CAUTION"
        alert_type = "UNRECOGNIZED_MEDICATION"
        spoken_en = f"Notice: {drug_name} is not found on your active prescription record. Please verify with your caregiver before taking this."
        spoken_hi = f"Suchna: {drug_name} aapke active prescription record mein darj nahi hai. Lene se pehle kripya caregiver se pushti karein."

    # 6. Safe
    else:
        verdict = "SAFE"
        alert_type = None
        spoken_en = f"{drug_name} verified. It matches your active prescription schedule and is safe to take now."
        spoken_hi = f"{drug_name} ki pushti ho gayi hai. Yeh aapke prescription ke anusaar sahi hai, aap ise le sakte hain."

    # ────────────────────────────────────────────────────────────
    # Authoritative Single DB Persistence
    # ────────────────────────────────────────────────────────────
    persisted_alert_id = None
    persisted_dosage_id = None

    citations_list = state.get("citations", [])
    clean_detected_drug = drug_name if is_valid_drug_name(drug_name) else None

    # If CAUTION or CRITICAL_BLOCK, create clinical_safety_alerts row (only for valid identified drugs, skipping placeholder calls)
    if verdict in ("CAUTION", "CRITICAL_BLOCK") and alert_type and clean_detected_drug:
        alert_record = await supabase_client.create_clinical_safety_alert({
            "patient_id": patient_id,
            "verdict": verdict,
            "alert_type": alert_type,
            "detected_drug": clean_detected_drug,
            "conflicting_drug": conflicting,
            "spoken_warning_en": spoken_en,
            "spoken_warning_hi": spoken_hi,
            "source_citations": citations_list,
            "metadata": {
                "hours_since_last_dose": hours_since,
                "cooldown_remaining_hours": remaining_hours,
                "ocr_confidence": state.get("confidence_score"),
            },
        })
        if alert_record:
            persisted_alert_id = alert_record.get("id")

    # If CRITICAL_BLOCK, log blocked dose event in dosage_logs
    if verdict == "CRITICAL_BLOCK":
        log_status: DosageLogStatus = (
            "BLOCKED_DOUBLE_DOSE" if alert_type == "DOUBLE_DOSE" else "BLOCKED_INTERACTION"
        )
        dosage_record = await supabase_client.create_dosage_log({
            "patient_id": patient_id,
            "medication_id": matched_med.get("id") if matched_med else None,
            "detected_drug_name": clean_detected_drug or "Unknown Drug",
            "status": log_status,
            "verification_source": state.get("source", "BOTTLE_OCR"),
            "confidence_score": state.get("confidence_score"),
            "notes": f"Automated CDSS Block: {alert_type} - {spoken_en}",
        })
        if dosage_record:
            persisted_dosage_id = dosage_record.get("id")

    latency = (time.perf_counter() - t0) * 1000.0
    trace_item: Dict[str, Any] = {
        "node": "clinical_verdict_and_persist_node",
        "status": "COMPLETED",
        "latency_ms": round(latency, 2),
        "detail": f"Final Verdict: {verdict} ({alert_type or 'SAFE'}). Persisted Alert: {bool(persisted_alert_id)}",
    }

    return {
        "verdict": verdict,
        "alert_type": alert_type,
        "spoken_warning_en": spoken_en,
        "spoken_warning_hi": spoken_hi,
        "persisted_alert_id": persisted_alert_id,
        "persisted_dosage_log_id": persisted_dosage_id,
        "node_trace": state.get("node_trace", []) + [trace_item],
    }


# ────────────────────────────────────────────────────────────────
# LangGraph Compilation
# ────────────────────────────────────────────────────────────────

def build_clinical_graph() -> StateGraph:
    builder = StateGraph(ClinicalGraphState)

    builder.add_node("vision_ocr_node", vision_ocr_node)
    builder.add_node("normalize_and_load_context_node", normalize_and_load_context_node)
    builder.add_node("temporal_double_dose_guard_node", temporal_double_dose_guard_node)
    builder.add_node("drug_interaction_fda_node", drug_interaction_fda_node)
    builder.add_node("clinical_verdict_and_persist_node", clinical_verdict_and_persist_node)

    # Edges
    builder.add_edge(START, "vision_ocr_node")
    builder.add_conditional_edges(
        "vision_ocr_node",
        should_continue_after_ocr,
        {
            "normalize_and_load_context_node": "normalize_and_load_context_node",
            "clinical_verdict_and_persist_node": "clinical_verdict_and_persist_node",
        },
    )
    builder.add_edge("normalize_and_load_context_node", "temporal_double_dose_guard_node")
    builder.add_edge("temporal_double_dose_guard_node", "drug_interaction_fda_node")
    builder.add_edge("drug_interaction_fda_node", "clinical_verdict_and_persist_node")
    builder.add_edge("clinical_verdict_and_persist_node", END)

    return builder.compile()


clinical_graph = build_clinical_graph()


# ────────────────────────────────────────────────────────────────
# Execution Helper
# ────────────────────────────────────────────────────────────────

async def run_bottle_verification(
    patient_id: str,
    detected_drug_name: Optional[str] = "",
    detected_strength: Optional[str] = None,
    source: VerificationSource = "BOTTLE_OCR",
    confidence_score: Optional[float] = None,
    image_base64: Optional[str] = None,
) -> BottleVerificationResponse:
    """Executes the compiled LangGraph workflow and formats the response."""
    initial_state: ClinicalGraphState = {
        "patient_id": patient_id,
        "image_base64": image_base64,
        "detected_drug_name": detected_drug_name,
        "detected_strength": detected_strength,
        "source": source,
        "confidence_score": confidence_score,
        "ocr_result": None,
        "ocr_error": None,
        "scanned_rx": None,
        "patient_medications": [],
        "matched_medication": None,
        "is_unprescribed": False,
        "hours_since_last_dose": None,
        "within_cooldown_window": False,
        "cooldown_remaining_hours": None,
        "double_dose_detected": False,
        "last_taken_time": None,
        "interactions_found": [],
        "conflicting_drug": None,
        "has_boxed_warning": False,
        "boxed_warning_text": None,
        "citations": [],
        "verdict": None,
        "alert_type": None,
        "spoken_warning_en": None,
        "spoken_warning_hi": None,
        "persisted_alert_id": None,
        "persisted_dosage_log_id": None,
        "node_trace": [],
        "error": None,
    }

    final_state = await clinical_graph.ainvoke(initial_state)

    matched_med = None
    if final_state.get("matched_medication"):
        m = final_state["matched_medication"]
        matched_med = Medication(
            id=m["id"],
            patient_id=m["patient_id"],
            drug_name=m["drug_name"],
            generic_name=m.get("generic_name"),
            rxcui=m.get("rxcui"),
            strength=m["strength"],
            dosage_instructions=m.get("dosage_instructions"),
            min_interval_hours=float(m.get("min_interval_hours") or 0.0),
            prescribed_times=m.get("prescribed_times") or [],
            is_active=m.get("is_active", True),
            created_at=m.get("created_at"),
            updated_at=m.get("updated_at"),
        )

    clean_detected = final_state.get("detected_drug_name") if is_valid_drug_name(final_state.get("detected_drug_name")) else None
    citations_models = [
        c if isinstance(c, ClinicalCitation) else ClinicalCitation(**c)
        for c in final_state.get("citations", [])
    ]
    trace_models = [
        t if isinstance(t, NodeTraceItem) else NodeTraceItem(**t)
        for t in final_state.get("node_trace", [])
    ]

    alert_obj = None
    if final_state.get("persisted_alert_id") or final_state.get("verdict") in ("CAUTION", "CRITICAL_BLOCK"):
        alert_obj = ClinicalSafetyAlert(
            id=final_state.get("persisted_alert_id"),
            patient_id=patient_id,
            verdict=final_state.get("verdict", "CAUTION"),
            alert_type=final_state.get("alert_type", "UNRECOGNIZED_MEDICATION"),
            detected_drug=clean_detected,
            conflicting_drug=final_state.get("conflicting_drug"),
            spoken_warning_en=final_state.get("spoken_warning_en"),
            spoken_warning_hi=final_state.get("spoken_warning_hi"),
            source_citations=citations_models,
            acknowledged=False,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    return BottleVerificationResponse(
        verdict=final_state.get("verdict", "CAUTION"),
        matched_medication=matched_med,
        hours_since_last_dose=final_state.get("hours_since_last_dose"),
        within_cooldown_window=final_state.get("within_cooldown_window", False),
        cooldown_remaining_hours=final_state.get("cooldown_remaining_hours"),
        alert=alert_obj,
        spoken_warning_en=final_state.get("spoken_warning_en"),
        spoken_warning_hi=final_state.get("spoken_warning_hi"),
        citations=citations_models,
        node_trace=trace_models,
        extracted_ocr=final_state.get("ocr_result"),
    )
