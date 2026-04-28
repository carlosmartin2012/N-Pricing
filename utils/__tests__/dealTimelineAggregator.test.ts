import { describe, expect, it } from 'vitest';
import { buildDealTimeline } from '../dealTimeline/aggregator';
import type {
  DealRow,
  DossierRow,
  EscalationRow,
  PricingSnapshotRow,
} from '../../types/dealTimeline';

const baseDeal: DealRow = {
  id: 'D-001',
  entity_id: 'E1',
  status: 'Pending',
  created_at: '2026-04-01T08:00:00Z',
  updated_at: '2026-04-01T08:00:00Z',
};

function snap(overrides: Partial<PricingSnapshotRow>): PricingSnapshotRow {
  return {
    id: overrides.id ?? 'S-1',
    deal_id: 'D-001',
    entity_id: 'E1',
    total_ftp: 3.0,
    final_client_rate: 4.5,
    raroc: 15.0,
    engine_version: 'v1.0.0',
    created_by_email: 'trader@bank.es',
    created_at: '2026-04-01T08:00:00Z',
    ...overrides,
  };
}

function esc(overrides: Partial<EscalationRow>): EscalationRow {
  return {
    id: overrides.id ?? 'E-1',
    deal_id: 'D-001',
    entity_id: 'E1',
    level: 'L1',
    status: 'open',
    due_at: '2026-04-03T12:00:00Z',
    notified_at: null,
    resolved_at: null,
    created_at: '2026-04-01T09:00:00Z',
    ...overrides,
  };
}

function dossier(overrides: Partial<DossierRow>): DossierRow {
  return {
    id: overrides.id ?? 'X-1',
    deal_id: 'D-001',
    entity_id: 'E1',
    pricing_snapshot_id: 'S-1',
    payload_hash: 'a'.repeat(64),
    signature_hex: 'b'.repeat(64),
    signed_by_email: 'committee@bank.es',
    signed_at: '2026-04-04T16:00:00Z',
    ...overrides,
  };
}

