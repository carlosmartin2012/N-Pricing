// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DealTimeline } from '../../../types/dealTimeline';

const api = vi.hoisted(() => ({
  getDealTimeline: vi.fn(),
}));

vi.mock('../../../api/dealTimeline', () => api);

import DealTimelineRoute from '../DealTimelineRoute';

function renderRoute(initial: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Probe component captures the current location so tests can assert
  // navigation side effects without coupling to history APIs.
  const Probe: React.FC = () => {
    const loc = useLocation();
    return <span data-testid="probe-pathname">{loc.pathname + loc.search}</span>;
  };
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/deals/:id/timeline" element={<DealTimelineRoute />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sampleTimeline: DealTimeline = {
  dealId: 'D-001',
  entityId: 'E1',
  currentStatus: 'Pending',
  events: [
    {
      id: 'snapshot:S-7',
      dealId: 'D-001',
      occurredAt: '2026-04-01T08:00:00Z',
      kind: 'deal_repriced',
      actor: { email: 'alice@bank.es', name: null, role: null },
      snapshotId: 'S-7',
      payload: { kind: 'deal_repriced', ftpPct: 3.4, finalClientRatePct: 4.7, rarocPct: 13.2, engineVersion: 'v1' },
    },
  ],
  decisionLineage: [{ stage: 'created', actor: null, at: '2026-04-01T08:00:00Z' }],
  counts: { repricings: 0, escalations: 0, dossiers: 0 },
};

describe('DealTimelineRoute', () => {
  beforeEach(() => {
    api.getDealTimeline.mockReset();
  });

  it('extracts dealId from the URL and fetches the timeline', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    renderRoute('/deals/D-001/timeline');
    await waitFor(() => screen.getByText('D-001'));
    expect(api.getDealTimeline).toHaveBeenCalledWith('D-001');
  });

  it('forwards ?focus=<eventId> as focusEventId to the view', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    renderRoute('/deals/D-001/timeline?focus=snapshot:S-7');
    await waitFor(() => screen.getByText('D-001'));
    // Focus is wired by id="tl-<eventId>" + a cyan ring class on the focused card.
    const card = document.getElementById('tl-snapshot:S-7');
    expect(card).not.toBeNull();
    expect(card?.className).toContain('ring-cyan');
  });

  it('navigates to /snapshots?focus=<id> when Replay is clicked', async () => {
    api.getDealTimeline.mockResolvedValue(sampleTimeline);
    renderRoute('/deals/D-001/timeline');
    await waitFor(() => screen.getByText('D-001'));

    const replay = screen.getByRole('button', { name: /replay snapshot s-7/i });
    fireEvent.click(replay);

    await waitFor(() =>
      expect(screen.getByTestId('probe-pathname').textContent)
        .toBe('/snapshots?focus=S-7'),
    );
  });
});
