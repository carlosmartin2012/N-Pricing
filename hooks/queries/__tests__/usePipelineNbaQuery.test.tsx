// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePipelineNbaQuery, useConsumeNbaPipeline } from '../useClvQueries';

const api = vi.hoisted(() => ({
  listPipelineNba: vi.fn(),
  consumeNba: vi.fn(),
}));

vi.mock('../../../api/clv', () => api);

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

describe('usePipelineNbaQuery', () => {
  beforeEach(() => {
    api.listPipelineNba.mockReset();
  });

  it('defaults to status=open and returns pipeline rows', async () => {
    const rows = [{ id: 'pnba-1', clientId: 'c-1', clientName: 'Client A' }];
    api.listPipelineNba.mockResolvedValue(rows);

    const { Wrapper } = wrap();
    const { result } = renderHook(() => usePipelineNbaQuery(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.listPipelineNba).toHaveBeenCalledWith('open');
    expect(result.current.data).toEqual(rows);
  });

  it('changes query key when status filter flips (no stale cache leak)', async () => {
    api.listPipelineNba.mockResolvedValue([]);
    const { Wrapper } = wrap();

    const { result: openResult } = renderHook(() => usePipelineNbaQuery('open'), { wrapper: Wrapper });
    await waitFor(() => expect(openResult.current.isSuccess).toBe(true));

    const { result: consumedResult } = renderHook(() => usePipelineNbaQuery('consumed'), { wrapper: Wrapper });
    await waitFor(() => expect(consumedResult.current.isSuccess).toBe(true));

    expect(api.listPipelineNba).toHaveBeenCalledWith('open');
    expect(api.listPipelineNba).toHaveBeenCalledWith('consumed');
  });
});

describe('useConsumeNbaPipeline', () => {
  beforeEach(() => {
    api.consumeNba.mockReset();
  });

  it('calls consumeNba and invalidates pipeline + nba trees on success', async () => {
    api.consumeNba.mockResolvedValue({ id: 'n-1' });
    const { qc, Wrapper } = wrap();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useConsumeNbaPipeline(), { wrapper: Wrapper });
    result.current.mutate('n-1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const keys = invalidate.mock.calls.map((c) => c[0]?.queryKey?.join('|') ?? '');
    expect(keys.some((k) => k.includes('pipeline'))).toBe(true);
    expect(keys.some((k) => k.includes('nba'))).toBe(true);
  });
});
