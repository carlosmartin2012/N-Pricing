// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDealTimelineQuery } from '../useDealTimelineQuery';
import type { DealTimeline } from '../../../types/dealTimeline';

const api = vi.hoisted(() => ({
  getDealTimeline: vi.fn(),
}));

vi.mock('../../../api/dealTimeline', () => api);

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

const fakeTimeline: DealTimeline = {
  dealId: 'D-001',
  entityId: 'E1',
  currentStatus: 'Pending',
  events: [],
  decisionLineage: [{ stage: 'created', actor: null, at: '2026-04-01T08:00:00Z' }],
  counts: { repricings: 0, escalations: 0, dossiers: 0 },
};

describe('useDealTimelineQuery', () => {
  beforeEach(() => {
    api.getDealTimeline.mockReset();
  });

  it('fetches and returns the timeline for a given dealId', async () => {
    api.getDealTimeline.mockResolvedValue(fakeTimeline);
    const { Wrapper } = wrap();

    const { result } = renderHook(() => useDealTimelineQuery('D-001'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getDealTimeline).toHaveBeenCalledWith('D-001');
    expect(result.current.data).toEqual(fakeTimeline);
  });

  it('stays disabled (no fetch) when dealId is empty', async () => {
    api.getDealTimeline.mockResolvedValue(fakeTimeline);
    const { Wrapper } = wrap();

    const { result } = renderHook(() => useDealTimelineQuery(''), { wrapper: Wrapper });

    // Disabled queries report `pending` status with `fetchStatus === 'idle'`.
    expect(result.current.fetchStatus).toBe('idle');
    expect(api.getDealTimeline).not.toHaveBeenCalled();
  });

  it('uses a stable, deal-scoped query key (no cross-deal cache leak)', async () => {
    api.getDealTimeline.mockResolvedValue(fakeTimeline);
    const { Wrapper } = wrap();

    const { result: a } = renderHook(() => useDealTimelineQuery('D-A'), { wrapper: Wrapper });
    await waitFor(() => expect(a.current.isSuccess).toBe(true));

    const { result: b } = renderHook(() => useDealTimelineQuery('D-B'), { wrapper: Wrapper });
    await waitFor(() => expect(b.current.isSuccess).toBe(true));

    expect(api.getDealTimeline).toHaveBeenCalledWith('D-A');
    expect(api.getDealTimeline).toHaveBeenCalledWith('D-B');
    expect(api.getDealTimeline).toHaveBeenCalledTimes(2);
  });

  it('surfaces null timeline on API failure (graceful degradation)', async () => {
    api.getDealTimeline.mockResolvedValue(null);
    const { Wrapper } = wrap();

    const { result } = renderHook(() => useDealTimelineQuery('D-001'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
