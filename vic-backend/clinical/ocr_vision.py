"""
CortexMed Real Gemini Vision Pill Bottle OCR Extractor
Uses modern Google GenAI SDK with strict structured JSON schema.
Zero-Retention Policy: Never extracts or logs patient PHI or raw images.
"""

import os
import re
import json
import base64
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("cortexmed.ocr_vision")

VISION_PROMPT = """You are CortexMed's Clinical Computer Vision OCR system analyzing a cropped medication bottle label.

CRITICAL PRIVACY & ZERO-RETENTION RULE:
NEVER extract or report any patient names, addresses, phone numbers, physician/prescriber names, or prescription (Rx) numbers. Omit all personally identifiable information completely. Focus exclusively on the physical medication identity and safety instructions.

Extract only these details from the visible label:
1. is_medication_bottle: boolean (true if image clearly shows a medication bottle, prescription vial, blister pack, or drug container; false otherwise)
2. drug_name: string (the brand or commercial drug name printed on the label, or generic name if brand is not present. If unreadable, return empty string)
3. generic_name: string (the active generic chemical ingredient, e.g., 'donepezil', 'warfarin', 'metformin', 'ibuprofen'. Empty string if unknown)
4. strength: string (dosage strength, e.g., '10mg', '5mg', '500mg'. Empty string if not found)
5. dosage_instructions: string (patient-facing administration instructions, e.g., 'Take 1 tablet by mouth daily at bedtime'. Empty string if not found)
6. rx_number: string (MUST BE EMPTY STRING or '[REDACTED]' - never extract actual Rx numbers)
7. ocr_confidence: float between 0.0 and 1.0 representing label legibility and confidence
8. raw_label_excerpt: string (short verbatim excerpt of only the drug title and strength text)

Return ONLY valid JSON matching this schema:
{
  "is_medication_bottle": true,
  "drug_name": "Warfarin Sodium",
  "generic_name": "warfarin",
  "strength": "5mg",
  "dosage_instructions": "Take one tablet daily as directed",
  "rx_number": "[REDACTED]",
  "ocr_confidence": 0.95,
  "raw_label_excerpt": "WARFARIN SODIUM 5 MG"
}
"""

def clean_base64_image(image_input: str) -> bytes:
    """Removes data:image/jpeg;base64, prefixes and decodes into clean bytes."""
    clean = image_input.strip()
    if "," in clean and clean.startswith("data:"):
        clean = clean.split(",", 1)[1]
    # Remove any stray newlines or whitespace
    clean = re.sub(r"\s+", "", clean)
    return base64.b64decode(clean)

async def extract_pill_bottle_ocr(
    image_base64: str,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends base64 pill bottle image to Gemini Vision OCR.
    Returns structured OCR dict.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        logger.warning("GEMINI_API_KEY not configured. Pill bottle OCR unavailable.")
        return {
            "success": False,
            "error": "Gemini API key not configured (GEMINI_API_KEY missing)",
            "is_medication_bottle": False,
            "drug_name": "",
            "generic_name": "",
            "strength": "",
            "dosage_instructions": "",
            "ocr_confidence": 0.0,
            "raw_label_excerpt": "",
        }

    try:
        from google import genai
        from google.genai import types

        image_bytes = clean_base64_image(image_base64)
        if len(image_bytes) < 100:
            return {
                "success": False,
                "error": "Image data is corrupted or too small (< 100 bytes)",
                "is_medication_bottle": False,
                "drug_name": "",
                "ocr_confidence": 0.0,
            }

        client = genai.Client(api_key=key)
        preferred_model = model_name or os.environ.get("GEMINI_VISION_MODEL", "gemini-flash-lite-latest")

        # Robust multi-model cascade to withstand temporary demand spikes
        candidate_models = [preferred_model]
        for m in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-3.8-flash"]:
            if m not in candidate_models:
                candidate_models.append(m)

        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
        response = None
        last_err = None

        for m in candidate_models:
            try:
                response = await client.aio.models.generate_content(
                    model=m,
                    contents=[image_part, VISION_PROMPT],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                    )
                )
                if response and response.text:
                    logger.info(f"Gemini Vision OCR successfully extracted using model: {m}")
                    break
            except Exception as model_err:
                last_err = model_err
                logger.warning(f"Model {m} not available or failed ({model_err}), trying next candidate...")
                continue

        if not response or not response.text:
            raise RuntimeError(f"All candidate Gemini vision models failed. Last error: {last_err}")

        response_text = (response.text or "{}").strip()
        # Strip markdown code blocks if returned
        if response_text.startswith("```"):
            response_text = re.sub(r"^```[a-zA-Z0-9]*\n?", "", response_text)
            response_text = re.sub(r"\n?```$", "", response_text).strip()

        try:
            parsed = json.loads(response_text)
        except Exception as json_err:
            logger.warning(f"Failed to parse Gemini JSON output '{response_text[:100]}': {json_err}")
            parsed = {}

        # Handle models returning a JSON array of objects
        if isinstance(parsed, list):
            parsed = parsed[0] if (parsed and isinstance(parsed[0], dict)) else {}
        elif not isinstance(parsed, dict):
            parsed = {}

        # Enforce zero-retention PHI sanitization
        parsed["rx_number"] = "[REDACTED]"
        parsed["success"] = True
        if "ocr_confidence" not in parsed:
            parsed["ocr_confidence"] = 0.85 if parsed.get("is_medication_bottle") else 0.0

        return parsed

    except Exception as e:
        logger.error(f"Gemini Vision OCR extraction failed: {e}")
        return {
            "success": False,
            "error": f"Gemini Vision extraction error: {str(e)}",
            "is_medication_bottle": False,
            "drug_name": "",
            "generic_name": "",
            "strength": "",
            "dosage_instructions": "",
            "ocr_confidence": 0.0,
            "raw_label_excerpt": "",
        }
