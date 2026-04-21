// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInitializeClv } from '../useClvQueries';

/**
 * useInitializeClv runs `recomputeClientLtv` then `generateNba` in sequence.
 * Tests verify:
 *   - success path returns { snapshot, nba } and invalidates the right keys
 *   - if LTV fails, NBA is never called
 *   - if NBA fails after LTV succeeded, the error propagates but the LTV
 *     result is not lost (we do not roll back — partial success is
 *     intentional in the UX flow).
 */

const api = vi.hoisted(() => ({
  recomputeClientLtv: vi.fn(),
  generateNba: vi.fn(),
}));

vi.mock('../../../api/clv', () => api);

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

describe('useInitializeClv', () => {
  beforeEach(() => {
    api.recomputeClientLtv.mockReset();
    api.generateNba.mockReset();
  });

  it('runs recompute → generate in sequence and returns both results', async () => {
    const snap = { id: 'snap-1', clientId: 'c-1' };
    const nba = [{ id: 'nba-1', clientId: 'c-1' }];
    api.recomputeClientLtv.mockResolvedValue(snap);
    api.generateNba.mockResolvedValue(nba);

    const { Wrapper } = wrap();
    const { result } = renderHook(() => useInitializeClv('c-1'), { wrapper: Wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.recomputeClientLtv).toHaveBeenCalledWith('c-1');
    expect(api.generateNba).toHaveBeenCalledWith('c-1');
    expect(result.current.data).toEqual({ snapshot: snap, nba });
  });

  it('does not call NBA when LTV returns null (recompute failure)', async () => {
    api.recomputeClientLtv.mockResolvedValue(null);

    const { Wrapper } = wrap();
    const { result } = renderHook(() => useInitializeClv('c-1'), { wrapper: Wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(api.recomputeClientLtv).toHaveBeenCalledOnce();
    expect(api.generateNba).not.toHaveBeenCalled();
  });

  it('surfaces NBA errors without rolling back LTV', async () => {
    const snap = { id: 'snap-1', clientId: 'c-1' };
    api.recomputeClientLtv.mockResolvedValue(snap);
    api.generateNba.mockRejectedValue(new Error('nba_down'));

    const { Wrapper } = wrap();
    const { result } = renderHook(() => useInitializeClv('c-1'), { wrapper: Wrapper });

    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));

    // LTV call happened and was not rolled back. The API layer is
    // responsible for "the snapshot is now persisted"; we don't
    // undo it from the client.
    expect(api.recomputeClientLtv).toHaveBeenCalledOnce();
    expect(api.generateNba).toHaveBeenCalledOnce();
  });

  it('invalidates ltv/nba/timeline query keys on success', async () => {
    const snap = { id: 'snap-1' };
    const nba = [{ id: 'nba-1' }];
    api.recomputeClientLtv.mockResolvedValue(snap);
    api.generateNba.mockResolvedValue(nba);

    const { qc, Wrapper } = wrap();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useInitializeClv('c-1'), { wrapper: Wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    // Expect at least ltv + nba(open) + nba(all) + timeline.
    const flat = invalidated.flat().map(String).join('|');
    expect(flat).toContain('ltv');
    expect(flat).toContain('nba');
    expect(flat).toContain('timeline');
  });
});
