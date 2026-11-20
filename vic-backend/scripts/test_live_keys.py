"""
Live Credentials Validation Script for CortexMed
Tests:
1. Live Supabase connection with Anon key and Service Role key
2. PostgREST table schema verification (patients, medications, dosage_logs, clinical_safety_alerts, events)
3. Live Gemini API key inference with gemini-3.5-flash / gemini-flash-lite-latest
4. End-to-end pill bottle OCR extraction via Google GenAI SDK
"""

import os
import sys
import io
import json
import base64
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load env from vic-backend/.env
backend_dir = Path(__file__).resolve().parent.parent
env_file = backend_dir / ".env"
load_dotenv(dotenv_path=env_file)

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import httpx

async def run_live_tests():
    print("=" * 65)
    print("  CORTEXMED LIVE CREDENTIALS VALIDATION REPORT")
    print("=" * 65)

    supabase_url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    print(f"\n1. Environment Variables Loaded:")
    print(f"   SUPABASE_URL: {supabase_url}")
    print(f"   SUPABASE_ANON_KEY: {anon_key[:15]}...{anon_key[-10:] if anon_key else ''}")
    print(f"   SUPABASE_SERVICE_ROLE_KEY: {service_key[:15]}...{service_key[-10:] if service_key else ''}")
    print(f"   GEMINI_API_KEY: {gemini_key[:10]}...{gemini_key[-6:] if gemini_key else ''}")

    # --- SUPABASE CONNECTIVITY ---
    print("\n2. Testing Supabase Connectivity:")
    async with httpx.AsyncClient(timeout=15.0) as http_client:
        # Test Root with Service Role Key
        headers_service = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }
        try:
            r_root = await http_client.get(f"{supabase_url}/rest/v1/", headers=headers_service)
            if r_root.status_code == 200:
                print(f"   [PASS] Supabase REST API Service-Role Handshake: HTTP {r_root.status_code} OK")
            else:
                print(f"   [FAIL] Supabase REST API Service-Role Handshake: HTTP {r_root.status_code} - {r_root.text[:120]}")
        except Exception as e:
            print(f"   [FAIL] Supabase REST API connection error: {e}")

        # Check tables in PostgREST schema cache
        target_tables = [
            "patients",
            "medications",
            "dosage_logs",
            "clinical_safety_alerts",
            "events",
        ]
        print("\n3. Checking Remote Supabase Schema Tables:")
        schema_status = {}
        for tbl in target_tables:
            try:
                r_tbl = await http_client.get(f"{supabase_url}/rest/v1/{tbl}?select=count", headers=headers_service)
                if r_tbl.status_code == 200:
                    schema_status[tbl] = "EXISTS"
                    print(f"   [FOUND] Table 'public.{tbl}': Active and queryable")
                elif r_tbl.status_code == 404:
                    schema_status[tbl] = "NOT_APPLIED"
                    print(f"   [PENDING] Table 'public.{tbl}': Not yet applied in remote schema cache (404 PGRST205)")
                elif r_tbl.status_code == 403:
                    schema_status[tbl] = "HTTP_403"
                    print(f"   [BLOCKED] Table 'public.{tbl}': HTTP 403 - {r_tbl.text[:100]}")
                else:
                    schema_status[tbl] = f"HTTP_{r_tbl.status_code}"
                    print(f"   [STATUS] Table 'public.{tbl}': HTTP {r_tbl.status_code} - {r_tbl.text[:100]}")
            except Exception as e:
                schema_status[tbl] = f"ERROR: {e}"
                print(f"   [ERROR] Table 'public.{tbl}': {e}")

    # --- GEMINI CONNECTIVITY & INFERENCE ---
    print("\n4. Testing Gemini API Key with google-genai SDK:")
    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        gen_res = None
        for test_model in ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-2.5-flash-lite"]:
            try:
                gen_res = client.models.generate_content(
                    model=test_model,
                    contents="State only 'GEMINI_ACTIVE_OK' for validation.",
                )
                if gen_res and gen_res.text:
                    print(f"   [PASS] Gemini Text Inference ({test_model}): '{gen_res.text.strip()}'")
                    break
            except Exception as model_err:
                continue
        if not gen_res or not gen_res.text:
            print(f"   [FAIL] Gemini Text Inference failed on all tested models.")
    except Exception as e:
        print(f"   [FAIL] Gemini Text Inference exception: {e}")

    # --- GEMINI VISION OCR TEST ---
    print("\n5. Testing Gemini Vision OCR Pipeline:")
    from clinical.ocr_vision import extract_pill_bottle_ocr
    try:
        from PIL import Image
        buf = io.BytesIO()
        img = Image.new("RGB", (64, 64), color=(255, 255, 255))
        img.save(buf, format="JPEG")
        raw_img = buf.getvalue()
    except Exception:
        raw_img = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    b64_sample = base64.b64encode(raw_img).decode("ascii")

    try:
        ocr_out = await extract_pill_bottle_ocr(b64_sample, api_key=gemini_key)
        if ocr_out.get("success"):
            print(f"   [PASS] Gemini Vision OCR extracted valid JSON structure:")
            print(f"          is_medication_bottle: {ocr_out.get('is_medication_bottle')}")
            print(f"          drug_name: '{ocr_out.get('drug_name')}'")
            print(f"          ocr_confidence: {ocr_out.get('ocr_confidence')}")
        else:
            print(f"   [NOTE] Gemini Vision OCR returned: {ocr_out.get('error')}")
    except Exception as e:
        print(f"   [FAIL] Gemini Vision OCR exception: {e}")

    print("\n" + "=" * 65)
    print("  LIVE CREDENTIALS VALIDATION COMPLETED")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_live_tests())
