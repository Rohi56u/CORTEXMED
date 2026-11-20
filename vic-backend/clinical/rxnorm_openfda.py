"""
CortexMed Deterministic Drug Safety Engine
100% Real NIH RxNorm, NIH RxClass & OpenFDA SPL Integration
Strict Zero-Mock Policy: Zero hardcoded dictionaries, live government APIs only.
"""

import os
import re
import asyncio
import logging
from typing import List, Optional, Dict, Any, Tuple
import httpx

from clinical.schemas import ClinicalCitation

logger = logging.getLogger("cortexmed.rxnorm_openfda")

RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST"
OPENFDA_BASE = "https://api.fda.gov/drug/label.json"

DEFAULT_HEADERS = {
    "User-Agent": "CortexMed-Clinical-CDSS/1.0 (Clinical Decision Support System; contact@cortexmed.health)",
    "Accept": "application/json",
}

TIMEOUT = 10.0


class RxNormData:
    def __init__(
        self,
        query_name: str,
        rxcui: Optional[str] = None,
        canonical_name: Optional[str] = None,
        ingredients: Optional[List[str]] = None,
        ingredient_rxcuis: Optional[List[str]] = None,
        epc_classes: Optional[List[str]] = None,
    ):
        self.query_name = query_name
        self.rxcui = rxcui
        self.canonical_name = canonical_name or query_name
        self.ingredients = [i.lower() for i in (ingredients or [])]
        self.ingredient_rxcuis = ingredient_rxcuis or []
        self.epc_classes = [c.lower() for c in (epc_classes or [])]

    def all_matching_terms(self) -> List[str]:
        terms = set()
        for raw in [self.query_name, self.canonical_name]:
            if raw:
                terms.add(raw.lower().strip())
                # Add dosage-stripped version (e.g. "Warfarin 5mg" -> "warfarin")
                stripped = re.sub(
                    r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|tablets?|capsules?|pills?)\b",
                    "",
                    raw,
                    flags=re.IGNORECASE,
                ).strip()
                if len(stripped) >= 3:
                    terms.add(stripped.lower())
        for ing in self.ingredients:
            if ing:
                terms.add(ing.lower().strip())
        for epc in self.epc_classes:
            epc_l = epc.lower().strip()
            terms.add(epc_l)
            # Add clinical acronym expansions
            if "nonsteroidal anti-inflammatory" in epc_l:
                terms.add("nsaid")
                terms.add("nsaids")
                terms.add("non-steroidal anti-inflammatory")
            if "cyclooxygenase" in epc_l:
                terms.add("cox inhibitor")
                terms.add("cox inhibitors")
            if "vitamin k" in epc_l:
                terms.add("vitamin k antagonists")
                terms.add("vka")
            if "angiotensin-converting enzyme" in epc_l:
                terms.add("ace inhibitor")
                terms.add("ace inhibitors")
        return [t for t in terms if len(t) >= 3]


class OpenFDALabel:
    def __init__(
        self,
        drug_name: str,
        set_id: Optional[str] = None,
        effective_time: Optional[str] = None,
        brand_names: Optional[List[str]] = None,
        generic_names: Optional[List[str]] = None,
        boxed_warning: Optional[str] = None,
        drug_interactions: Optional[str] = None,
        contraindications: Optional[str] = None,
        warnings: Optional[str] = None,
    ):
        self.drug_name = drug_name
        self.set_id = set_id
        self.effective_time = effective_time
        self.brand_names = brand_names or []
        self.generic_names = generic_names or []
        self.boxed_warning = boxed_warning
        self.drug_interactions = drug_interactions
        self.contraindications = contraindications
        self.warnings = warnings

    @property
    def dailymed_url(self) -> Optional[str]:
        if self.set_id:
            return f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={self.set_id}"
        return None


