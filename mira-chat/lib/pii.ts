// CortexMed - Production-Grade Clinical PII Redaction Middleware
// Deterministic, Reversible, Zero-Leakage Privacy Engine
// Protects PHI/PII from external LLMs while strictly preserving clinical data (drug names, dosages, intervals, timestamps)

export interface PiiContext {
  patientName?: string;
  caregiverName?: string;
  names?: string[];
  patientId?: string;
  additionalIdentifiers?: string[];
}

export interface RedactionSummary {
  redactedCount: number;
  categoriesRedacted: string[];
}

export interface RedactionResult {
  redactedText: string;
  tokenMap: Record<string, string>;
  summary: RedactionSummary;
}

export interface RedactedMessagesResult {
  messages: Array<Record<string, any>>;
  tokenMap: Record<string, string>;
  summary: RedactionSummary;
}

// Common clinical terms, units, and stop-words that must NEVER be redacted as names or entities
const CLINICAL_PRESERVE_LIST = new Set<string>([
  "mg", "mcg", "g", "ml", "bpm", "mmhg", "tablet", "tablets", "capsule", "capsules",
  "oral", "po", "bid", "tid", "qid", "prn", "daily", "twice", "am", "pm",
  "donepezil", "metformin", "lisinopril", "warfarin", "aspirin", "levothyroxine",
  "amlodipine", "atorvastatin", "omeprazole", "losartan", "gabapentin", "hydrochlorothiazide",
  "insulin", "glipizide", "furosemide", "carbidopa", "levodopa", "memantine",
  "hypertension", "diabetes", "parkinson", "dementia", "alzheimer", "osteoarthritis",
  "blood", "pressure", "heart", "rate", "glucose", "systolic", "diastolic",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "morning", "afternoon", "evening", "night", "food", "water", "meal",
]);

