// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DealTimeline } from '../../../types/dealTimeline';

const api = vi.hoisted(() => ({
  getDealTimeline: vi.fn(),
}));

vi.mock('../../../api/dealTimeline', () => api);

import DealTimelineView from '../DealTimelineView';

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

const sampleTimeline: DealTimeline = {
  dealId: 'D-001',
  entityId: 'E1',
  currentStatus: 'Pending',
  events: [
    {
      id: 'snapshot:S-1',
      dealId: 'D-001',
      occurredAt: '2026-04-01T08:00:00Z',
      kind: 'deal_created',
      actor: { email: null, name: null, role: null },
      snapshotId: 'S-1',
      payload: { kind: 'deal_repriced', ftpPct: 3, finalClientRatePct: 4.5, rarocPct: 14, engineVersion: 'v1' },
    },
    {
      id: 'snapshot:S-2',
      dealId: 'D-001',
      occurredAt: '2026-04-02T10:00:00Z',
      kind: 'deal_repriced',
      actor: { email: 'alice@bank.es', name: null, role: null },
      snapshotId: 'S-2',
      payload: { kind: 'deal_repriced', ftpPct: 3.4, finalClientRatePct: 4.7, rarocPct: 13.2, engineVersion: 'v1' },
    },
    {
      id: 'escalation:E-1:opened',
      dealId: 'D-001',
      occurredAt: '2026-04-02T11:00:00Z',
      kind: 'escalation_opened',
      actor: { email: null, name: null, role: null },
      payload: { kind: 'escalation_opened', level: 'L1', dueAt: '2026-04-04T12:00:00Z' },
    },
    {
      id: 'dossier:X-1',
      dealId: 'D-001',
      occurredAt: '2026-04-04T16:00:00Z',
      kind: 'dossier_signed',
      actor: { email: 'committee@bank.es', name: null, role: null },
      snapshotId: 'S-2',
      payload: { kind: 'dossier_signed', payloadHash: 'a'.repeat(64), signatureHex: 'b'.repeat(64) },
    },
  ],
  decisionLineage: [
    { stage: 'created', actor: null, at: '2026-04-01T08:00:00Z' },
    { stage: 'L1',      actor: null, at: '2026-04-02T11:00:00Z' },
  ],
  counts: { repricings: 1, escalations: 1, dossiers: 1 },
};

describe('DealTimelineView', () => {
  beforeEach(() => {
    api.getDealTimeline.mockReset();
  });

  it('shows empty state when dealId is empty (no fetch)', () => {
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="" />, { wrapper: Wrapper });
    expect(screen.getByText(/no deal selected/i)).toBeInTheDocument();
    expect(api.getDealTimeline).not.toHaveBeenCalled();
  });

  it('renders header KPIs from the timeline counts', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="D-001" />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText('D-001'));
    expect(screen.getByText('Repricings').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Escalations').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Dossiers').nextElementSibling?.textContent).toBe('1');
  });

  it('renders all 4 events by default', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="D-001" />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText('D-001'));
    const articles = document.querySelectorAll('article[data-event-kind]');
    expect(articles).toHaveLength(4);
  });

  it('hides events when their kind chip is toggled off', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="D-001" />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText('D-001'));
    fireEvent.click(screen.getByRole('button', { name: /dossier signed/i }));

    const visible = document.querySelectorAll('article[data-event-kind]');
    const kinds = Array.from(visible).map((a) => a.getAttribute('data-event-kind'));
    expect(kinds).not.toContain('dossier_signed');
    expect(visible.length).toBe(3);
  });

  it('shows "all filtered out" message after clicking None', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="D-001" />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText('D-001'));
    fireEvent.click(screen.getByText('None'));
    expect(screen.getByText(/all event kinds are filtered out/i)).toBeInTheDocument();
  });

  it('shows "no events recorded" when timeline.events is empty', async () => {
    api.getDealTimeline.mockResolvedValue({ ...sampleTimeline, events: [], counts: { repricings: 0, escalations: 0, dossiers: 0 } });
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="D-001" />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText('D-001'));
    expect(screen.getByText(/no events recorded yet/i)).toBeInTheDocument();
  });

  it('renders error state when the query returns null', async () => {
    api.getDealTimeline.mockResolvedValue(null);
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="D-001" />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByText(/could not load timeline/i)).toBeInTheDocument(),
    );
  });

  it('forwards onReplaySnapshot to event cards that have a snapshotId', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    const onReplay = vi.fn();
    const { Wrapper } = wrap();
    render(<DealTimelineView dealId="D-001" onReplaySnapshot={onReplay} />, { wrapper: Wrapper });

    await waitFor(() => screen.getByText('D-001'));
    const replayButtons = screen.getAllByRole('button', { name: /replay snapshot/i });
    // 3 events have snapshotId (S-1, S-2 deal_repriced, X-1 dossier_signed → S-2)
    expect(replayButtons).toHaveLength(3);
    fireEvent.click(replayButtons[0]!);
    expect(onReplay).toHaveBeenCalled();
  });
});