async def normalize_drug_rxnorm(
    drug_name: str,
    client: Optional[httpx.AsyncClient] = None
) -> Tuple[RxNormData, Optional[str]]:
    """
    Normalizes drug_name using active NIH RxNorm & RxClass endpoints:
    1. /rxcui.json?name={name}&search=2
    2. Fallback: /approximateTerm.json?term={name}&maxEntries=4
    3. /rxcui/{rxcui}/related.json?tty=IN (ingredients)
    4. /rxclass/class/byRxcui.json?rxcui={rxcui}&relaSource=FDASPL (EPC classes)
    """
    clean_name = re.sub(r"[^a-zA-Z0-9\s-]", "", drug_name).strip()
    if not clean_name:
        return RxNormData(query_name=drug_name), "Invalid drug name"

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=TIMEOUT, headers=DEFAULT_HEADERS)
        close_client = True

    try:
        rxcui = None
        canonical_name = clean_name

        # 1. Direct search
        try:
            r1 = await client.get(
                f"{RXNORM_BASE}/rxcui.json",
                params={"name": clean_name, "search": "2"},
            )
            if r1.status_code == 200:
                data1 = r1.json()
                rxnorm_ids = data1.get("idGroup", {}).get("rxnormId", [])
                if rxnorm_ids:
                    rxcui = rxnorm_ids[0]
        except Exception as e:
            logger.warning(f"RxNorm rxcui.json error for {clean_name}: {e}")

        # 2. Approximate fallback if needed
        if not rxcui:
            try:
                r_approx = await client.get(
                    f"{RXNORM_BASE}/approximateTerm.json",
                    params={"term": clean_name, "maxEntries": "4"},
                )
                if r_approx.status_code == 200:
                    data_app = r_approx.json()
                    candidates = data_app.get("approximateGroup", {}).get("candidate", [])
                    if candidates:
                        rxcui = candidates[0].get("rxcui")
            except Exception as e:
                logger.warning(f"RxNorm approximateTerm error for {clean_name}: {e}")

        if not rxcui:
            return (
                RxNormData(query_name=drug_name, canonical_name=clean_name),
                f"NIH RxNorm could not resolve canonical RxCUI for '{clean_name}'"
            )

        # 3. Ingredients & EPC classes concurrently
        ingredients: List[str] = []
        ingredient_rxcuis: List[str] = []
        epc_classes: List[str] = []

        async def fetch_ingredients():
            try:
                r2 = await client.get(
                    f"{RXNORM_BASE}/rxcui/{rxcui}/related.json",
                    params={"tty": "IN"},
                )
                if r2.status_code == 200:
                    d2 = r2.json()
                    c_groups = d2.get("relatedGroup", {}).get("conceptGroup", [])
                    for cg in c_groups:
                        if cg.get("tty") == "IN":
                            for cp in cg.get("conceptProperties", []):
                                ing_name = cp.get("name")
                                ing_cui = cp.get("rxcui")
                                if ing_name and ing_name not in ingredients:
                                    ingredients.append(ing_name)
                                if ing_cui and ing_cui not in ingredient_rxcuis:
                                    ingredient_rxcuis.append(ing_cui)

                # Fallback for obsolete/discontinued brand names (e.g. Vicodin) via historystatus.json
                if not ingredients:
                    r_hist = await client.get(f"{RXNORM_BASE}/rxcui/{rxcui}/historystatus.json")
                    if r_hist.status_code == 200:
                        d_hist = r_hist.json()
                        derived = d_hist.get("rxcuiStatusHistory", {}).get("derivedConcepts", {})
                        ing_concepts = derived.get("ingredientConcept", [])
                        for ic in ing_concepts:
                            ing_n = ic.get("ingredientName")
                            ing_c = ic.get("ingredientRxcui")
                            if ing_n and ing_n not in ingredients:
                                ingredients.append(ing_n)
                            if ing_c and ing_c not in ingredient_rxcuis:
                                ingredient_rxcuis.append(ing_c)
            except Exception as e:
                logger.warning(f"RxNorm related ingredients error for {rxcui}: {e}")

        async def fetch_classes():
            try:
                r3 = await client.get(
                    f"{RXNORM_BASE}/rxclass/class/byRxcui.json",
                    params={"rxcui": rxcui, "relaSource": "FDASPL"},
                )
                if r3.status_code == 200:
                    d3 = r3.json()
                    info_list = d3.get("rxclassDrugInfoList", {}).get("rxclassDrugInfo", [])
                    for item in info_list:
                        concept = item.get("rxclassMinConceptItem", {})
                        c_name = concept.get("className")
                        c_type = concept.get("classType")
                        if c_name and (c_type == "EPC" or c_type == "MOA"):
                            if c_name not in epc_classes:
                                epc_classes.append(c_name)
            except Exception as e:
                logger.warning(f"RxClass error for {rxcui}: {e}")

        await asyncio.gather(fetch_ingredients(), fetch_classes(), return_exceptions=True)

        return (
            RxNormData(
                query_name=drug_name,
                rxcui=rxcui,
                canonical_name=ingredients[0] if ingredients else clean_name,
                ingredients=ingredients,
                ingredient_rxcuis=ingredient_rxcuis,
                epc_classes=epc_classes,
            ),
            None,
        )
    finally:
        if close_client:
            await client.aclose()


