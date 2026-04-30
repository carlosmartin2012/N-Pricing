// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMock = vi.hoisted(() => ({
  pool:                   { query: vi.fn(), connect: vi.fn() },
  query:                  vi.fn(),
  queryOne:               vi.fn(),
  execute:                vi.fn(),
  withTransaction:        vi.fn(),
  withTenancyTransaction: vi.fn(),
}));
vi.mock('../../server/db', () => dbMock);

import { runRecalibrationSweep } from '../../server/workers/attributionThresholdRecalibrator';

beforeEach(() => {
  dbMock.query.mockReset();
  dbMock.queryOne.mockReset();
});

describe('attributionThresholdRecalibrator · runRecalibrationSweep', () => {
  it('escanea entities y persiste proposals via UPSERT', async () => {
    // 1) lista entities
    dbMock.query.mockResolvedValueOnce([{ entity_id: 'E1' }]);
    // 2) thresholds de E1
    dbMock.query.mockResolvedValueOnce([{
      id:               'thr-1',
      entity_id:        'E1',
      level_id:         'lvl-1',
      scope:            {},
      deviation_bps_max: 10,
      raroc_pp_min:      12,
      volume_eur_max:    500_000,
      active_from:       '2026-01-01',
      active_to:         null,
      is_active:         true,
      created_at:        '2026-04-01T00:00:00Z',
      updated_at:        '2026-04-01T00:00:00Z',
    }]);
    // 3) decisions de E1: 40 con drift -10 bps → debería disparar RELAX
    dbMock.query.mockResolvedValueOnce(
      Array.from({ length: 40 }).map((_, i) => ({
        id:                       `dec-${i}`,
        entity_id:                'E1',
        deal_id:                  `d-${i}`,
        required_level_id:        'lvl-1',
        decided_by_level_id:      'lvl-1',
        decided_by_user:          'u@bank.es',
        decision:                 'approved',
        reason:                   null,
        pricing_snapshot_hash:    'h',
        routing_metadata:         { deviationBps: -10, rarocPp: 14, volumeEur: 100, scope: {} },
        decided_at:               '2026-04-30T10:00:00Z',
      })),
    );
    dbMock.queryOne.mockResolvedValueOnce({ id: 'recal-1' });

    const report = await runRecalibrationSweep();

    expect(report.entitiesScanned).toBe(1);
    expect(report.proposalsEmitted).toBe(1);
    expect(report.proposalsByEntity['E1']).toBe(1);
    expect(dbMock.queryOne).toHaveBeenCalledTimes(1);
    const upsertSql = dbMock.queryOne.mock.calls[0][0] as string;
    expect(upsertSql).toContain('INSERT INTO attribution_threshold_recalibrations');
    expect(upsertSql).toContain('ON CONFLICT ON CONSTRAINT uniq_attr_recal_pending');
  });

  it('si no hay thresholds activos no llama queryOne', async () => {
    dbMock.query.mockResolvedValueOnce([]);
    const report = await runRecalibrationSweep();
    expect(report.entitiesScanned).toBe(0);
    expect(dbMock.queryOne).not.toHaveBeenCalled();
  });

  it('error per-entity sigue procesando otras entities', async () => {
    dbMock.query
      .mockResolvedValueOnce([{ entity_id: 'OK' }, { entity_id: 'FAIL' }])
      .mockResolvedValueOnce([])      // OK thresholds (no proposals → 0 queryOne)
      .mockResolvedValueOnce([])      // OK decisions
      .mockRejectedValueOnce(new Error('boom'));    // FAIL thresholds
    const report = await runRecalibrationSweep();
    expect(report.entitiesScanned).toBe(1);
    expect(report.errors).toContainEqual(expect.stringMatching(/FAIL.*boom/));
  });
});
