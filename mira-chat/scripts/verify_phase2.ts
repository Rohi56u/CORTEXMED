// CortexMed Phase 2 Verification Test Suite
// Executes comprehensive deep verification for Clinical Database, PII Middleware & MCP Tool Layer

import { redactPii, redactChatMessages, rehydratePii, PiiContext } from "../lib/pii";
import { CORTEXMED_MCP_TOOLS, executeMcpTool } from "../lib/tools/mcp-health";
import {
  parseMedicationInput,
  parseDosageLogInput,
  parseVitalsTelemetryInput,
  parseClinicalSafetyAlertInput,
  parseBottleVerificationRequestInput,
  parseSpatialMemoryObjectInput,
} from "../lib/contracts";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string, details?: Record<string, unknown>) {
  if (!condition) {
    const err = new Error(`Assertion failed: ${message}`);
    results.push({ name: message, passed: false, error: err.message, details });
    console.error(`❌ FAIL: ${message}`, details ?? "");
    throw err;
  } else {
    results.push({ name: message, passed: true, details });
    console.log(`✅ PASS: ${message}`);
  }
}

export async function runAllTests() {
  console.log("===============================================================");
  console.log("  CORTEXMED PHASE 2 CLINICAL SYSTEM VERIFICATION SUITE");
  console.log("===============================================================\n");

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: PII Redaction & Clinical Safeguard Engine
  // ─────────────────────────────────────────────────────────────
  console.log("--- Suite 1: PII Redaction & Clinical Safeguard Engine ---");

  const piiContext: PiiContext = {
    patientName: "Margaret Chen",
    caregiverName: "David Chen",
    names: ["Margaret Chen", "David Chen", "Margaret", "David", "Chen"],
  };

  // Test 1.1: Name Redaction (Patient & Caregiver)
  const input1 = "Please call Margaret Chen or David Chen regarding her prescription.";
  const res1 = redactPii(input1, piiContext);
  assert(
    !res1.redactedText.includes("Margaret Chen") && !res1.redactedText.includes("David Chen"),
    "Redacts patient and caregiver full names",
    { redacted: res1.redactedText }
  );
  assert(
    res1.redactedText.includes("[NAME_1]") && res1.redactedText.includes("[NAME_2]"),
    "Generates indexed tokens for distinct names",
    { tokens: Object.keys(res1.tokenMap) }
  );

  // Test 1.2: Rehydration Accuracy
  const rehydrated1 = rehydratePii(res1.redactedText, res1.tokenMap);
  assert(
    rehydrated1 === input1,
    "Rehydrates tokens back to original text with 100% fidelity",
    { expected: input1, actual: rehydrated1 }
  );

  // Test 1.3: US & Indian Phone Number Redaction
  const phoneInput = "Caregiver US phone is +1 (555) 234-5678 and India emergency line is +91 98765 43210.";
  const phoneRes = redactPii(phoneInput);
  assert(
    !phoneRes.redactedText.includes("555") && !phoneRes.redactedText.includes("98765"),
    "Redacts both US and Indian phone numbers",
    { redacted: phoneRes.redactedText }
  );
  assert(
    phoneRes.summary.categoriesRedacted.includes("PHONE"),
    "Summary categorizes phone numbers correctly",
    { summary: phoneRes.summary }
  );
  assert(
    rehydratePii(phoneRes.redactedText, phoneRes.tokenMap) === phoneInput,
    "Accurately rehydrates phone numbers",
    { original: phoneInput }
  );

  // Test 1.4: Email, DOB, SSN, and Street Address Redaction
  const sensitiveInput =
    "Contact david.chen@hospital.org. Resident DOB: 12/04/1945, SSN: 123-45-6789, address: 742 Evergreen Terrace, Apt 4B.";
  const sensitiveRes = redactPii(sensitiveInput);
  assert(!sensitiveRes.redactedText.includes("david.chen@hospital.org"), "Redacts email addresses");
  assert(!sensitiveRes.redactedText.includes("12/04/1945"), "Redacts dates of birth");
  assert(!sensitiveRes.redactedText.includes("123-45-6789"), "Redacts SSN patterns");
  assert(!sensitiveRes.redactedText.includes("Evergreen Terrace"), "Redacts street addresses");
  assert(
    rehydratePii(sensitiveRes.redactedText, sensitiveRes.tokenMap) === sensitiveInput,
    "Rehydrates multi-entity sensitive records accurately"
  );

  // Test 1.5: Zero Raw PII Leaked in Summary
  for (const cat of sensitiveRes.summary.categoriesRedacted) {
    assert(
      typeof cat === "string" && !cat.includes("@") && !cat.includes("12/04"),
      "Redaction summary contains zero raw PII values",
      { summary: sensitiveRes.summary }
    );
  }

  // Test 1.6: STRICT CLINICAL PRESERVATION (Zero Mangling of Drugs, Dosages & Timestamps)
  const clinicalInput =
    "Administer Donepezil 10mg orally at 21:00. Resident took Warfarin 5mg daily and Metformin 500mg with food. Heart rate 72 bpm, blood pressure 120/80 mmHg.";
  const clinicalRes = redactPii(clinicalInput, piiContext);
  assert(
    clinicalRes.redactedText.includes("Donepezil 10mg"),
    "Preserves 'Donepezil 10mg' untouched without mangling"
  );
  assert(
    clinicalRes.redactedText.includes("Warfarin 5mg"),
    "Preserves 'Warfarin 5mg' untouched without mangling"
  );
  assert(
    clinicalRes.redactedText.includes("Metformin 500mg"),
    "Preserves 'Metformin 500mg' untouched without mangling"
  );
  assert(
    clinicalRes.redactedText.includes("21:00"),
    "Preserves schedule timestamps (21:00) untouched"
  );
  assert(
    clinicalRes.redactedText.includes("72 bpm") && clinicalRes.redactedText.includes("120/80 mmHg"),
    "Preserves physiological units (bpm, mmHg) untouched"
  );

  // Test 1.7: Consistent Cross-Message Token Mapping in redactChatMessages
  const chatMessages = [
    { role: "system", content: "You are assisting resident Margaret Chen." },
    { role: "user", content: "Margaret Chen took her pill. Please call David Chen." },
  ];
  const redactedChat = redactChatMessages(chatMessages, piiContext);
  const sysToken = redactedChat.messages[0].content.match(/\[NAME_\d+\]/)?.[0];
  const userToken = redactedChat.messages[1].content.match(/\[NAME_\d+\]/)?.[0];
  assert(
    sysToken !== undefined && sysToken === userToken,
    "Maintains identical token mapping for same entity across multiple turns",
    { sysToken, userToken }
  );

  // Test 1.8: ISO 8601 & European DOB Format Redaction
  const isoDobInput = "Resident DOB: 1945-12-04 and sibling born on 25/08/1950.";
  const isoDobRes = redactPii(isoDobInput);
  assert(
    !isoDobRes.redactedText.includes("1945-12-04") && !isoDobRes.redactedText.includes("25/08/1950"),
    "Redacts ISO 8601 (YYYY-MM-DD) and European (DD/MM/YYYY) DOBs",
    { redacted: isoDobRes.redactedText }
  );
  assert(
    rehydratePii(isoDobRes.redactedText, isoDobRes.tokenMap) === isoDobInput,
    "Accurately rehydrates ISO and European DOB formats"
  );

  // Test 1.9: Multi-Hyphen Indian Phone Numbers
  const indianPhoneInput = "Contact Delhi specialist at +91-987-654-3210 immediately.";
  const indianPhoneRes = redactPii(indianPhoneInput);
  assert(
    !indianPhoneRes.redactedText.includes("987-654-3210") && !indianPhoneRes.redactedText.includes("+91"),
    "Redacts multi-hyphen Indian phone (+91-987-654-3210) completely without orphan prefix",
    { redacted: indianPhoneRes.redactedText }
  );
  assert(
    rehydratePii(indianPhoneRes.redactedText, indianPhoneRes.tokenMap) === indianPhoneInput,
    "Accurately rehydrates multi-hyphen Indian phone"
  );

  // Test 1.10: Street Address Non-Greedy Guard (Dosages & Actions Preserved)
  const nonGreedyAddressInput = "Took 10 pills and walked to Elm Street for lunch at 12:00.";
  const nonGreedyRes = redactPii(nonGreedyAddressInput);
  assert(
    nonGreedyRes.redactedText.includes("Took 10 pills") && nonGreedyRes.redactedText.includes("12:00"),
    "Does NOT falsely swallow dosages (10 pills) or times into street address tokens",
    { redacted: nonGreedyRes.redactedText }
  );

  // Test 1.11: Rehydration Safe from Dollar Sign & Regex Pattern Corruption
  const dollarInput = "Resident paid $100 copay at pharmacy. Reference: $1 test.";
  const dollarRes = redactPii(dollarInput, { patientName: "Resident" });
  const dollarRehydrated = rehydratePii(dollarRes.redactedText, dollarRes.tokenMap);
  assert(
    dollarRehydrated === dollarInput,
    "Safely rehydrates text with $ dollar signs without replacement string corruption",
    { expected: dollarInput, actual: dollarRehydrated }
  );

  // Test 1.12: MRN Original Prefix & Phrasing Preservation
  const mrnInput = "Medical Record Number: 98765-AB filed in system.";
  const mrnRes = redactPii(mrnInput);
  assert(!mrnRes.redactedText.includes("98765-AB"), "Redacts MRN identifier");
  const mrnRehydrated = rehydratePii(mrnRes.redactedText, mrnRes.tokenMap);
  assert(
    mrnRehydrated === mrnInput,
    "Preserves exact original MRN phrasing upon rehydration",
    { expected: mrnInput, actual: mrnRehydrated }
  );

  console.log("\n--- Suite 2: MCP Clinical Tool Layer & Schema Validation ---");

  // Test 2.1: Tool Registry Count & Schema Completeness
  assert(
    CORTEXMED_MCP_TOOLS.length === 6,
    "CORTEXMED_MCP_TOOLS exposes exactly 6 clinical tools",
    { count: CORTEXMED_MCP_TOOLS.length }
  );

  const expectedToolNames = [
    "get_active_medications",
    "check_last_dose",
    "log_medication_event",
    "get_latest_vitals",
    "query_spatial_object",
    "create_clinical_alert",
  ];
  for (const name of expectedToolNames) {
    const tool = CORTEXMED_MCP_TOOLS.find((t) => t.name === name);
    assert(Boolean(tool), `Tool '${name}' exists in registry`);
    assert(
      Boolean(tool?.description && tool?.parameters?.properties),
      `Tool '${name}' has compliant description and parameter schemas`
    );
  }

  // Test 2.2: Input Validation Failures
  const badMedRes = await executeMcpTool("get_active_medications", {});
  assert(
    !badMedRes.ok && badMedRes.code === "VALIDATION_ERROR",
    "get_active_medications rejects missing patient_id cleanly",
    { result: badMedRes }
  );

  const badLastDoseRes = await executeMcpTool("check_last_dose", { patient_id: "p1" });
  assert(
    !badLastDoseRes.ok && badLastDoseRes.code === "VALIDATION_ERROR",
    "check_last_dose rejects call without medication_id or drug_name",
    { result: badLastDoseRes }
  );

  const badStatusRes = await executeMcpTool("log_medication_event", {
    patient_id: "p1",
    status: "FAKE_STATUS",
    verification_source: "BOTTLE_OCR",
  });
  assert(
    !badStatusRes.ok && badStatusRes.code === "VALIDATION_ERROR",
    "log_medication_event rejects invalid status value",
    { result: badStatusRes }
  );

  const badAlertRes = await executeMcpTool("create_clinical_alert", {
    patient_id: "p1",
    verdict: "INVALID_VERDICT",
    alert_type: "DOUBLE_DOSE",
  });
  assert(
    !badAlertRes.ok && badAlertRes.code === "VALIDATION_ERROR",
    "create_clinical_alert rejects invalid clinical verdict",
    { result: badAlertRes }
  );

  const unknownToolRes = await executeMcpTool("unrecognized_tool_xyz", {});
  assert(
    !unknownToolRes.ok && unknownToolRes.code === "UNKNOWN_TOOL",
    "executeMcpTool rejects unrecognized tool names cleanly",
    { result: unknownToolRes }
  );

  // Test 2.3: Honest Failure Contract When Supabase Credentials Missing (Zero Mocks)
  // Ensure that without DB env vars, the tool returns DATABASE_UNCONFIGURED and NEVER returns fake rows
  const origUrl = process.env.SUPABASE_URL;
  const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const unconfiguredRes = await executeMcpTool("get_active_medications", {
    patient_id: "a1b2c3d4-0001-4000-8000-000000000001",
  });
  assert(
    !unconfiguredRes.ok && unconfiguredRes.code === "DATABASE_UNCONFIGURED",
    "Honest error returned when Supabase is unconfigured (Zero fake/mock rows returned)",
    { result: unconfiguredRes }
  );

  // Restore env if any
  if (origUrl) process.env.SUPABASE_URL = origUrl;
  if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;

  // ─────────────────────────────────────────────────────────────
  // SUITE 3: Runtime Input Validators
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Suite 3: Runtime Input Schema Parsers ---");

  const validMed = parseMedicationInput({
    patient_id: "p-123",
    drug_name: "Donepezil",
    strength: "10mg",
    min_interval_hours: 24,
    prescribed_times: ["21:00"],
  });
  assert(
    validMed.drug_name === "Donepezil" && validMed.min_interval_hours === 24,
    "parseMedicationInput parses valid medication structure",
    { validMed }
  );

  let caughtMedError = false;
  try {
    parseMedicationInput({ patient_id: "p-123", drug_name: "" });
  } catch {
    caughtMedError = true;
  }
  assert(caughtMedError, "parseMedicationInput throws on empty drug_name");

  const validVitals = parseVitalsTelemetryInput({
    patient_id: "p-123",
    heart_rate_bpm: 78,
    signal_quality_index: 0.95,
  });
  assert(
    validVitals.heart_rate_bpm === 78 && validVitals.signal_quality_index === 0.95,
    "parseVitalsTelemetryInput validates heart rate and SQI",
    { validVitals }
  );

  let caughtVitalsError = false;
  try {
    parseVitalsTelemetryInput({ patient_id: "p-123", heart_rate_bpm: 500 });
  } catch {
    caughtVitalsError = true;
  }
  assert(caughtVitalsError, "parseVitalsTelemetryInput rejects implausible heart rate (500 bpm)");

  const validAlert = parseClinicalSafetyAlertInput({
    patient_id: "p-123",
    verdict: "CRITICAL_BLOCK",
    alert_type: "DOUBLE_DOSE",
    detected_drug: "Warfarin",
  });
  assert(
    validAlert.verdict === "CRITICAL_BLOCK" && validAlert.alert_type === "DOUBLE_DOSE",
    "parseClinicalSafetyAlertInput validates critical alerts",
    { validAlert }
  );

  // Test 3.6: parseBottleVerificationRequestInput
  const validBottle = parseBottleVerificationRequestInput({
    patient_id: "p-123",
    detected_drug_name: "Donepezil",
    detected_strength: "10mg",
    source: "BOTTLE_OCR",
  });
  assert(
    validBottle.detected_drug_name === "Donepezil" && validBottle.source === "BOTTLE_OCR",
    "parseBottleVerificationRequestInput validates bottle verification requests",
    { validBottle }
  );

  let caughtBottleError = false;
  try {
    parseBottleVerificationRequestInput({ patient_id: "p-123", detected_drug_name: "Donepezil", source: "INVALID_SOURCE" });
  } catch {
    caughtBottleError = true;
  }
  assert(caughtBottleError, "parseBottleVerificationRequestInput throws on invalid verification source");

  // Test 3.7: parseSpatialMemoryObjectInput
  const validSpatial = parseSpatialMemoryObjectInput({
    patient_id: "p-123",
    object_label: "reading glasses",
    room_zone: "bedroom",
    location_description: "nightstand next to lamp",
  });
  assert(
    validSpatial.object_label === "reading glasses" && validSpatial.room_zone === "bedroom",
    "parseSpatialMemoryObjectInput validates spatial memory objects",
    { validSpatial }
  );

  console.log("\n===============================================================");
  console.log(`  ALL ${results.length} VERIFICATION CHECKS PASSED WITH 0 FAILURES`);
  console.log("===============================================================\n");
  return { total: results.length, passed: results.filter((r) => r.passed).length };
}

// Execute directly if run via node
if (typeof require !== "undefined" && require.main === module) {
  runAllTests().catch((err) => {
    console.error("Verification suite failed:", err);
    process.exit(1);
  });
}