describe('buildDealTimeline', () => {
  it('synthesizes deal_created event when there are no snapshots', () => {
    const tl = buildDealTimeline({ deal: baseDeal, snapshots: [], escalations: [], dossiers: [] });
    expect(tl.events).toHaveLength(1);
    expect(tl.events[0]?.kind).toBe('deal_created');
    expect(tl.events[0]?.id).toBe('deal:D-001:created');
    expect(tl.counts.repricings).toBe(0);
  });

  it('marks first snapshot as deal_created and subsequent as deal_repriced', () => {
    const tl = buildDealTimeline({
      deal: baseDeal,
      snapshots: [
        snap({ id: 'S-1', created_at: '2026-04-01T08:00:00Z' }),
        snap({ id: 'S-2', created_at: '2026-04-02T10:00:00Z' }),
        snap({ id: 'S-3', created_at: '2026-04-02T15:00:00Z' }),
      ],
      escalations: [],
      dossiers: [],
    });
    expect(tl.events.map((e) => e.kind)).toEqual(['deal_created', 'deal_repriced', 'deal_repriced']);
    expect(tl.counts.repricings).toBe(2);
    expect(tl.events[0]?.snapshotId).toBe('S-1');
    expect(tl.events[2]?.snapshotId).toBe('S-3');
  });

  it('sorts events chronologically across all sources', () => {
    const tl = buildDealTimeline({
      deal: baseDeal,
      snapshots: [snap({ id: 'S-1', created_at: '2026-04-01T08:00:00Z' })],
      escalations: [
        esc({ id: 'E-1', created_at: '2026-04-02T09:00:00Z', status: 'resolved', resolved_at: '2026-04-03T10:00:00Z' }),
      ],
      dossiers: [dossier({ signed_at: '2026-04-04T16:00:00Z' })],
    });
    const ts = tl.events.map((e) => e.occurredAt);
    expect(ts).toEqual([...ts].sort());
    expect(tl.events.map((e) => e.kind)).toEqual([
      'deal_created',
      'escalation_opened',
      'escalation_resolved',
      'dossier_signed',
    ]);
  });

  it('emits both opened and resolved events for resolved escalations', () => {
    const tl = buildDealTimeline({
      deal: baseDeal,
      snapshots: [],
      escalations: [
        esc({ id: 'E-1', status: 'resolved', resolved_at: '2026-04-02T12:00:00Z' }),
      ],
      dossiers: [],
    });
    const escEvents = tl.events.filter((e) => e.kind.startsWith('escalation_'));
    expect(escEvents.map((e) => e.kind)).toEqual(['escalation_opened', 'escalation_resolved']);
  });

  it('emits expired event for expired escalations using due_at as timestamp', () => {
    const tl = buildDealTimeline({
      deal: baseDeal,
      snapshots: [],
      escalations: [esc({ id: 'E-2', status: 'expired' })],
      dossiers: [],
    });
    const closing = tl.events.find((e) => e.kind === 'escalation_expired');
    expect(closing).toBeDefined();
    expect(closing?.occurredAt).toBe('2026-04-03T12:00:00Z');
  });

  it('builds decision lineage from created → escalation levels → final status', () => {
    const tl = buildDealTimeline({
      deal: { ...baseDeal, status: 'Booked', updated_at: '2026-04-05T18:00:00Z' },
      snapshots: [snap({ id: 'S-1' })],
      escalations: [
        esc({ id: 'E-1', level: 'L1', created_at: '2026-04-02T09:00:00Z', status: 'resolved', resolved_at: '2026-04-02T18:00:00Z' }),
        esc({ id: 'E-2', level: 'Committee', created_at: '2026-04-03T09:00:00Z', status: 'resolved', resolved_at: '2026-04-04T10:00:00Z' }),
      ],
      dossiers: [],
    });
    expect(tl.decisionLineage.map((l) => l.stage)).toEqual(['created', 'L1', 'Committee', 'approved']);
  });

  it('maps Rejected status to rejected lineage stage', () => {
    const tl = buildDealTimeline({
      deal: { ...baseDeal, status: 'Rejected', updated_at: '2026-04-05T18:00:00Z' },
      snapshots: [],
      escalations: [],
      dossiers: [],
    });
    expect(tl.decisionLineage.at(-1)?.stage).toBe('rejected');
  });

  it('preserves actor email from snapshot and dossier rows', () => {
    const tl = buildDealTimeline({
      deal: baseDeal,
      snapshots: [snap({ created_by_email: 'alice@bank.es' })],
      escalations: [],
      dossiers: [dossier({ signed_by_email: 'bob@bank.es' })],
    });
    const created = tl.events.find((e) => e.kind === 'deal_created');
    const signed  = tl.events.find((e) => e.kind === 'dossier_signed');
    expect(created?.actor.email).toBe('alice@bank.es');
    expect(signed?.actor.email).toBe('bob@bank.es');
  });

  it('keeps deterministic order on identical timestamps via id tiebreak', () => {
    const sameTs = '2026-04-01T08:00:00Z';
    const tl = buildDealTimeline({
      deal: baseDeal,
      snapshots: [],
      escalations: [
        esc({ id: 'E-2', created_at: sameTs }),
        esc({ id: 'E-1', created_at: sameTs }),
      ],
      dossiers: [],
    });
    const ids = tl.events.filter((e) => e.kind === 'escalation_opened').map((e) => e.id);
    // E-1 sorts before E-2 by id within the same timestamp
    expect(ids).toEqual(['escalation:E-1:opened', 'escalation:E-2:opened']);
  });

  it('counts each domain accurately', () => {
    const tl = buildDealTimeline({
      deal: baseDeal,
      snapshots: [snap({ id: 'S-1' }), snap({ id: 'S-2' }), snap({ id: 'S-3' })],
      escalations: [esc({ id: 'E-1' }), esc({ id: 'E-2' })],
      dossiers: [dossier({ id: 'X-1' })],
    });
    expect(tl.counts).toEqual({ repricings: 2, escalations: 2, dossiers: 1 });
  });

  it('returns dealId, entityId and currentStatus from the deal row', () => {
    const tl = buildDealTimeline({
      deal: { ...baseDeal, status: 'Review' },
      snapshots: [],
      escalations: [],
      dossiers: [],
    });
    expect(tl.dealId).toBe('D-001');
    expect(tl.entityId).toBe('E1');
    expect(tl.currentStatus).toBe('Review');
  });
});
