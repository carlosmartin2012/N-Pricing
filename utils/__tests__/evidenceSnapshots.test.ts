import { describe, expect, it } from 'vitest';
import {
  listSnapshotSummaries,
  loadSnapshotDetail,
  snapshotDetailToDto,
  snapshotSummaryToDto,
  verifySnapshotChainForEntity,
  type SnapshotDetailRow,
  type SnapshotSummaryRow,
} from '@npricing/evidence';

const summaryRow: SnapshotSummaryRow = {
  id: 'snap-1',
  entity_id: 'entity-1',
  deal_id: 'deal-1',
  pricing_result_id: 'result-1',
  request_id: 'request-1',
  engine_version: 'test-engine',
  as_of_date: '2026-01-01',
  used_mock_for: [],
  input_hash: 'input-hash',
  output_hash: 'output-hash',
  created_at: '2026-01-01T00:00:00.000Z',
};

const detailRow: SnapshotDetailRow = {
  ...summaryRow,
  pricing_result_id: 'result-1',
  input: { deal: { id: 'deal-1' } },
  context: { rules: [] },
  output: { totalFTP: 3.1 },
};

describe('evidence snapshot repository helpers', () => {
  it('maps snapshot rows to public DTOs', () => {
    expect(snapshotSummaryToDto(summaryRow)).toEqual({
      id: 'snap-1',
      dealId: 'deal-1',
      requestId: 'request-1',
      engineVersion: 'test-engine',
      asOfDate: '2026-01-01',
      usedMockFor: [],
      inputHash: 'input-hash',
      outputHash: 'output-hash',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(snapshotDetailToDto(detailRow)).toMatchObject({
      id: 'snap-1',
      entityId: 'entity-1',
      pricingResultId: 'result-1',
      input: detailRow.input,
      context: detailRow.context,
      output: detailRow.output,
    });
  });

  it('uses injected readers for detail and list queries', async () => {
    const seen: Array<{ sql: string; params?: unknown[] }> = [];
    const reader = {
      async query<T>(sql: string, params?: unknown[]) {
        seen.push({ sql, params });
        return [summaryRow as T];
      },
      async queryOne<T>(sql: string, params?: unknown[]) {
        seen.push({ sql, params });
        return detailRow as T;
      },
    };

    await expect(loadSnapshotDetail(reader, 'entity-1', 'snap-1')).resolves.toEqual(detailRow);
    await expect(listSnapshotSummaries(reader, { entityId: 'entity-1', dealId: 'deal-1', limit: 25 })).resolves.toEqual(
      [summaryRow]
    );

    expect(seen.map((entry) => entry.params)).toEqual([
      ['snap-1', 'entity-1'],
      ['entity-1', 'deal-1', 25],
    ]);
  });

  it('verifies hash chains from the injected reader', async () => {
    const result = await verifySnapshotChainForEntity(
      {
        async query<T>() {
          return [
            { id: 'snap-1', output_hash: 'hash-1', prev_output_hash: null },
            { id: 'snap-2', output_hash: 'hash-2', prev_output_hash: 'hash-1' },
          ] as T[];
        },
      },
      { entityId: 'entity-1', from: '2026-01-01', to: '2026-01-31' }
    );

    expect(result).toEqual({
      entityId: 'entity-1',
      from: '2026-01-01',
      to: '2026-01-31',
      count: 2,
      valid: true,
      checked: 2,
    });
  });
});
