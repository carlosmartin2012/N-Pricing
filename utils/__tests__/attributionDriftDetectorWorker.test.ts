// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const ORIGINAL_LOG_FORMAT = process.env.LOG_FORMAT;

beforeEach(() => {
  process.env.LOG_FORMAT = 'pretty';
  dbMock.query.mockReset();
});

afterEach(() => {
  if (ORIGINAL_LOG_FORMAT === undefined) {
    delete process.env.LOG_FORMAT;
  } else {
    process.env.LOG_FORMAT = ORIGINAL_LOG_FORMAT;
  }
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
    // El worker ahora emite vía `server/logger.ts` (estructurado, una sola
    // línea). En formato pretty (default fuera de prod) sale como
    // `[attribution-drift] signal {"entityId":"E1",...}`. La aserción se
    // hace sobre la línea completa, no sobre `(prefix, obj)`.
    expect(warnSpy).toHaveBeenCalled();
    const firstCallLine = warnSpy.mock.calls[0]?.[0] as string | undefined;
    expect(firstCallLine).toMatch(/\[attribution-drift\] signal /);
    expect(firstCallLine).toContain('"entityId":"E1"');
    expect(firstCallLine).toContain('"userId":"usuario-x"');
    expect(firstCallLine).toContain('"severity":"breached"');
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
