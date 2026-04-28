// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiFetch = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock('../../utils/apiFetch', () => apiFetch);

import { getDealTimeline } from '../dealTimeline';
import type { DealTimeline } from '../../types/dealTimeline';

const fakeTimeline: DealTimeline = {
  dealId: 'D-001',
  entityId: 'E1',
  currentStatus: 'Pending',
  events: [],
  decisionLineage: [{ stage: 'created', actor: null, at: '2026-04-01T08:00:00Z' }],
  counts: { repricings: 0, escalations: 0, dossiers: 0 },
};

describe('api/dealTimeline', () => {
  beforeEach(() => {
    apiFetch.apiGet.mockReset();
  });

  it('returns null without hitting the network when dealId is empty', async () => {
    expect(await getDealTimeline('')).toBeNull();
    expect(apiFetch.apiGet).not.toHaveBeenCalled();
  });

  it('GETs /deals/:id/timeline and returns the parsed body', async () => {
    apiFetch.apiGet.mockResolvedValue(fakeTimeline);
    const res = await getDealTimeline('D-001');
    expect(apiFetch.apiGet).toHaveBeenCalledWith('/deals/D-001/timeline');
    expect(res).toEqual(fakeTimeline);
  });

  it('encodes dealId for URL safety', async () => {
    apiFetch.apiGet.mockResolvedValue(fakeTimeline);
    await getDealTimeline('D 1/with#weird');
    expect(apiFetch.apiGet).toHaveBeenCalledWith('/deals/D%201%2Fwith%23weird/timeline');
  });

  it('returns null on fetch error (caller renders empty state)', async () => {
    apiFetch.apiGet.mockRejectedValue(new Error('network down'));
    const res = await getDealTimeline('D-001');
    expect(res).toBeNull();
  });
});
