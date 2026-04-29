import { describe, expect, it } from 'vitest';
import {
  EVENT_LABEL,
  EVENT_TONE,
  formatRelative,
  formatTimestamp,
  summarizePayload,
  toneClass,
} from '../timelineFormatters';
import type { DealTimelineEvent } from '../../../types/dealTimeline';

const baseEvent = (overrides: Partial<DealTimelineEvent> = {}): DealTimelineEvent => ({
  id: 'snapshot:S-1',
  dealId: 'D-1',
  occurredAt: '2026-04-01T08:00:00Z',
  kind: 'deal_repriced',
  actor: { email: null, name: null, role: null },
  payload: { kind: 'deal_repriced', ftpPct: 3.456, finalClientRatePct: 4.55, rarocPct: 12.34, engineVersion: 'v1' },
  ...overrides,
});

describe('formatTimestamp', () => {
  it('returns em-dash on empty input', () => {
    expect(formatTimestamp('')).toBe('—');
  });
  it('returns em-dash on invalid date', () => {
    expect(formatTimestamp('not-a-date')).toBe('—');
  });
  it('formats valid ISO to es-ES short format', () => {
    const out = formatTimestamp('2026-04-01T08:00:00Z');
    expect(out).toMatch(/2026/);
  });
});

describe('formatRelative', () => {
  const NOW = new Date('2026-04-10T12:00:00Z');

  it('returns "just now" for sub-minute past timestamps', () => {
    expect(formatRelative('2026-04-10T11:59:30Z', NOW)).toBe('just now');
  });
  it('rounds minutes', () => {
    expect(formatRelative('2026-04-10T11:30:00Z', NOW)).toBe('30 min ago');
  });
  it('rounds hours', () => {
    expect(formatRelative('2026-04-10T08:00:00Z', NOW)).toBe('4 h ago');
  });
  it('rounds days', () => {
    expect(formatRelative('2026-04-05T12:00:00Z', NOW)).toBe('5 d ago');
  });
  it('falls back to absolute date past 30 days', () => {
    const out = formatRelative('2026-02-01T00:00:00Z', NOW);
    expect(out).toMatch(/2026/);
  });
  it('handles future timestamps with "in N" prefix', () => {
    expect(formatRelative('2026-04-10T12:30:00Z', NOW)).toBe('in 30 min');
  });
});

describe('summarizePayload', () => {
  it('renders deal_created with status', () => {
    const ev = baseEvent({
      kind: 'deal_created',
      payload: { kind: 'deal_created', status: 'Pending' },
    });
    expect(summarizePayload(ev)).toBe('Status: Pending');
  });

  it('renders deal_repriced with FTP, rate, RAROC at 2/2/1 decimals', () => {
    expect(summarizePayload(baseEvent())).toBe('FTP 3.46% · Rate 4.55% · RAROC 12.3%');
  });

  it('renders escalation_opened with level + due date', () => {
    const ev = baseEvent({
      kind: 'escalation_opened',
      payload: { kind: 'escalation_opened', level: 'L1', dueAt: '2026-04-03T12:00:00Z' },
    });
    expect(summarizePayload(ev)).toMatch(/Level L1/);
    expect(summarizePayload(ev)).toMatch(/2026/);
  });

  it('renders escalation_expired with deadline note', () => {
    const ev = baseEvent({
      kind: 'escalation_expired',
      payload: { kind: 'escalation_expired', level: 'Committee', expiredAt: '2026-04-03T12:00:00Z' },
    });
    expect(summarizePayload(ev)).toBe('Level Committee · expired at deadline');
  });

  it('renders dossier_signed with truncated hash', () => {
    const ev = baseEvent({
      kind: 'dossier_signed',
      payload: {
        kind: 'dossier_signed',
        payloadHash: 'abcdef0123456789'.repeat(4),
        signatureHex:  'fedcba9876543210'.repeat(4),
      },
    });
    expect(summarizePayload(ev)).toBe('Hash abcdef012345…');
  });
});

describe('EVENT_LABEL / EVENT_TONE / toneClass', () => {
  it('exposes a label for every event kind', () => {
    const kinds: DealTimelineEvent['kind'][] = [
      'deal_created', 'deal_repriced', 'escalation_opened',
      'escalation_resolved', 'escalation_expired', 'dossier_signed',
    ];
    for (const k of kinds) {
      expect(EVENT_LABEL[k]).toBeTruthy();
      expect(EVENT_TONE[k]).toBeTruthy();
      expect(toneClass(k)).toMatch(/text-/);
    }
  });

  it('uses warning tone for opened, success for resolved, danger for expired', () => {
    expect(EVENT_TONE.escalation_opened).toBe('warning');
    expect(EVENT_TONE.escalation_resolved).toBe('success');
    expect(EVENT_TONE.escalation_expired).toBe('danger');
  });
});
