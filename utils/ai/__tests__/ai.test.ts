import { describe, it, expect } from 'vitest';
import { redactPII, containsLikelyPII } from '../redact';
import { parseLossClassifierResponse } from '../lossClassifier';
import { parseNegotiationArguments, buildNegotiationContextBlock } from '../negotiationAgent';
import { buildPricingCopilotPrompt } from '../pricingCopilot';

describe('redactPII', () => {
  it('redacts Spanish NIF', () => {
    const out = redactPII('Client 12345678A is the counterparty');
    expect(out).not.toContain('12345678A');
    expect(out).toContain('[REDACTED]');
  });
  it('redacts NIE', () => {
    const out = redactPII('NIE X1234567A');
    expect(out).not.toContain('X1234567A');
  });
  it('redacts CIF', () => {
    const out = redactPII('Corp CIF A12345678');
    expect(out).not.toContain('A12345678');
  });
  it('redacts IBAN', () => {
    const out = redactPII('IBAN ES9121000418450200051332');
    expect(out).not.toContain('ES9121000418450200051332');
  });
  it('redacts email', () => {
    const out = redactPII('Contact: juan.perez@bbva.com');
    expect(out).not.toContain('juan.perez@bbva.com');
  });
  it('redacts Spanish phone', () => {
    const out = redactPII('Phone +34 612 345 678');
    expect(out).not.toContain('612 345 678');
  });
  it('preserves non-PII text', () => {
    const out = redactPII('The client rejected our 4.35% rate');
    expect(out).toContain('4.35');
    expect(out).toContain('rejected');
  });
  it('handles empty / undefined gracefully', () => {
    expect(redactPII(undefined)).toBe('');
    expect(redactPII('')).toBe('');
  });
  it('containsLikelyPII detects residual PII', () => {
    expect(containsLikelyPII('NIF 12345678A')).toBe(true);
    expect(containsLikelyPII('just numbers 4.35%')).toBe(false);
  });
});

describe('parseLossClassifierResponse', () => {
  it('parses valid JSON', () => {
    const out = parseLossClassifierResponse(
      '{"classification": "COMPETITOR", "confidence": 0.85, "rationale": "BBVA offered lower"}',
    );
    expect(out).toEqual({ classification: 'COMPETITOR', confidence: 0.85, rationale: 'BBVA offered lower' });
  });
  it('strips markdown code fences', () => {
    const out = parseLossClassifierResponse(
      '```json\n{"classification": "PRICE", "confidence": 0.7, "rationale": "too high"}\n```',
    );
    expect(out?.classification).toBe('PRICE');
  });
  it('rejects invalid classification', () => {
    const out = parseLossClassifierResponse(
      '{"classification": "NOT_A_CATEGORY", "confidence": 0.8, "rationale": "x"}',
    );
    expect(out).toBeNull();
  });
  it('rejects out-of-range confidence', () => {
    const out = parseLossClassifierResponse(
      '{"classification": "PRICE", "confidence": 1.5, "rationale": "x"}',
    );
    expect(out).toBeNull();
  });
  it('rejects malformed JSON', () => {
    expect(parseLossClassifierResponse('not json')).toBeNull();
    expect(parseLossClassifierResponse('')).toBeNull();
  });
  it('accepts all 7 valid categories', () => {
    const cats = ['PRICE', 'COVENANT', 'RELATIONSHIP', 'COMPETITOR', 'TIMING', 'CLIENT_WITHDREW', 'OTHER'];
    for (const cat of cats) {
      const out = parseLossClassifierResponse(
        `{"classification": "${cat}", "confidence": 0.5, "rationale": "x"}`,
      );
      expect(out?.classification).toBe(cat);
    }
  });
});

describe('parseNegotiationArguments', () => {
  it('parses valid array', () => {
    const out = parseNegotiationArguments(
      '[{"type":"TECHNICAL","claim":"ESG green","backup":"15bp","concession":{"rate_bp":-15,"budget_impact_bp":-15}}]',
    );
    expect(out).toHaveLength(1);
    expect(out?.[0].type).toBe('TECHNICAL');
    expect(out?.[0].concession?.rate_bp).toBe(-15);
  });
  it('filters invalid types', () => {
    const out = parseNegotiationArguments(
      '[{"type":"BOGUS","claim":"x","backup":"y"},{"type":"COMMERCIAL","claim":"a","backup":"b"}]',
    );
    expect(out).toHaveLength(1);
    expect(out?.[0].type).toBe('COMMERCIAL');
  });
  it('caps at 5 items', () => {
    const items = new Array(10).fill({ type: 'TECHNICAL', claim: 'x', backup: 'y' });
    const out = parseNegotiationArguments(JSON.stringify(items));
    expect(out).toHaveLength(5);
  });
  it('returns null on malformed input', () => {
    expect(parseNegotiationArguments('nope')).toBeNull();
    expect(parseNegotiationArguments('[]')).toBeNull();
  });
});

describe('buildNegotiationContextBlock', () => {
  it('includes all provided fields', () => {
    const block = buildNegotiationContextBlock({
      segment: 'Retail',
      proposedRate: 4.35,
      clientCounterRate: 4.1,
      marketBenchmarkRate: 4.22,
      esgProfile: 'Green',
      ltvPct: 80,
      relationshipNpv: 240_000,
      crossBonuses: [{ name: 'Deposit', bp: 8 }],
      concessionBudgetBp: 30,
    });
    expect(block).toContain('Retail');
    expect(block).toContain('4.35');
    expect(block).toContain('4.10');
    expect(block).toContain('4.22');
    expect(block).toContain('Green');
    expect(block).toContain('Deposit: 8bp');
    expect(block).toContain('30bp');
  });
  it('omits missing optional fields', () => {
    const block = buildNegotiationContextBlock({ segment: 'SME', proposedRate: 5 });
    expect(block).toContain('SME');
    expect(block).not.toContain('counter-offer');
    expect(block).not.toContain('Market benchmark');
  });
});

describe('buildPricingCopilotPrompt', () => {
  it('includes delta bp calculation', () => {
    const prompt = buildPricingCopilotPrompt({
      proposedRate: 4.35,
      recommendedRate: 4.18,
      pWinProposed: 0.62,
      pWinRecommended: 0.78,
      ftpBreakdown: {
        baseRate: 3.5,
        liquidityPremium: 0.15,
        capitalCharge: 0.2,
        esgAdjustmentBp: -15,
        regulatoryCost: 0.005,
      },
      segment: 'Retail',
      elasticityConfidence: 'HIGH',
      sampleSize: 120,
    });
    expect(prompt).toContain('17bp'); // 4.35 - 4.18 = 0.17 = 17bp
    expect(prompt).toContain('HIGH');
    expect(prompt).toContain('120');
  });
  it('defaults language to Spanish', () => {
    const prompt = buildPricingCopilotPrompt({
      proposedRate: 4.35,
      recommendedRate: 4.18,
      pWinProposed: 0.62,
      pWinRecommended: 0.78,
      ftpBreakdown: {
        baseRate: 3.5, liquidityPremium: 0.15, capitalCharge: 0.2,
        esgAdjustmentBp: 0, regulatoryCost: 0.005,
      },
      segment: 'Retail',
      elasticityConfidence: 'LOW',
      sampleSize: 10,
    });
    expect(prompt).toContain('Spanish');
  });
});