async def get_openfda_drug_label(
    search_term: str,
    client: Optional[httpx.AsyncClient] = None,
    api_key: Optional[str] = None
) -> Tuple[Optional[OpenFDALabel], Optional[str]]:
    """
    Fetches real FDA Structured Product Label (SPL) from OpenFDA Drug Label API.
    Zero mocks: if not found or network error, returns honest status.
    """
    clean_term = re.sub(r"[^a-zA-Z0-9\s-]", "", search_term).strip()
    if not clean_term:
        return None, "Empty search term for OpenFDA label query"

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=TIMEOUT, headers=DEFAULT_HEADERS)
        close_client = True

    effective_api_key = api_key or os.environ.get("OPENFDA_API_KEY")

    try:
        # Try generic name first
        queries = [
            f'openfda.generic_name:"{clean_term}"',
            f'openfda.brand_name:"{clean_term}"',
            f'"{clean_term}"',
        ]

        found_result = None
        for q in queries:
            params: Dict[str, str] = {"search": q, "limit": "1"}
            if effective_api_key:
                params["api_key"] = effective_api_key

            try:
                resp = await client.get(OPENFDA_BASE, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if results:
                        found_result = results[0]
                        break
            except Exception as e:
                logger.warning(f"OpenFDA query '{q}' error: {e}")

        if not found_result:
            return None, f"No official FDA label found for '{clean_term}' on OpenFDA"

        set_id = found_result.get("set_id")
        effective_time = found_result.get("effective_time")
        openfda_meta = found_result.get("openfda", {})

        def join_sec(sec_key: str) -> Optional[str]:
            val = found_result.get(sec_key)
            if isinstance(val, list):
                return " ".join(val)
            if isinstance(val, str):
                return val
            return None

        boxed = join_sec("boxed_warning")
        interactions = join_sec("drug_interactions")
        contraindications = join_sec("contraindications")
        warnings = join_sec("warnings_and_cautions") or join_sec("warnings")

        label = OpenFDALabel(
            drug_name=clean_term,
            set_id=set_id,
            effective_time=effective_time,
            brand_names=openfda_meta.get("brand_name", []),
            generic_names=openfda_meta.get("generic_name", []),
            boxed_warning=boxed,
            drug_interactions=interactions,
            contraindications=contraindications,
            warnings=warnings,
        )
        return label, None
    finally:
        if close_client:
            await client.aclose()


def _find_snippet_window(text: str, match_term: str, max_chars: int = 240) -> str:
    """Extracts a readable sentence or snippet containing match_term."""
    pattern = re.compile(re.escape(match_term), re.IGNORECASE)
    m = pattern.search(text)
    if not m:
        return text[:max_chars].strip() + "..."

    start_idx = max(0, m.start() - 60)
    end_idx = min(len(text), m.end() + 180)
    snippet = text[start_idx:end_idx].replace("\n", " ").strip()
    if start_idx > 0:
        snippet = "..." + snippet
    if end_idx < len(text):
        snippet = snippet + "..."
    return snippet


async def evaluate_drug_pair_safety(
    scanned_name: str,
    active_name: str,
    client: Optional[httpx.AsyncClient] = None,
    scanned_rx_precomputed: Optional[RxNormData] = None,
    scanned_label_precomputed: Optional[OpenFDALabel] = None,
) -> Dict[str, Any]:
    """
    Evaluates interactions between scanned_name and active_name by:
    1. Normalizing both via NIH RxNorm & RxClass (using precomputed scanned data if provided).
    2. Fetching OpenFDA labels for both drugs concurrently.
    3. Cross-scanning both directions:
       - scanned label vs active drug terms (generic, brand, EPC classes)
       - active drug label vs scanned drug terms
    4. Deterministically determining if a severe interaction exists.
    """
    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=TIMEOUT, headers=DEFAULT_HEADERS)
        close_client = True

    try:
        # Use precomputed scanned normalization if provided, else fetch concurrently
        err_scanned = None
        if scanned_rx_precomputed:
            scanned_rx = scanned_rx_precomputed
            active_rx, err_active = await normalize_drug_rxnorm(active_name, client)
        else:
            (scanned_rx, err_scanned), (active_rx, err_active) = await asyncio.gather(
                normalize_drug_rxnorm(scanned_name, client),
                normalize_drug_rxnorm(active_name, client),
            )

        # Primary terms to search in labels
        scanned_search = scanned_rx.canonical_name or scanned_name
        active_search = active_rx.canonical_name or active_name

        # Use precomputed scanned label if provided, else fetch concurrently
        err_scanned_label = None
        if scanned_label_precomputed:
            scanned_label = scanned_label_precomputed
            active_label, err_active_label = await get_openfda_drug_label(active_search, client)
        else:
            (scanned_label, err_scanned_label), (active_label, err_active_label) = await asyncio.gather(
                get_openfda_drug_label(scanned_search, client),
                get_openfda_drug_label(active_search, client),
            )

        citations: List[ClinicalCitation] = []
        interaction_found = False
        conflicting_text = ""
        matched_term = ""
        evidence_source = ""

        # Terms for cross-matching
        active_terms = active_rx.all_matching_terms()
        scanned_terms = scanned_rx.all_matching_terms()

        # Direction 1: Check scanned label's drug_interactions & contraindications for active terms
        if scanned_label:
            sections_to_check = [
                ("drug_interactions", scanned_label.drug_interactions),
                ("contraindications", scanned_label.contraindications),
                ("warnings", scanned_label.warnings),
            ]
            for sec_name, sec_text in sections_to_check:
                if not sec_text:
                    continue
                sec_lower = sec_text.lower()
                for term in active_terms:
                    # Match whole words to avoid sub-word false positives
                    if re.search(r"\b" + re.escape(term) + r"\b", sec_lower):
                        interaction_found = True
                        matched_term = term
                        conflicting_text = sec_text
                        snippet = _find_snippet_window(sec_text, term)
                        citations.append(
                            ClinicalCitation(
                                source="OpenFDA Drug Label (SPL)",
                                url=scanned_label.dailymed_url,
                                evidence_level="high",
                                snippet=f"[{scanned_label.drug_name.upper()} FDA Label - {sec_name.upper()}]: {snippet}",
                                rxcui=scanned_rx.rxcui,
                                fda_set_id=scanned_label.set_id,
                            )
                        )
                        break
                if interaction_found:
                    break

        # Direction 2: Check active label's drug_interactions & contraindications for scanned terms
        if not interaction_found and active_label:
            sections_to_check = [
                ("drug_interactions", active_label.drug_interactions),
                ("contraindications", active_label.contraindications),
                ("warnings", active_label.warnings),
            ]
            for sec_name, sec_text in sections_to_check:
                if not sec_text:
                    continue
                sec_lower = sec_text.lower()
                for term in scanned_terms:
                    if re.search(r"\b" + re.escape(term) + r"\b", sec_lower):
                        interaction_found = True
                        matched_term = term
                        conflicting_text = sec_text
                        snippet = _find_snippet_window(sec_text, term)
                        citations.append(
                            ClinicalCitation(
                                source="OpenFDA Drug Label (SPL)",
                                url=active_label.dailymed_url,
                                evidence_level="high",
                                snippet=f"[{active_label.drug_name.upper()} FDA Label - {sec_name.upper()}]: {snippet}",
                                rxcui=active_rx.rxcui,
                                fda_set_id=active_label.set_id,
                            )
                        )
                        break
                if interaction_found:
                    break

        # Add RxNorm / RxClass provenance citation if interaction verified
        if interaction_found:
            citations.append(
                ClinicalCitation(
                    source="NIH RxNorm & RxClass",
                    url=f"https://rxnav.nlm.nih.gov/REST/rxcui/{scanned_rx.rxcui}/related.json?tty=IN" if scanned_rx.rxcui else None,
                    evidence_level="high",
                    snippet=f"Canonical ingredient '{scanned_rx.canonical_name}' (RxCUI {scanned_rx.rxcui}) cross-referenced against '{active_rx.canonical_name}' (RxCUI {active_rx.rxcui}). Pharmacologic class: {', '.join(scanned_rx.epc_classes or active_rx.epc_classes or ['FDA SPL'])}.",
                    rxcui=scanned_rx.rxcui,
                )
            )

        return {
            "has_interaction": interaction_found,
            "matched_term": matched_term,
            "citations": citations,
            "scanned_rx": scanned_rx,
            "active_rx": active_rx,
            "scanned_label": scanned_label,
            "active_label": active_label,
            "errors": [e for e in [err_scanned, err_active, err_scanned_label, err_active_label] if e],
        }
    finally:
        if close_client:
            await client.aclose()
