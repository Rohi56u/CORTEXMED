"""
CortexMed Clinical Supabase Service Client
Authoritative single-writer helper for active medications, dosage logs, clinical alerts, and event spine.
"""

import os
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

logger = logging.getLogger("cortexmed.supabase")

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.warning("Supabase credentials missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)")
        return None

    try:
        from supabase import create_client
        _supabase_client = create_client(supabase_url, supabase_key)
        logger.info("CortexMed Supabase client initialized")
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        return None

def is_supabase_configured() -> bool:
    return bool(os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SERVICE_ROLE_KEY"))

async def get_active_medications(patient_id: str) -> List[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return []

    try:
        res = (
            client.table("medications")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("is_active", True)
            .order("drug_name")
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching active medications for patient {patient_id}: {e}")
        return []

async def get_latest_dose_log(
    patient_id: str,
    medication_id: Optional[str] = None,
    drug_name: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return None

    try:
        query = (
            client.table("dosage_logs")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("status", "TAKEN")
        )

        if medication_id:
            query = query.eq("medication_id", medication_id)
        elif drug_name:
            query = query.ilike("detected_drug_name", f"%{drug_name.strip()}%")

        query = query.order("taken_at", desc=True).limit(1)
        res = query.execute()

        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as e:
        logger.error(f"Error fetching latest dosage log for patient {patient_id}: {e}")
        return None

async def create_clinical_safety_alert(alert_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return None

    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "patient_id": alert_data["patient_id"],
            "verdict": alert_data["verdict"],
            "alert_type": alert_data["alert_type"],
            "detected_drug": alert_data.get("detected_drug"),
            "conflicting_drug": alert_data.get("conflicting_drug"),
            "spoken_warning_en": alert_data.get("spoken_warning_en"),
            "spoken_warning_hi": alert_data.get("spoken_warning_hi"),
            "source_citations": alert_data.get("source_citations", []),
            "acknowledged": alert_data.get("acknowledged", False),
            "metadata": alert_data.get("metadata", {}),
            "created_at": now_iso,
        }

        res = client.table("clinical_safety_alerts").insert(payload).execute()
        if res.data and len(res.data) > 0:
            inserted = res.data[0]
            # Synchronize to event spine so Realtime Caregiver Dashboard reflects it
            severity_map = {
                "SAFE": "GREEN",
                "CAUTION": "YELLOW",
                "CRITICAL_BLOCK": "RED",
            }
            await append_event_spine({
                "patient_id": alert_data["patient_id"],
                "type": "CLINICAL_ALERT_TRIGGERED",
                "severity": severity_map.get(alert_data["verdict"], "YELLOW"),
                "receipt_text": alert_data.get("spoken_warning_en") or f"Clinical Alert: {alert_data['alert_type']}",
                "payload": {
                    "alert_id": inserted.get("id"),
                    "verdict": alert_data["verdict"],
                    "alert_type": alert_data["alert_type"],
                    "detected_drug": alert_data.get("detected_drug"),
                    "conflicting_drug": alert_data.get("conflicting_drug"),
                },
                "source": "clinical_guard",
            })
            return inserted
        return None
    except Exception as e:
        logger.error(f"Error creating clinical safety alert: {e}")
        return None

async def create_dosage_log(log_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return None

    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "patient_id": log_data["patient_id"],
            "medication_id": log_data.get("medication_id"),
            "detected_drug_name": log_data.get("detected_drug_name"),
            "status": log_data["status"],
            "taken_at": log_data.get("taken_at", now_iso),
            "verification_source": log_data.get("verification_source", "BOTTLE_OCR"),
            "confidence_score": log_data.get("confidence_score"),
            "notes": log_data.get("notes"),
            "created_at": now_iso,
        }

        res = client.table("dosage_logs").insert(payload).execute()
        if res.data and len(res.data) > 0:
            inserted = res.data[0]
            # Also log event in event spine
            await append_event_spine({
                "patient_id": log_data["patient_id"],
                "type": "MEDICATION_LOGGED",
                "severity": "RED" if "BLOCKED" in log_data["status"] else "GREEN",
                "receipt_text": f"Dose log: {log_data.get('detected_drug_name', 'Medication')} - {log_data['status']}",
                "payload": {
                    "dosage_log_id": inserted.get("id"),
                    "status": log_data["status"],
                    "verification_source": log_data.get("verification_source"),
                },
                "source": "clinical_guard",
            })
            return inserted
        return None
    except Exception as e:
        logger.error(f"Error creating dosage log: {e}")
        return None

async def append_event_spine(event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    client = get_supabase_client()
    if not client:
        return None

    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "patient_id": event_data["patient_id"],
            "type": event_data["type"],
            "severity": event_data["severity"],
            "receipt_text": event_data.get("receipt_text"),
            "decision": event_data.get("decision", {}),
            "payload": event_data.get("payload", {}),
            "evidence": event_data.get("evidence", {}),
            "source": event_data.get("source", "clinical_guard"),
            "schema_version": 1,
            "created_at": now_iso,
        }
        res = client.table("events").insert(payload).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Error appending event to spine: {e}")
        return None

async def create_vitals_telemetry(vitals_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Persists real contactless rPPG vitals telemetry row and publishes to Event Spine.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "patient_id": vitals_data["patient_id"],
            "heart_rate_bpm": vitals_data["heart_rate_bpm"],
            "hrv_rmssd_ms": vitals_data.get("hrv_rmssd_ms"),
            "signal_quality_index": vitals_data.get("signal_quality_index"),
            "agitation_detected": vitals_data.get("agitation_detected", False),
            "agitation_reason": vitals_data.get("agitation_reason"),
            "window_seconds": vitals_data.get("window_seconds"),
            "recorded_at": vitals_data.get("recorded_at", now_iso),
        }

        res = client.table("vitals_telemetry").insert(payload).execute()
        if res.data and len(res.data) > 0:
            inserted = res.data[0]
            # Publish to Event Spine for Realtime Dashboard
            hr = vitals_data["heart_rate_bpm"]
            hrv = vitals_data.get("hrv_rmssd_ms")
            agitated = vitals_data.get("agitation_detected", False)
            hrv_str = f", HRV {hrv:.1f}ms" if hrv is not None else ""
            receipt = f"Contactless Vitals: {hr:.1f} BPM{hrv_str}"
            if agitated:
                receipt += " [AGITATION FLAGGED]"

            await append_event_spine({
                "patient_id": vitals_data["patient_id"],
                "type": "VITALS_RECORDED",
                "severity": "YELLOW" if agitated else "GREEN",
                "receipt_text": receipt,
                "payload": {
                    "vitals_id": inserted.get("id"),
                    "heart_rate_bpm": hr,
                    "hrv_rmssd_ms": hrv,
                    "signal_quality_index": vitals_data.get("signal_quality_index"),
                    "agitation_detected": agitated,
                    "agitation_reason": vitals_data.get("agitation_reason"),
                },
                "source": "clinical_guard",
            })
            return inserted
        return None
    except Exception as e:
        logger.error(f"Error persisting vitals telemetry for patient {vitals_data.get('patient_id')}: {e}")
        return None

async def get_patient_vitals_history(patient_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Retrieves historical valid vitals telemetry for establishing patient resting baseline.
    """
    client = get_supabase_client()
    if not client:
        return []

    try:
        res = (
            client.table("vitals_telemetry")
            .select("*")
            .eq("patient_id", patient_id)
            .order("recorded_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching vitals history for patient {patient_id}: {e}")
        return []

async def get_latest_safety_alert(
    patient_id: str,
    alert_type: str = "SUNDOWNING_AGITATION"
) -> Optional[Dict[str, Any]]:
    """
    Retrieves the most recent safety alert of a given type for cooldown checking.
    """
    client = get_supabase_client()
    if not client:
        return None

    try:
        res = (
            client.table("clinical_safety_alerts")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("alert_type", alert_type)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as e:
        logger.error(f"Error fetching latest {alert_type} alert for patient {patient_id}: {e}")
        return None

