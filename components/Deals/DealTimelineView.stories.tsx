import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DealTimelineView from './DealTimelineView';
import { queryKeys } from '../../hooks/queries/queryKeys';
import type { DealTimeline } from '../../types/dealTimeline';

/**
 * Stories for DealTimelineView (Ola 7 Bloque A.4-A.5). Seeds the
 * React Query cache directly via `queryClient.setQueryData(...)` so
 * the view renders synchronously without hitting the server.
 *
 * Three variants cover the day-to-day shapes:
 *   - Default: a deal with 1 reprice + 1 escalation + 1 dossier.
 *   - HeavyDeal: a deal with multiple repricings + escalations to
 *     stress the timeline rendering (40 events).
 *   - EmptyDeal: a deal with no events yet (synthetic "deal_created"
 *     fallback from the aggregator).
 */

function buildTimeline(overrides: Partial<DealTimeline> = {}): DealTimeline {
  const baseEvents: DealTimeline['events'] = [
    {
      id: 'snapshot:S1',
      dealId: 'D-001',
      occurredAt: '2026-04-26T08:00:00Z',
      kind: 'deal_created',
      actor: { email: 'alice@bank.es', name: null, role: 'Trader' },
      snapshotId: 'S1',
      payload: {
        kind: 'deal_repriced',
        ftpPct: 3.20, finalClientRatePct: 4.55, rarocPct: 14.10,
        engineVersion: 'v1.0.0',
      },
    },
    {
      id: 'escalation:E1:opened',
      dealId: 'D-001',
      occurredAt: '2026-04-27T11:00:00Z',
      kind: 'escalation_opened',
      actor: { email: null, name: null, role: null },
      payload: { kind: 'escalation_opened', level: 'L1', dueAt: '2026-04-29T12:00:00Z' },
    },
    {
      id: 'snapshot:S2',
      dealId: 'D-001',
      occurredAt: '2026-04-28T10:00:00Z',
      kind: 'deal_repriced',
      actor: { email: 'bob@bank.es', name: null, role: 'Risk_Manager' },
      snapshotId: 'S2',
      payload: {
        kind: 'deal_repriced',
        ftpPct: 3.45, finalClientRatePct: 4.70, rarocPct: 13.20,
        engineVersion: 'v1.0.0',
      },
    },
    {
      id: 'escalation:E1:resolved',
      dealId: 'D-001',
      occurredAt: '2026-04-28T12:30:00Z',
      kind: 'escalation_resolved',
      actor: { email: 'committee@bank.es', name: null, role: null },
      payload: { kind: 'escalation_resolved', level: 'L1', resolvedAt: '2026-04-28T12:30:00Z' },
    },
    {
      id: 'dossier:X1',
      dealId: 'D-001',
      occurredAt: '2026-04-28T14:00:00Z',
      kind: 'dossier_signed',
      actor: { email: 'committee@bank.es', name: null, role: null },
      snapshotId: 'S2',
      payload: {
        kind: 'dossier_signed',
        payloadHash: 'abc123def456789012345678901234567890abcdef0123456789abcdef012345',
        signatureHex: 'fedcba9876543210' + 'fedcba9876543210' + 'fedcba9876543210' + 'fedcba9876543210',
      },
    },
  ];
  return {
    dealId: 'D-001',
    entityId: 'E1',
    currentStatus: 'Pending',
    events: baseEvents,
    decisionLineage: [
      { stage: 'created', actor: 'alice@bank.es', at: '2026-04-26T08:00:00Z' },
      { stage: 'L1',      actor: null,             at: '2026-04-27T11:00:00Z' },
    ],
    counts: { repricings: 1, escalations: 1, dossiers: 1 },
    ...overrides,
  };
}

function withSeededTimeline(timeline: DealTimeline) {
  return function Wrap(StoryComponent: React.ComponentType) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(queryKeys.deals.timeline(timeline.dealId), timeline);
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/deals/${timeline.dealId}/timeline`]}>
          <div style={{ background: 'var(--nfq-bg-root)', minHeight: '100vh' }}>
            <StoryComponent />
          </div>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Deals/DealTimelineView',
  component: DealTimelineView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DealTimelineView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { dealId: 'D-001' },
  decorators: [withSeededTimeline(buildTimeline())],
};

export const HeavyDeal: Story = {
  args: { dealId: 'D-001' },
  decorators: [
    withSeededTimeline(
      (() => {
        const base = buildTimeline();
        // Synthesise 40 events by repeating + offsetting timestamps.
        const events = Array.from({ length: 40 }, (_, i) => {
          const tpl = base.events[i % base.events.length];
          if (!tpl) return base.events[0]!;
          return {
            ...tpl,
            id: `${tpl.id}:dup-${i}`,
            occurredAt: new Date(Date.parse(tpl.occurredAt) - i * 3_600_000).toISOString(),
          };
        });
        return { ...base, events, counts: { repricings: 18, escalations: 14, dossiers: 8 } };
      })(),
    ),
  ],
  parameters: {
    docs: { description: { story: 'Heavy deal — 40 events. Stresses the vertical stepper rendering.' } },
  },
};

export const EmptyDeal: Story = {
  args: { dealId: 'D-NEW' },
  decorators: [
    withSeededTimeline({
      dealId: 'D-NEW',
      entityId: 'E1',
      currentStatus: 'Draft',
      events: [],
      decisionLineage: [{ stage: 'created', actor: null, at: '2026-04-29T09:00:00Z' }],
      counts: { repricings: 0, escalations: 0, dossiers: 0 },
    }),
  ],
  parameters: {
    docs: { description: { story: 'Empty deal — just created, no events yet. Empty-state copy renders.' } },
  },
};

export const FocusedEvent: Story = {
  args: { dealId: 'D-001', focusEventId: 'snapshot:S2' },
  decorators: [withSeededTimeline(buildTimeline())],
  parameters: {
    docs: { description: { story: 'Deep-link with ?focus=snapshot:S2 — the matching card gets the cyan ring.' } },
  },
};
