import type {
  DealRow,
  DealTimeline,
  DealTimelineActor,
  DealTimelineEvent,
  DealTimelineLineageEntry,
  DossierRow,
  EscalationRow,
  PricingSnapshotRow,
} from '../../types/dealTimeline';

/**
 * Pure aggregator — composes a DealTimeline from rows fetched by the
 * server route. Keeps the route shell thin and the logic testable
 * without a DB.
 */

interface AggregatorInput {
  deal: DealRow;
  snapshots: PricingSnapshotRow[];
  escalations: EscalationRow[];
  dossiers: DossierRow[];
}

const ANON_ACTOR: DealTimelineActor = { email: null, name: null, role: null };

function actorFromEmail(email: string | null): DealTimelineActor {
  if (!email) return ANON_ACTOR;
  return { email, name: null, role: null };
}

function dealCreatedEvent(deal: DealRow): DealTimelineEvent {
  return {
    id: `deal:${deal.id}:created`,
    dealId: deal.id,
    occurredAt: deal.created_at,
    kind: 'deal_created',
    actor: ANON_ACTOR,
    payload: { kind: 'deal_created', status: deal.status },
  };
}

function snapshotEvent(snap: PricingSnapshotRow, isFirst: boolean): DealTimelineEvent {
  return {
    id: `snapshot:${snap.id}`,
    dealId: snap.deal_id,
    occurredAt: snap.created_at,
    kind: isFirst ? 'deal_created' : 'deal_repriced',
    actor: actorFromEmail(snap.created_by_email),
    snapshotId: snap.id,
    payload: {
      kind: 'deal_repriced',
      ftpPct: snap.total_ftp ?? 0,
      finalClientRatePct: snap.final_client_rate ?? 0,
      rarocPct: snap.raroc ?? 0,
      engineVersion: snap.engine_version ?? 'unknown',
    },
  };
}

function escalationOpenedEvent(esc: EscalationRow): DealTimelineEvent {
  return {
    id: `escalation:${esc.id}:opened`,
    dealId: esc.deal_id ?? '',
    occurredAt: esc.created_at,
    kind: 'escalation_opened',
    actor: ANON_ACTOR,
    payload: { kind: 'escalation_opened', level: esc.level, dueAt: esc.due_at },
  };
}

function escalationClosedEvent(esc: EscalationRow): DealTimelineEvent | null {
  if (esc.status === 'resolved' && esc.resolved_at) {
    return {
      id: `escalation:${esc.id}:resolved`,
      dealId: esc.deal_id ?? '',
      occurredAt: esc.resolved_at,
      kind: 'escalation_resolved',
      actor: ANON_ACTOR,
      payload: { kind: 'escalation_resolved', level: esc.level, resolvedAt: esc.resolved_at },
    };
  }
  if (esc.status === 'expired') {
    // expired rows do not record an explicit timestamp column; fall back
    // to due_at which is when the deadline passed.
    return {
      id: `escalation:${esc.id}:expired`,
      dealId: esc.deal_id ?? '',
      occurredAt: esc.due_at,
      kind: 'escalation_expired',
      actor: ANON_ACTOR,
      payload: { kind: 'escalation_expired', level: esc.level, expiredAt: esc.due_at },
    };
  }
  return null;
}

function dossierEvent(dossier: DossierRow): DealTimelineEvent {
  return {
    id: `dossier:${dossier.id}`,
    dealId: dossier.deal_id ?? '',
    occurredAt: dossier.signed_at,
    kind: 'dossier_signed',
    actor: actorFromEmail(dossier.signed_by_email),
    snapshotId: dossier.pricing_snapshot_id ?? undefined,
    payload: {
      kind: 'dossier_signed',
      payloadHash: dossier.payload_hash,
      signatureHex: dossier.signature_hex,
    },
  };
}

function deriveLineage(events: DealTimelineEvent[], deal: DealRow): DealTimelineLineageEntry[] {
  const lineage: DealTimelineLineageEntry[] = [
    { stage: 'created', actor: null, at: deal.created_at },
  ];
  for (const ev of events) {
    if (ev.kind === 'escalation_opened') {
      const level = (ev.payload as { kind: 'escalation_opened'; level: 'L1' | 'L2' | 'Committee' }).level;
      lineage.push({ stage: level, actor: ev.actor.email, at: ev.occurredAt });
    }
  }
  if (deal.status === 'Booked') {
    lineage.push({ stage: 'approved', actor: null, at: deal.updated_at });
  } else if (deal.status === 'Rejected') {
    lineage.push({ stage: 'rejected', actor: null, at: deal.updated_at });
  }
  return lineage;
}

export function buildDealTimeline(input: AggregatorInput): DealTimeline {
  const { deal, snapshots, escalations, dossiers } = input;

  const events: DealTimelineEvent[] = [];

  // Snapshots: first one acts as deal_created (more accurate timestamp +
  // actor than the deal row itself). If no snapshots, fall back to a
  // synthetic deal_created from the deals row.
  if (snapshots.length === 0) {
    events.push(dealCreatedEvent(deal));
  } else {
    const sorted = [...snapshots].sort((a, b) => a.created_at.localeCompare(b.created_at));
    sorted.forEach((snap, idx) => events.push(snapshotEvent(snap, idx === 0)));
  }

  for (const esc of escalations) {
    events.push(escalationOpenedEvent(esc));
    const closing = escalationClosedEvent(esc);
    if (closing) events.push(closing);
  }

  for (const dossier of dossiers) {
    events.push(dossierEvent(dossier));
  }

  // Stable sort: occurredAt ASC, then by id for deterministic ties.
  events.sort((a, b) => {
    const ts = a.occurredAt.localeCompare(b.occurredAt);
    return ts !== 0 ? ts : a.id.localeCompare(b.id);
  });

  return {
    dealId: deal.id,
    entityId: deal.entity_id,
    currentStatus: deal.status,
    events,
    decisionLineage: deriveLineage(events, deal),
    counts: {
      repricings: snapshots.length === 0 ? 0 : Math.max(0, snapshots.length - 1),
      escalations: escalations.length,
      dossiers: dossiers.length,
    },
  };
}
