import { describe, expect, it } from 'vitest';
import {
  buildCopilotPrompt,
  scrubClientPii,
  type PricingSnapshotForPrompt,
} from '../copilot/promptBuilder';
import type { CopilotAskRequest } from '../../types/copilot';

const baseSnapshot: PricingSnapshotForPrompt = {
  id: 'S-1',
  dealId: 'D-001',
  clientId: 'CL-1001',
  clientName: 'Acme Corp',
  productType: 'LOAN_COMM',
  amount: 5_000_000,
  currency: 'EUR',
  totalFtpPct: 3.45,
  finalClientRatePct: 4.70,
  marginPct: 1.25,
  rarocPct: 13.20,
  components: [
    { name: 'Liquidity premium', valuePct: 0.55 },
    { name: 'Capital charge',    valuePct: 0.80 },
  ],
};

const baseRequest = (overrides: Partial<CopilotAskRequest> = {}): CopilotAskRequest => ({
  question: 'Why is RAROC below target?',
  context: { snapshotId: 'S-1', oneLine: 'Deal D-001, RAROC 13.2%', view: 'CALCULATOR', dealId: 'D-001' },
  lang: 'en',
  ...overrides,
});

describe('buildCopilotPrompt', () => {
  it('uses the English system prompt when lang=en', () => {
    const out = buildCopilotPrompt({ request: baseRequest(), snapshot: baseSnapshot });
    expect(out.prompt).toContain('You are N-Pricing Copilot');
    expect(out.prompt).not.toContain('Eres N-Pricing Copilot');
  });

  it('uses the Spanish system prompt when lang=es', () => {
    const out = buildCopilotPrompt({ request: baseRequest({ lang: 'es' }), snapshot: baseSnapshot });
    expect(out.prompt).toContain('Eres N-Pricing Copilot');
    expect(out.prompt).not.toContain('You are N-Pricing Copilot');
  });

  it('redacts clientName and clientId by default and reports redactedPii=true', () => {
    const out = buildCopilotPrompt({ request: baseRequest(), snapshot: baseSnapshot });
    expect(out.prompt).toContain('<CLIENT_REDACTED>');
    expect(out.prompt).not.toContain('Acme Corp');
    expect(out.prompt).not.toContain('CL-1001');
    expect(out.redactedPii).toBe(true);
  });

  it('does not redact when redactPii=false (opt-out per tenant)', () => {
    const out = buildCopilotPrompt({
      request: baseRequest(),
      snapshot: baseSnapshot,
      redactPii: false,
    });
    expect(out.prompt).toContain('Acme Corp');
    expect(out.prompt).toContain('CL-1001');
    expect(out.redactedPii).toBe(false);
  });

  it('redactedPii=false when snapshot has no PII to redact', () => {
    const noPii: PricingSnapshotForPrompt = { ...baseSnapshot, clientId: null, clientName: null };
    const out = buildCopilotPrompt({ request: baseRequest(), snapshot: noPii });
    expect(out.redactedPii).toBe(false);
  });

  it('renders the snapshot block with formatted numbers (2 decimals)', () => {
    const out = buildCopilotPrompt({ request: baseRequest(), snapshot: baseSnapshot });
    expect(out.prompt).toMatch(/FTP: 3\.45%/);
    expect(out.prompt).toMatch(/Final client rate: 4\.70%/);
    expect(out.prompt).toMatch(/Margin: 1\.25%/);
    expect(out.prompt).toMatch(/RAROC: 13\.20%/);
  });

  it('substitutes "n/a" for null/non-finite numbers', () => {
    const partial: PricingSnapshotForPrompt = {
      ...baseSnapshot,
      totalFtpPct: null,
      rarocPct: Number.NaN,
    };
    const out = buildCopilotPrompt({ request: baseRequest(), snapshot: partial });
    expect(out.prompt).toMatch(/FTP: n\/a/);
    expect(out.prompt).toMatch(/RAROC: n\/a/);
  });

  it('renders the top components block when present', () => {
    const out = buildCopilotPrompt({ request: baseRequest(), snapshot: baseSnapshot });
    expect(out.prompt).toContain('Top components:');
    expect(out.prompt).toMatch(/Liquidity premium: 0\.55%/);
    expect(out.prompt).toMatch(/Capital charge: 0\.80%/);
  });

  it('omits the components block when empty or missing', () => {
    const noComponents: PricingSnapshotForPrompt = { ...baseSnapshot, components: [] };
    const out = buildCopilotPrompt({ request: baseRequest(), snapshot: noComponents });
    expect(out.prompt).not.toContain('Top components:');
  });

  it('embeds the user question verbatim and trims whitespace', () => {
    const out = buildCopilotPrompt({
      request: baseRequest({ question: '   What if I lower the margin? \n  ' }),
      snapshot: baseSnapshot,
    });
    expect(out.prompt).toMatch(/What if I lower the margin\?$/);
    expect(out.prompt).not.toMatch(/\n\s+$/);
  });

  it('renders "general" context when oneLine is missing', () => {
    const out = buildCopilotPrompt({
      request: baseRequest({ context: { snapshotId: undefined, view: 'BLOTTER', dealId: undefined } }),
      snapshot: undefined,
    });
    expect(out.prompt).toContain('# Context (general)');
    expect(out.prompt).toContain('No active pricing snapshot.');
  });

  it('handles snapshot with no PII without flagging redactedPii', () => {
    const out = buildCopilotPrompt({
      request: baseRequest(),
      snapshot: { ...baseSnapshot, clientId: null, clientName: null },
    });
    expect(out.redactedPii).toBe(false);
    expect(out.prompt).not.toContain('<CLIENT_REDACTED>');
  });
});

describe('scrubClientPii', () => {
  it('returns text untouched when no snapshot is provided', () => {
    expect(scrubClientPii('Hello Acme Corp', undefined)).toBe('Hello Acme Corp');
  });

  it('replaces clientName occurrences with the placeholder', () => {
    const out = scrubClientPii('Acme Corp pricing for Acme Corp deal', baseSnapshot);
    expect(out).toBe('<CLIENT_REDACTED> pricing for <CLIENT_REDACTED> deal');
  });

  it('replaces clientId occurrences with the placeholder', () => {
    const out = scrubClientPii('Client CL-1001 reviewed', baseSnapshot);
    expect(out).toBe('Client <CLIENT_REDACTED> reviewed');
  });

  it('handles overlapping name + id in same string', () => {
    const out = scrubClientPii('Acme Corp (CL-1001) RAROC 13%', baseSnapshot);
    expect(out).toContain('<CLIENT_REDACTED> (<CLIENT_REDACTED>)');
  });

  it('is a no-op when snapshot has no PII', () => {
    const text = 'CL-1001 still appears';
    const noPii: PricingSnapshotForPrompt = { ...baseSnapshot, clientId: null, clientName: null };
    expect(scrubClientPii(text, noPii)).toBe(text);
  });
});
