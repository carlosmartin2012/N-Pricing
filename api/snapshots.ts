import { apiGet, apiPost } from '../utils/apiFetch';

export interface SnapshotSummary {
  id: string;
  dealId: string | null;
  requestId: string | null;
  engineVersion: string;
  asOfDate: string;
  usedMockFor: string[] | null;
  inputHash: string;
  outputHash: string;
  createdAt: string;
}

export interface SnapshotReplayDiffItem {
  field: string;
  before: number | string | null;
  after: number | string | null;
  deltaAbs?: number;
  deltaBps?: number;
}

export interface SnapshotReplayResult {
  snapshotId: string;
  matches: boolean;
  engineVersionOriginal: string;
  engineVersionNow: string;
  originalOutputHash: string;
  currentOutputHash: string;
  diff: SnapshotReplayDiffItem[];
}

export async function listSnapshots(params?: { dealId?: string; limit?: number }): Promise<SnapshotSummary[]> {
  const query = new URLSearchParams();
  if (params?.dealId) query.set('deal_id', params.dealId);
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiGet<SnapshotSummary[]>(`/snapshots${qs ? `?${qs}` : ''}`);
}

export async function replaySnapshot(id: string): Promise<SnapshotReplayResult> {
  return apiPost<SnapshotReplayResult>(`/snapshots/${id}/replay`, {});
}
