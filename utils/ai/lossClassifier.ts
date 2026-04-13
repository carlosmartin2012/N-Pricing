/**
 * Loss Classifier — classifies free-text deal-loss notes into the
 * controlled loss_reason vocabulary.
 *
 * See: docs/pivot/ai-assistant-refocus.md §3
 *      utils/dealOutcome.ts (LOSS_REASON_OPTIONS)
 */

import { invokeAI } from './client';
import { redactPII } from './redact';
import type { LossReason } from '../dealOutcome';

const VALID_REASONS: readonly LossReason[] = [
  'PRICE',
  'COVENANT',
  'RELATIONSHIP',
  'COMPETITOR',
  'TIMING',
  'CLIENT_WITHDREW',
  'OTHER',
];

const SYSTEM_PROMPT = `You are a Loss Reason Classifier for bank deal outcomes.

Given notes written by a bank originator about why a deal was lost, classify
the PRIMARY reason into one of 7 categories:

- PRICE: rate or fee was not competitive enough
- COVENANT: non-price contractual terms (guarantees, reporting, duration flex)
- RELATIONSHIP: broader client relationship influenced the decision
- COMPETITOR: explicit mention of a competitor offer
- TIMING: deal delayed or client urgency mismatch
- CLIENT_WITHDREW: client pulled out for internal (non-pricing) reasons
- OTHER: none of the above fits clearly

OUTPUT FORMAT (strict JSON, no prose, no markdown fences):
{"classification": "<CATEGORY>", "confidence": <0.0-1.0>, "rationale": "<one sentence>"}

RULES:
- If notes mention "BBVA offered 15bp below" → COMPETITOR.
- If notes mention "no les gustó el covenant" or "restrictive terms" → COVENANT.
- If ambiguous, return OTHER with low confidence.
- Notes may be in Spanish or English.
- Never return free-text categories outside the 7 options.
- If notes are empty or too short, return OTHER with confidence 0.0.
`;

export interface LossClassifierContext {
  segment?: string;
  proposedRate?: number;
  competitorRateMentioned?: boolean;
}

export interface LossClassifierResponse {
  classification: LossReason;
  confidence: number;
  rationale: string;
}

export interface LossClassifierOutcome {
  ok: true;
  result: LossClassifierResponse;
}

export interface LossClassifierFailure {
  ok: false;
  reason: 'EMPTY_INPUT' | 'AI_UNAVAILABLE' | 'PARSE_ERROR';
}

export type LossClassifierResult = LossClassifierOutcome | LossClassifierFailure;

/**
 * Parse the model's JSON output. Tolerates accidental code fences.
 * Returns null if the output cannot be coerced to a valid classification.
 */
export const parseLossClassifierResponse = (raw: string): LossClassifierResponse | null => {
  if (!raw) return null;
  // Strip code fences if present
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Partial<LossClassifierResponse>;
    if (!parsed.classification || !VALID_REASONS.includes(parsed.classification as LossReason)) {
      return null;
    }
    const confidence = Number(parsed.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return null;
    }
    return {
      classification: parsed.classification as LossReason,
      confidence,
      rationale: String(parsed.rationale ?? ''),
    };
  } catch {
    return null;
  }
};

export async function classifyLossReason(
  notes: string,
  context?: LossClassifierContext,
): Promise<LossClassifierResult> {
  const trimmed = (notes ?? '').trim();
  if (trimmed.length < 10) {
    return { ok: false, reason: 'EMPTY_INPUT' };
  }

  const safeNotes = redactPII(trimmed);
  const contextBlock = context
    ? `\n\nDEAL CONTEXT:\n- Segment: ${context.segment ?? 'unknown'}\n- Proposed rate: ${
        context.proposedRate != null ? `${context.proposedRate}%` : 'unknown'
      }\n- Competitor rate mentioned by client: ${context.competitorRateMentioned ? 'yes' : 'no'}`
    : '';

  const userMessage = `NOTES:\n${safeNotes}${contextBlock}\n\nRespond with JSON only.`;

  const result = await invokeAI({
    capability: 'LOSS_CLASSIFIER',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    temperature: 0.1,
    responseFormat: 'json',
  });

  if (result.outcome !== 'SUCCESS') {
    return { ok: false, reason: 'AI_UNAVAILABLE' };
  }

  const parsed = parseLossClassifierResponse(result.text);
  if (!parsed) {
    return { ok: false, reason: 'PARSE_ERROR' };
  }
  return { ok: true, result: parsed };
}
