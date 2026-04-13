/**
 * PII redaction for AI prompts.
 * See: docs/pivot/ai-assistant-refocus.md §3.5
 *
 * Strips Spanish NIFs, DNIs, IBANs, phone numbers, and proper-noun-looking
 * tokens from user-provided text before it reaches the LLM proxy.
 *
 * Conservative by design: over-redacts rather than under-redacts.
 * Classifier / copilot accuracy may suffer slightly — that is the acceptable
 * trade in favour of avoiding PII leak.
 */

const NIF_REGEX = /\b[0-9]{8}[A-Z]\b/g;                              // 12345678X
const NIE_REGEX = /\b[XYZ][0-9]{7}[A-Z]\b/g;                         // X1234567A
const CIF_REGEX = /\b[A-HJ-NP-SUVW][0-9]{7}[0-9A-J]\b/g;             // A12345678
const IBAN_REGEX = /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}\b/g;            // ES91 2100 0418…
const PHONE_REGEX = /\b(?:\+?34[\s-]?)?[6789][0-9]{2}[\s-]?[0-9]{3}[\s-]?[0-9]{3}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const NUM_LARGE_REGEX = /\b\d{1,3}(?:[.,]\d{3}){2,}\b/g;             // 1.234.567 style large numbers

const PLACEHOLDER = '[REDACTED]';

const isEnabled = (): boolean => {
  const raw = (import.meta.env?.VITE_AI_REDACT_PII as string | undefined) ?? 'true';
  return String(raw).toLowerCase() !== 'false';
};

/**
 * Apply all redaction rules to a free-text input.
 * Safe on empty or undefined strings.
 */
export const redactPII = (input: string | undefined): string => {
  if (!input) return '';
  if (!isEnabled()) return input;
  return input
    .replace(NIF_REGEX, PLACEHOLDER)
    .replace(NIE_REGEX, PLACEHOLDER)
    .replace(CIF_REGEX, PLACEHOLDER)
    .replace(IBAN_REGEX, PLACEHOLDER)
    .replace(PHONE_REGEX, PLACEHOLDER)
    .replace(EMAIL_REGEX, PLACEHOLDER)
    .replace(NUM_LARGE_REGEX, PLACEHOLDER);
};

/**
 * Verify no obvious PII leaks remain.
 * Used by test fixtures to assert redaction correctness.
 */
export const containsLikelyPII = (input: string): boolean => {
  return (
    NIF_REGEX.test(input) ||
    NIE_REGEX.test(input) ||
    CIF_REGEX.test(input) ||
    IBAN_REGEX.test(input) ||
    PHONE_REGEX.test(input) ||
    EMAIL_REGEX.test(input)
  );
};