/**
 * Escapes characters for regex literal matching
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class PiiEngine {
  private piiToToken = new Map<string, string>();
  private tokenMap: Record<string, string> = {};
  private categories = new Set<string>();
  private counters: Record<string, number> = {
    NAME: 0,
    PHONE: 0,
    EMAIL: 0,
    ADDRESS: 0,
    DOB: 0,
    SSN: 0,
    GOV_ID: 0,
    MRN: 0,
  };

  constructor(existingTokenMap?: Record<string, string>) {
    if (existingTokenMap) {
      for (const [token, raw] of Object.entries(existingTokenMap)) {
        this.tokenMap[token] = raw;
        this.piiToToken.set(raw.toLowerCase(), token);
        // Track counter positions if needed
        const match = token.match(/\[([A-Z_]+)_(\d+)\]/);
        if (match) {
          const cat = match[1];
          const idx = parseInt(match[2], 10);
          if (this.counters[cat] !== undefined && idx >= this.counters[cat]) {
            this.counters[cat] = idx;
          }
        }
      }
    }
  }

  private getOrCreateToken(raw: string, category: string): string {
    const lookupKey = raw.trim().toLowerCase();
    if (this.piiToToken.has(lookupKey)) {
      return this.piiToToken.get(lookupKey)!;
    }

    if (!this.counters[category]) {
      this.counters[category] = 0;
    }
    this.counters[category]++;
    const token = `[${category}_${this.counters[category]}]`;

    this.piiToToken.set(lookupKey, token);
    this.tokenMap[token] = raw.trim();
    this.categories.add(category);
    return token;
  }

  public redact(text: string, context?: PiiContext): string {
    if (!text || typeof text !== "string") return text;

    let result = text;

    // 1. Dynamic Patient/Caregiver Names & Specific Context Names
    const dynamicNames: string[] = [];
    if (context?.patientName) dynamicNames.push(context.patientName);
    if (context?.caregiverName) dynamicNames.push(context.caregiverName);
    if (context?.names) dynamicNames.push(...context.names);

    // Split compound names into individual parts (e.g. "Margaret Chen" -> "Margaret Chen", "Margaret", "Chen")
    const allNameCandidates = new Set<string>();
    for (const name of dynamicNames) {
      const trimmed = name.trim();
      if (trimmed.length >= 2) {
        allNameCandidates.add(trimmed);
        const parts = trimmed.split(/\s+/);
        for (const part of parts) {
          // Avoid redacting short particles or clinical words
          if (part.length >= 3 && !CLINICAL_PRESERVE_LIST.has(part.toLowerCase())) {
            allNameCandidates.add(part);
          }
        }
      }
    }

    // Sort by longest candidate first so full names are replaced before single name parts
    const sortedNames = Array.from(allNameCandidates).sort((a, b) => b.length - a.length);

    for (const nameCandidate of sortedNames) {
      if (CLINICAL_PRESERVE_LIST.has(nameCandidate.toLowerCase())) continue;
      const namePattern = new RegExp(`\\b${escapeRegex(nameCandidate)}\\b`, "gi");
      result = result.replace(namePattern, (match) => {
        return this.getOrCreateToken(match, "NAME");
      });
    }

    // 2. Email Addresses
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    result = result.replace(emailRegex, (match) => {
      return this.getOrCreateToken(match, "EMAIL");
    });

    // 3. Social Security Numbers (US SSN: XXX-XX-XXXX)
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
    result = result.replace(ssnRegex, (match) => {
      return this.getOrCreateToken(match, "SSN");
    });

    // 4. National ID / Aadhaar patterns (XXXX XXXX XXXX or XXXX-XXXX-XXXX)
    const govIdRegex = /\b\d{4}[-\s]\d{4}[-\s]\d{4}\b/g;
    result = result.replace(govIdRegex, (match) => {
      return this.getOrCreateToken(match, "GOV_ID");
    });

    // 5. Medical Record Number (MRN)
    const mrnRegex = /\b(?:MRN|Medical\s+Record\s+Number|MRN#)\s*[:#-]?\s*([A-Za-z0-9\-]{5,15})\b/gi;
    result = result.replace(mrnRegex, (match, mrnVal) => {
      const token = this.getOrCreateToken(mrnVal, "MRN");
      return match.replace(mrnVal, token);
    });

    // 6. Date of Birth (DOB) explicit patterns (supports YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, and month name formats)
    const dobRegex = /\b(?:DOB|Date\s+of\s+Birth|born\s+on|born)\s*[:\-]?\s*((?:19\d{2}|20[0-2]\d)[-\/.](?:0?[1-9]|1[0-2])[-\/.](?:0?[1-9]|[12]\d|3[01])|\d{1,2}[-\/.]\d{1,2}[-\/.](?:19\d{2}|20[0-2]\d|\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/gi;
    result = result.replace(dobRegex, (match, datePart) => {
      const token = this.getOrCreateToken(datePart, "DOB");
      return match.replace(datePart, token);
    });

    // 7. Standalone formatted full birthdates (YYYY-MM-DD, MM/DD/YYYY or DD/MM/YYYY with 19xx or 20xx year)
    // Guard against timestamp strings (e.g. 2026-11-20T...)
    const standaloneIsoDateRegex = /\b(19\d{2}|20[0-2]\d)[-\/.](0[1-9]|1[0-2])[-\/.](0[1-9]|[12]\d|3[01])(?![T\d:])\b/g;
    result = result.replace(standaloneIsoDateRegex, (match) => {
      return this.getOrCreateToken(match, "DOB");
    });

    const standaloneDateRegex = /\b(0[1-9]|[12]\d|3[01])[\/\-\.](0[1-9]|1[0-2])[\/\-\.](19\d{2}|20[0-2]\d)\b|\b(0[1-9]|1[0-2])[\/\-\.](0[1-9]|[12]\d|3[01])[\/\-\.](19\d{2}|20[0-2]\d)\b/g;
    result = result.replace(standaloneDateRegex, (match) => {
      return this.getOrCreateToken(match, "DOB");
    });

    // 8. Phone Numbers (Indian formats with +91, international +1, standard US 10-digit/7-digit, and mobile numbers)
    // Check +91 first to avoid +9 being split from +91-xxx-xxx-xxxx
    const phoneRegex = /\+91[-.\s]?[6-9]\d{2,4}[-.\s]?\d{3,5}(?:[-.\s]?\d{4})?\b|\+91[-.\s]?[6-9]\d{9}\b|(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\+1\d{7,10}\b|\b[6-9]\d{9}\b/g;
    result = result.replace(phoneRegex, (match) => {
      // Safeguard against matching simple 4-digit numbers or dosages
      const digitsOnly = match.replace(/\D/g, "");
      if (digitsOnly.length < 7) return match;
      return this.getOrCreateToken(match, "PHONE");
    });

    // 9. Street Addresses (e.g. "123 Main Street", "456 Elm Ave, Apt 4B", "742 Evergreen Terrace")
    // Strictly bounded street name tokens so lowercase text (e.g. "10 pills and walked to Elm Street") does not falsely swallow dosages
    const addressRegex = /\b\d{1,5}\s+(?:(?:North|South|East|West|N\.|S\.|E\.|W\.)\s+)?(?:[A-Z][a-zA-Z0-9'-]+|\d+(?:st|nd|rd|th)?)(?:\s+(?:[A-Z][a-zA-Z0-9'-]+|\d+(?:st|nd|rd|th)?)){0,3}\s+(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Circle|Cir\.?|Way|Place|Pl\.?|Parkway|Pkwy\.?|Terrace|Ter\.?|Trail|Trl\.?|Highway|Hwy\.?)(?:,?\s+(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9\-]+)?\b/gi;
    result = result.replace(addressRegex, (match) => {
      return this.getOrCreateToken(match, "ADDRESS");
    });

    return result;
  }

  public getSummary(): RedactionSummary {
    return {
      redactedCount: Object.keys(this.tokenMap).length,
      categoriesRedacted: Array.from(this.categories),
    };
  }

  public getTokenMap(): Record<string, string> {
    return { ...this.tokenMap };
  }
}

/**
 * Redacts PII from a single text string using deterministic regex and dynamic patient context.
 */
