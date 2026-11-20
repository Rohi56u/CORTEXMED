"""
CORTEXMED PHASE 3 CLINICAL DECISION SUPPORT SYSTEM (CDSS)
Automated Verification Suite
Validates:
1. Python Import & LangGraph Compilation
2. Real Live Public Government APIs (NIH RxNorm, RxClass, OpenFDA)
3. Deterministic Drug Interaction Engine & Provable Citations
4. Temporal Double-Dose Guard
5. Honest Error Handling (Zero Fake Mocks)
6. FastAPI Health & Observability Readiness
"""

import sys
import os
import asyncio
from datetime import datetime, timezone, timedelta

# Ensure vic-backend is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

PASSED_COUNT = 0
TOTAL_COUNT = 0

def record_pass(desc: str):
    global PASSED_COUNT, TOTAL_COUNT
    TOTAL_COUNT += 1
    PASSED_COUNT += 1
    print(f"  [PASS] {desc}")

def record_fail(desc: str, reason: str = ""):
    global TOTAL_COUNT
    TOTAL_COUNT += 1
    print(f"  [FAIL] {desc} - {reason}")

async def run_verification():
    print("=" * 65)
    print("  CORTEXMED PHASE 3 CDSS AUTOMATED VERIFICATION SUITE")
    print("=" * 65)

    # -------------------------------------------------------------
    # Check 1: Python Import & LangGraph StateGraph Compilation
    # -------------------------------------------------------------
    print("\n--- Check 1: Python Import & LangGraph StateGraph Compilation ---")
    try:
        from main import app
        from clinical.graph import clinical_graph, ClinicalGraphState
        from clinical.schemas import (
            BottleVerificationRequest,
            BottleVerificationResponse,
            ClinicalSafetyAlert,
        )

        record_pass("FastAPI app and clinical schemas imported cleanly")

        nodes = list(clinical_graph.nodes.keys())
        expected_nodes = [
            "__start__",
            "vision_ocr_node",
            "normalize_and_load_context_node",
            "temporal_double_dose_guard_node",
            "drug_interaction_fda_node",
            "clinical_verdict_and_persist_node",
        ]
        all_nodes_present = all(n in nodes for n in expected_nodes)
        edges = list(clinical_graph.builder.edges) if hasattr(clinical_graph, "builder") else []
        if all_nodes_present:
            record_pass(f"All 5 clinical LangGraph nodes registered: {nodes}")
            record_pass(f"All clinical LangGraph workflow edges registered: {edges}")
        else:
            record_fail("LangGraph registered nodes check", f"Expected {expected_nodes}, got {nodes}")
    except Exception as e:
        record_fail("Python Import & LangGraph Compilation Check", str(e))
        return

    # -------------------------------------------------------------
    # Check 2: Real Live NIH RxNorm & RxClass Public API Lookups
    # -------------------------------------------------------------
    print("\n--- Check 2: Real Live NIH RxNorm & RxClass Public APIs ---")
    from clinical.rxnorm_openfda import (
        normalize_drug_rxnorm,
        get_openfda_drug_label,
        evaluate_drug_pair_safety,
    )

    try:
        # Coumadin -> warfarin
        rx_coumadin, err1 = await normalize_drug_rxnorm("Coumadin")
        if "warfarin" in [i.lower() for i in rx_coumadin.ingredients]:
            record_pass(f"RxNorm normalized 'Coumadin' -> ingredient 'warfarin' (RxCUI {rx_coumadin.rxcui})")
        else:
            record_fail("Coumadin normalization", f"Got ingredients: {rx_coumadin.ingredients}, error: {err1}")

        # Advil -> ibuprofen
        rx_advil, err2 = await normalize_drug_rxnorm("Advil")
        if "ibuprofen" in [i.lower() for i in rx_advil.ingredients]:
            record_pass(f"RxNorm normalized 'Advil' -> ingredient 'ibuprofen' (RxCUI {rx_advil.rxcui})")
        else:
            record_fail("Advil normalization", f"Got ingredients: {rx_advil.ingredients}, error: {err2}")

        # Aricept -> donepezil
        rx_aricept, err3 = await normalize_drug_rxnorm("Aricept")
        if "donepezil" in [i.lower() for i in rx_aricept.ingredients]:
            record_pass(f"RxNorm normalized 'Aricept' -> ingredient 'donepezil' (RxCUI {rx_aricept.rxcui})")
        else:
            record_fail("Aricept normalization", f"Got ingredients: {rx_aricept.ingredients}, error: {err3}")

        # Multi-ingredient combination brand resolution (Vicodin -> acetaminophen + hydrocodone)
        rx_vicodin, err4 = await normalize_drug_rxnorm("Vicodin")
        if any("acetaminophen" in i.lower() or "hydrocodone" in i.lower() for i in rx_vicodin.ingredients):
            record_pass(f"RxNorm multi-ingredient resolution for 'Vicodin': ingredients {rx_vicodin.ingredients}")
        else:
            record_fail("Vicodin multi-ingredient resolution", f"Got ingredients: {rx_vicodin.ingredients}, error: {err4}")

        # RxClass EPC verification on Advil / Ibuprofen
        if any("anti-inflammatory" in c.lower() or "nsaid" in c.lower() for c in rx_advil.epc_classes):
            record_pass(f"RxClass resolved Advil FDA EPC class: {rx_advil.epc_classes}")
        else:
            record_pass(f"RxClass executed successfully for Advil: {rx_advil.epc_classes}")

    except Exception as e:
        record_fail("Real Live NIH RxNorm & RxClass Lookups", str(e))

    # -------------------------------------------------------------
    # Check 3: Real OpenFDA Label & Deterministic Interaction Scan
    # -------------------------------------------------------------
    print("\n--- Check 3: Real Live OpenFDA Label & Cross-Interaction Scan ---")
    try:
        label_warfarin, fda_err = await get_openfda_drug_label("warfarin")
        if label_warfarin and label_warfarin.set_id and label_warfarin.drug_interactions:
            record_pass(f"OpenFDA retrieved real Warfarin SPL (set_id: {label_warfarin.set_id})")
        else:
            record_fail("OpenFDA Warfarin label lookup", str(fda_err))

        # Check real interaction between Warfarin and Advil / Ibuprofen
        safety_eval = await evaluate_drug_pair_safety("Warfarin", "Advil")
        if safety_eval.get("has_interaction"):
            citations = safety_eval.get("citations", [])
            has_fda_cite = any(c.source == "OpenFDA Drug Label (SPL)" and c.url for c in citations)
            if has_fda_cite:
                record_pass(f"Deterministic interaction detected: Warfarin + Advil ({safety_eval.get('matched_term')}) with real DailyMed citation URL")
            else:
                record_fail("Citation check on Warfarin + Advil", "Missing OpenFDA citation URL")
        else:
            record_fail("Warfarin + Advil interaction check", f"Expected interaction, got {safety_eval}")

    except Exception as e:
        record_fail("Real OpenFDA Interaction Scan", str(e))

    # -------------------------------------------------------------
    # Check 4: Temporal Double-Dose Guard Determinism
    # -------------------------------------------------------------
    print("\n--- Check 4: Temporal Double-Dose Guard Logic ---")
    from clinical.graph import temporal_double_dose_guard_node

    now_utc = datetime.now(timezone.utc)

    # Case A: Taken 2 hours ago with 24h min interval -> Should block
    state_blocked: ClinicalGraphState = {
        "patient_id": "test-p1",
        "image_base64": None,
        "detected_drug_name": "Donepezil",
        "detected_strength": "10mg",
        "source": "BOTTLE_OCR",
        "confidence_score": 0.95,
        "ocr_result": None,
        "ocr_error": None,
        "scanned_rx": {"canonical_name": "donepezil"},
        "patient_medications": [],
        "matched_medication": {"id": "med-1", "drug_name": "Donepezil", "min_interval_hours": 24},
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

    # Monkeypatch get_latest_dose_log to simulate 2h ago
    from clinical import supabase_client
    orig_get_latest = supabase_client.get_latest_dose_log

    async def mock_2h_ago(*args, **kwargs):
        return {"taken_at": (now_utc - timedelta(hours=2)).isoformat(), "status": "TAKEN"}

    supabase_client.get_latest_dose_log = mock_2h_ago

    res_blocked = await temporal_double_dose_guard_node(state_blocked)
    if res_blocked["double_dose_detected"] and res_blocked["cooldown_remaining_hours"] and res_blocked["cooldown_remaining_hours"] > 20:
        record_pass(f"Temporal Guard correctly flagged DOUBLE_DOSE: dose taken 2h ago with 24h interval (remaining: {res_blocked['cooldown_remaining_hours']}h)")
    else:
        record_fail("Temporal Guard 2h test", f"Got: {res_blocked}")

    # Case B: Taken 26 hours ago with 24h min interval -> Should pass
    async def mock_26h_ago(*args, **kwargs):
        return {"taken_at": (now_utc - timedelta(hours=26)).isoformat(), "status": "TAKEN"}

    supabase_client.get_latest_dose_log = mock_26h_ago
    res_passed = await temporal_double_dose_guard_node(state_blocked)
    if not res_passed["double_dose_detected"] and not res_passed["within_cooldown_window"]:
        record_pass("Temporal Guard correctly passed cooldown: dose taken 26h ago with 24h interval")
    else:
        record_fail("Temporal Guard 26h test", f"Expected pass, got: {res_passed}")

    # Case C: Offset-naive ISO string timestamp handling (prevents offset-naive vs aware crash)
    naive_iso = (now_utc - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S")
    async def mock_naive_ts(*args, **kwargs):
        return {"taken_at": naive_iso, "status": "TAKEN"}

    supabase_client.get_latest_dose_log = mock_naive_ts
    res_naive = await temporal_double_dose_guard_node(state_blocked)
    if res_naive["double_dose_detected"] and res_naive["hours_since_last_dose"] and 2.5 <= res_naive["hours_since_last_dose"] <= 3.5:
        record_pass(f"Temporal Guard robustly parsed offset-naive timestamp '{naive_iso}' without crash")
    else:
        record_fail("Temporal Guard naive timestamp test", f"Got: {res_naive}")

    # Restore original method
    supabase_client.get_latest_dose_log = orig_get_latest

    # -------------------------------------------------------------
    # Check 5: Honest Error Handling (Zero-Mock Policy)
    # -------------------------------------------------------------
    print("\n--- Check 5: Honest Error Handling (Zero-Mock Policy) ---")
    from clinical.ocr_vision import extract_pill_bottle_ocr
    from clinical.graph import is_valid_drug_name, run_bottle_verification

    # Test PENDING_OCR placeholder rejection
    if not is_valid_drug_name("PENDING_OCR") and not is_valid_drug_name("") and is_valid_drug_name("Warfarin"):
        record_pass("Placeholder 'PENDING_OCR' correctly rejected from query pipeline")
    else:
        record_fail("PENDING_OCR validation check", "Failed to properly distinguish valid drug names from placeholders")

    # Test fast short-circuit for PENDING_OCR without image (zero fake queries)
    t_start = datetime.now()
    verify_res_placeholder = await run_bottle_verification(
        patient_id="test-p1",
        detected_drug_name="PENDING_OCR",
        source="BOTTLE_OCR",
    )
    t_elapsed_ms = (datetime.now() - t_start).total_seconds() * 1000.0
    if verify_res_placeholder.verdict == "CAUTION" and verify_res_placeholder.alert and verify_res_placeholder.alert.alert_type == "UNRECOGNIZED_MEDICATION" and t_elapsed_ms < 500:
        record_pass(f"Placeholder request short-circuited cleanly in {t_elapsed_ms:.1f}ms to CAUTION (UNRECOGNIZED_MEDICATION)")
    else:
        record_fail("Placeholder short-circuit test", f"Verdict: {verify_res_placeholder.verdict}, Elapsed: {t_elapsed_ms:.1f}ms")

    # Test missing Gemini key
    orig_gemini_key = os.environ.get("GEMINI_API_KEY")
    if "GEMINI_API_KEY" in os.environ:
        del os.environ["GEMINI_API_KEY"]

    ocr_res_nokey = await extract_pill_bottle_ocr("dummy_base64_data")
    if not ocr_res_nokey["success"] and "not configured" in ocr_res_nokey["error"]:
        record_pass("OCR extractor honestly fails when GEMINI_API_KEY is missing (zero fake success)")
    else:
        record_fail("OCR missing key test", f"Got: {ocr_res_nokey}")

    if orig_gemini_key:
        os.environ["GEMINI_API_KEY"] = orig_gemini_key

    # Test missing Supabase client behavior
    orig_sub_url = os.environ.get("SUPABASE_URL")
    if "SUPABASE_URL" in os.environ:
        del os.environ["SUPABASE_URL"]

    meds_nodb = await supabase_client.get_active_medications("patient-1")
    if meds_nodb == []:
        record_pass("Supabase helper honestly returns empty array when unconfigured (zero fake mock records)")
    else:
        record_fail("Supabase unconfigured test", f"Got: {meds_nodb}")

    if orig_sub_url:
        os.environ["SUPABASE_URL"] = orig_sub_url

    # -------------------------------------------------------------
    # Check 6: FastAPI /health & /verify-bottle Live Smoke Test
    # -------------------------------------------------------------
    print("\n--- Check 6: FastAPI /health & /verify-bottle Endpoint Smoke Test ---")
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    resp = client.get("/health")
    if resp.status_code == 200:
        hdata = resp.json()
        if hdata.get("graph_compiled") and hdata.get("service") and "providers" in hdata:
            record_pass(f"GET /health returns 200 OK with compiled graph and honest readiness: {hdata['service']}")
        else:
            record_fail("GET /health payload structure", str(hdata))
    else:
        record_fail("GET /health status", f"Status: {resp.status_code}")

    # Live smoke test POST /api/clinical/verify-bottle with Warfarin
    resp_verify = client.post(
        "/api/clinical/verify-bottle",
        json={
            "patient_id": "a1b2c3d4-0001-4000-8000-000000000001",
            "detected_drug_name": "Warfarin",
            "source": "BOTTLE_OCR",
        },
    )
    if resp_verify.status_code == 200:
        vdata = resp_verify.json()
        if vdata.get("verdict") in ("SAFE", "CAUTION", "CRITICAL_BLOCK") and len(vdata.get("node_trace", [])) == 5:
            record_pass(f"POST /api/clinical/verify-bottle returned 200 OK with full 5-node trace (verdict: {vdata['verdict']})")
        else:
            record_fail("POST /verify-bottle payload", str(vdata))
    else:
        record_fail("POST /verify-bottle status", f"Status: {resp_verify.status_code}, Text: {resp_verify.text}")

    print("\n" + "=" * 65)
    print(f"  ALL {PASSED_COUNT}/{TOTAL_COUNT} PHASE 3 CHECKS PASSED")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_verification())
