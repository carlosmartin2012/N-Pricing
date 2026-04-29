import { describe, expect, it } from 'vitest';
import { suggestCopilotActions } from '../copilot/suggestActions';
import type { PricingSnapshotForPrompt } from '../copilot/promptBuilder';

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
  rarocPct: 13.5,
};

describe('suggestCopilotActions', () => {
  it('returns no suggestions when there is no dealId in snapshot', () => {
    expect(suggestCopilotActions({ snapshot: undefined, question: 'why' })).toEqual([]);
    const noDeal = { ...baseSnapshot, dealId: '' };
    expect(suggestCopilotActions({ snapshot: noDeal, question: 'why' })).toEqual([]);
  });

  it('always includes the View timeline shortcut for a deal-anchored question', () => {
    const out = suggestCopilotActions({ snapshot: baseSnapshot, question: 'why is rate this high?' });
    expect(out[0]?.id).toBe('open-timeline');
    expect(out[0]?.kind).toBe('NAVIGATE');
    expect(out[0]?.payload?.path).toBe('/deals/D-001/timeline');
  });

  it('encodes the dealId in the timeline path', () => {
    const out = suggestCopilotActions({
      snapshot: { ...baseSnapshot, dealId: 'TRD HYPER/001' },
      question: 'why',
    });
    expect(out[0]?.payload?.path).toBe('/deals/TRD%20HYPER%2F001/timeline');
  });

  it('adds RAROC Terminal when the question mentions raroc / capital / return', () => {
    const cases = ['What is RAROC for this?', 'How much capital does this consume?', 'Return on equity?'];
    for (const q of cases) {
      const ids = suggestCopilotActions({ snapshot: baseSnapshot, question: q }).map((a) => a.id);
      expect(ids).toContain('open-raroc');
    }
  });

  it('adds RAROC Terminal automatically when snapshot RAROC is below 12%', () => {
    const lowRaroc = { ...baseSnapshot, rarocPct: 11.0 };
    const ids = suggestCopilotActions({ snapshot: lowRaroc, question: 'is this profitable?' }).map((a) => a.id);
    expect(ids).toContain('open-raroc');
  });

  it('adds Dossier shortcut when the question mentions committee / approval / sign', () => {
    const out = suggestCopilotActions({
      snapshot: baseSnapshot,
      question: 'When does the committee approve this?',
    });
    expect(out.find((a) => a.id === 'open-dossiers')).toBeDefined();
    expect(out.find((a) => a.id === 'open-dossiers')?.kind).toBe('OPEN_DOSSIER');
  });

  it('adds Stress Pricing when the question mentions stress / shock / EBA scenario', () => {
    const out = suggestCopilotActions({
      snapshot: baseSnapshot,
      question: 'How does this fare under EBA stress?',
    });
    expect(out.find((a) => a.id === 'open-stress')).toBeDefined();
  });

  it('caps at 3 suggestions even if all triggers fire', () => {
    const allTriggers = 'EBA stress, RAROC, committee approval timeline?';
    const out = suggestCopilotActions({ snapshot: baseSnapshot, question: allTriggers });
    expect(out.length).toBeLessThanOrEqual(3);
    expect(out[0]?.id).toBe('open-timeline');
  });

  it('relabels the timeline action when the question already mentions timeline keywords', () => {
    const out = suggestCopilotActions({
      snapshot: baseSnapshot,
      question: 'Show me the deal history',
    });
    expect(out[0]?.id).toBe('open-timeline');
    expect(out[0]?.label).toMatch(/matches your question/i);
  });
});
