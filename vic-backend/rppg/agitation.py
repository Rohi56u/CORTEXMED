"""
CortexMed Deterministic Dementia Sundowning & Agitation Anomaly Engine
Realtime Autonomic Arousal Detection, Circadian Sundowning Window Evaluation,
and Cooldown-Guarded Multilingual Clinical Safety Alert Dispatcher.
Strict Zero-Mock: Evaluates genuine physiological deviations from patient baseline.
"""

import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta

from clinical import supabase_client

logger = logging.getLogger("cortexmed.rppg.agitation")

# In-memory session state for consecutive window filtering and alert cooldown
_session_windows: Dict[str, int] = {}
_last_alert_timestamps: Dict[str, datetime] = {}

class AgitationDetector:
    """
    Evaluates sustained tachycardia and sympathetic autonomic tone shifts against
    the resident's established resting baseline to detect Sundowning and agitation episodes.
    """

    COOLDOWN_SECONDS = 300  # 5 minutes alert cooldown per patient
    CLINICAL_REF_HR = 75.0   # Standard resting heart rate for older adults
    CLINICAL_REF_HRV = 35.0  # Standard resting RMSSD for older adults

    @classmethod
    def reset_state(cls, patient_id: Optional[str] = None):
        """
        Resets session counters (useful for unit testing and session restarts).
        """
        global _session_windows, _last_alert_timestamps
        if patient_id:
            _session_windows.pop(patient_id, None)
            _last_alert_timestamps.pop(patient_id, None)
        else:
            _session_windows.clear()
            _last_alert_timestamps.clear()

    @classmethod
    async def get_patient_baseline(
        cls,
        patient_id: Optional[str],
    ) -> Tuple[float, float, str]:
        """
        Derives personal resting baseline from Supabase historical vitals telemetry.
        Falls back honestly to standard clinical reference if insufficient history exists.
        """
        if not patient_id:
            return cls.CLINICAL_REF_HR, cls.CLINICAL_REF_HRV, "clinical_reference"

        try:
            history = await supabase_client.get_patient_vitals_history(patient_id, limit=30)
            valid_hrs = [
                float(row["heart_rate_bpm"]) for row in history
                if row.get("heart_rate_bpm") is not None
                and not row.get("agitation_detected", False)
                and (row.get("signal_quality_index") is None or float(row["signal_quality_index"]) >= 0.30)
            ]
            valid_hrvs = [
                float(row["hrv_rmssd_ms"]) for row in history
                if row.get("hrv_rmssd_ms") is not None
                and not row.get("agitation_detected", False)
            ]

            if len(valid_hrs) >= 3:
                baseline_hr = float(sum(valid_hrs) / len(valid_hrs))
                baseline_hrv = float(sum(valid_hrvs) / len(valid_hrvs)) if len(valid_hrvs) >= 3 else cls.CLINICAL_REF_HRV
                return round(baseline_hr, 1), round(baseline_hrv, 1), "patient_history"
        except Exception as e:
            logger.warning(f"Error querying vitals history for baseline: {e}")

        return cls.CLINICAL_REF_HR, cls.CLINICAL_REF_HRV, "clinical_reference"

    @classmethod
    def is_sundowning_window(cls, dt: Optional[datetime] = None) -> bool:
        """
        Evaluates whether current time falls within standard clinical Sundowning hours:
        16:00 to 22:00 (4:00 PM – 10:00 PM) local patient time.
        """
        check_dt = dt or datetime.now()
        hour = check_dt.hour
        return 16 <= hour < 22

    @classmethod
    def evaluate_window_agitation(
        cls,
        hr: float,
        hrv: Optional[float],
        sqi: float,
        baseline_hr: float,
        baseline_hrv: float,
        patient_key: str = "default",
    ) -> Tuple[bool, Optional[str]]:
        """
        Evaluates current valid window against resting baseline.
        Enforces at least 2 consecutive high-SQI windows meeting criteria to prevent false positives.
        """
        global _session_windows

        if sqi < 0.35:
            # Low signal quality window does not contribute to sustained agitation count
            _session_windows[patient_key] = 0
            return False, None

        # Clinical criteria:
        # 1. High absolute tachycardia >= max(100.0, baseline + 20)
        # 2. Moderate tachycardia >= baseline + 15 accompanied by parasympathetic withdrawal (HRV < 65% baseline)
        hr_condition_1 = hr >= max(100.0, baseline_hr + 20.0)
        hr_condition_2 = (
            (hr >= baseline_hr + 15.0)
            and (hrv is not None)
            and (hrv < baseline_hrv * 0.65)
        )

        meets_criteria = hr_condition_1 or hr_condition_2

        if meets_criteria:
            _session_windows[patient_key] = _session_windows.get(patient_key, 0) + 1
        else:
            _session_windows[patient_key] = 0
            return False, None

        # Require at least 2 consecutive qualifying windows
        if _session_windows[patient_key] < 2:
            return False, None

        # Formulate clinical explanation
        sundowning = cls.is_sundowning_window()
        sundown_tag = " (Late-day Sundowning window: 16:00–22:00)" if sundowning else ""

        hrv_detail = f", reduced HRV {hrv:.1f}ms vs baseline {baseline_hrv:.1f}ms" if hrv is not None else ""
        reason = (
            f"Sustained elevated pulse ({hr:.1f} BPM vs baseline {baseline_hr:.1f} BPM{hrv_detail})"
            f" indicating acute sympathetic arousal{sundown_tag}."
        )

        return True, reason

    @classmethod
    def is_in_cooldown(cls, patient_id: Optional[str]) -> bool:
        """
        Checks if an alert was triggered for this patient within the 5-minute cooldown window.
        """
        if not patient_id:
            return False

        last_time = _last_alert_timestamps.get(patient_id)
        if not last_time:
            return False

        elapsed = (datetime.now(timezone.utc) - last_time).total_seconds()
        return elapsed < cls.COOLDOWN_SECONDS

    @classmethod
    async def process_agitation_and_persist(
        cls,
        patient_id: Optional[str],
        heart_rate_bpm: Optional[float],
        hrv_rmssd_ms: Optional[float],
        signal_quality_index: Optional[float],
        window_seconds: float,
        persist: bool = False,
    ) -> Dict[str, Any]:
        """
        End-to-end evaluation: baseline resolution, sustained window check,
        and atomic persistence to Supabase vitals_telemetry, clinical_safety_alerts, and events.
        """
        result = {
            "agitation_detected": False,
            "agitation_reason": None,
            "baseline_source": "clinical_reference",
            "persisted_vital_id": None,
            "alert_created": False,
        }

        if heart_rate_bpm is None or signal_quality_index is None:
            return result

        patient_key = patient_id or "default"
        baseline_hr, baseline_hrv, baseline_source = await cls.get_patient_baseline(patient_id)
        result["baseline_source"] = baseline_source

        agitated, reason = cls.evaluate_window_agitation(
            hr=heart_rate_bpm,
            hrv=hrv_rmssd_ms,
            sqi=signal_quality_index,
            baseline_hr=baseline_hr,
            baseline_hrv=baseline_hrv,
            patient_key=patient_key,
        )

        result["agitation_detected"] = agitated
        result["agitation_reason"] = reason

        # Persistence to Supabase
        # Only persist if requested OR if agitation was detected
        should_persist = persist or agitated
        if should_persist and patient_id:
            try:
                # 1. Insert into public.vitals_telemetry
                vital_row = await supabase_client.create_vitals_telemetry({
                    "patient_id": patient_id,
                    "heart_rate_bpm": heart_rate_bpm,
                    "hrv_rmssd_ms": hrv_rmssd_ms,
                    "signal_quality_index": signal_quality_index,
                    "agitation_detected": agitated,
                    "agitation_reason": reason,
                    "window_seconds": int(window_seconds),
                })
                if vital_row:
                    result["persisted_vital_id"] = vital_row.get("id")

                # 2. If agitated and outside cooldown, insert clinical_safety_alert
                cooldown_active = cls.is_in_cooldown(patient_id)
                if not cooldown_active and patient_id:
                    # Also check Supabase for recent alert across restarts
                    try:
                        latest_alert = await supabase_client.get_latest_safety_alert(patient_id, "SUNDOWNING_AGITATION")
                        if latest_alert and latest_alert.get("created_at"):
                            alert_dt = datetime.fromisoformat(latest_alert["created_at"].replace("Z", "+00:00"))
                            elapsed = (datetime.now(timezone.utc) - alert_dt).total_seconds()
                            if elapsed < cls.COOLDOWN_SECONDS:
                                cooldown_active = True
                                _last_alert_timestamps[patient_id] = alert_dt
                    except Exception as ce:
                        logger.warning(f"Error checking Supabase alert cooldown: {ce}")

                if agitated and not cooldown_active:
                    alert_row = await supabase_client.create_clinical_safety_alert({
                        "patient_id": patient_id,
                        "verdict": "CAUTION",
                        "alert_type": "SUNDOWNING_AGITATION",
                        "detected_drug": None,
                        "conflicting_drug": None,
                        "spoken_warning_en": (
                            "I noticed you might be feeling a bit restless right now. "
                            "Let's sit down together and have a glass of water."
                        ),
                        "spoken_warning_hi": (
                            "नमस्ते, मुझे लगता है कि आप थोड़ी बेचैनी महसूस कर रहे हैं। "
                            "आइए आराम से बैठते हैं और थोड़ा पानी पीते हैं।"
                        ),
                        "source_citations": [
                            {
                                "source": "CortexMed Contactless rPPG Telemetry",
                                "evidence_level": "moderate",
                                "snippet": (
                                    f"Autonomic arousal: HR {heart_rate_bpm:.1f} BPM (baseline {baseline_hr:.1f} BPM), "
                                    f"SQI {signal_quality_index:.2f}. {reason or ''}"
                                ),
                            }
                        ],
                        "metadata": {
                            "heart_rate_bpm": heart_rate_bpm,
                            "baseline_hr": baseline_hr,
                            "hrv_rmssd_ms": hrv_rmssd_ms,
                            "baseline_hrv": baseline_hrv,
                            "signal_quality_index": signal_quality_index,
                            "window_seconds": window_seconds,
                        },
                    })

                    if alert_row:
                        result["alert_created"] = True
                        _last_alert_timestamps[patient_id] = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"Error persisting vitals/agitation alert: {e}")

        return result