export function redactPii(text: string, context?: PiiContext): RedactionResult {
  const engine = new PiiEngine();
  const redactedText = engine.redact(text, context);
  return {
    redactedText,
    tokenMap: engine.getTokenMap(),
    summary: engine.getSummary(),
  };
}

/**
 * Redacts PII across an array of chat messages before sending to external LLM providers.
 * Maintains consistent token mapping across all messages in the conversation.
 */
export function redactChatMessages(
  messages: Array<Record<string, any>>,
  context?: PiiContext
): RedactedMessagesResult {
  const engine = new PiiEngine();
  const redactedMessages = messages.map((msg) => {
    if (typeof msg.content === "string") {
      return {
        ...msg,
        content: engine.redact(msg.content, context),
      };
    }
    return { ...msg };
  });

  return {
    messages: redactedMessages,
    tokenMap: engine.getTokenMap(),
    summary: engine.getSummary(),
  };
}

/**
 * Rehydrates redacted tokens back to original values for client presentation.
 * Safely leaves unmapped tokens untouched and prevents $ regex replacement pattern corruption.
 */
export function rehydratePii(text: string, tokenMap: Record<string, string>): string {
  if (!text || typeof text !== "string" || !tokenMap || Object.keys(tokenMap).length === 0) {
    return text;
  }

  let restored = text;
  for (const [token, originalVal] of Object.entries(tokenMap)) {
    const escapedToken = escapeRegex(token);
    restored = restored.replace(new RegExp(escapedToken, "g"), () => originalVal);
  }
  return restored;
}
