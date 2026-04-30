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

import { runAttributionDriftSweep } from '../../server/workers/attributionDriftDetector';

beforeEach(() => {
  dbMock.query.mockReset();
});

describe('attributionDriftDetector · runAttributionDriftSweep', () => {
  it('escanea cada entity y agrega señales de drift', async () => {
    // 1ª query: lista de entities
    dbMock.query.mockResolvedValueOnce([{ entity_id: 'E1' }]);
    // 2ª query (decisions de E1): 25 decisiones de un usuario con drift -15 bps
    dbMock.query.mockResolvedValueOnce(
      Array.from({ length: 25 }).map((_, i) => ({
        id:                       `dec-${i}`,
        entity_id:                'E1',
        deal_id:                  `d-${i}`,
        required_level_id:        'lvl-1',
        decided_by_level_id:      'lvl-1',
        decided_by_user:          'usuario-x',
        decision:                 'approved',
        reason:                   null,
        pricing_snapshot_hash:    `h-${i}`,
        routing_metadata:         { deviationBps: -15, rarocPp: 13, volumeEur: 100_000, scope: {} },
        decided_at:               new Date('2026-04-15T10:00:00Z'),
      })),
    );
    // 3ª query (thresholds de E1): vacíos
    dbMock.query.mockResolvedValueOnce([]);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const report = await runAttributionDriftSweep();

    expect(report.entitiesScanned).toBe(1);
    expect(report.signalsTotal).toBeGreaterThan(0);
    expect(report.signalsByEntity['E1']).toBeDefined();
    expect(report.signalsByEntity['E1'][0].severity).toBe('breached');
    expect(warnSpy).toHaveBeenCalledWith('[attribution-drift]', expect.objectContaining({
      entityId: 'E1', userId: 'usuario-x', severity: 'breached',
    }));
    warnSpy.mockRestore();
  });

  it('si no hay decisiones recientes devuelve report vacío', async () => {
    dbMock.query.mockResolvedValueOnce([]); // sin entities

    const report = await runAttributionDriftSweep();
    expect(report.entitiesScanned).toBe(0);
    expect(report.signalsTotal).toBe(0);
    expect(report.errors).toEqual([]);
  });

  it('captura errores por entity sin abortar el sweep', async () => {
    dbMock.query
      .mockResolvedValueOnce([{ entity_id: 'OK' }, { entity_id: 'FAIL' }])
      .mockResolvedValueOnce([]) // OK decisions
      .mockResolvedValueOnce([]) // OK thresholds
      .mockRejectedValueOnce(new Error('connection refused'));  // FAIL decisions

    const report = await runAttributionDriftSweep();
    expect(report.entitiesScanned).toBe(1); // solo OK
    expect(report.errors.length).toBe(1);
    expect(report.errors[0]).toMatch(/FAIL/);
  });

  it('un fallo en la query inicial añade error y devuelve report sin escanear', async () => {
    dbMock.query.mockRejectedValueOnce(new Error('boom'));

    const report = await runAttributionDriftSweep();
    expect(report.entitiesScanned).toBe(0);
    expect(report.errors).toContainEqual(expect.stringMatching(/boom/));
  });
});
