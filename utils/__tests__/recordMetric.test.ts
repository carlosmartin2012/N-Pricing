// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  pool:                   { query: vi.fn(), connect: vi.fn() },
  query:                  vi.fn(),
  queryOne:               vi.fn(),
  execute:                vi.fn(),
  withTransaction:        vi.fn(),
  withTenancyTransaction: vi.fn(),
}));
vi.mock('../../server/db', () => dbMock);

import { recordMetric } from '../../server/observability/recordMetric';

const ORIGINAL_LOG_FORMAT = process.env.LOG_FORMAT;

beforeEach(() => {
  process.env.LOG_FORMAT = 'pretty';
  dbMock.execute.mockReset();
});

afterEach(() => {
  if (ORIGINAL_LOG_FORMAT === undefined) {
    delete process.env.LOG_FORMAT;
  } else {
    process.env.LOG_FORMAT = ORIGINAL_LOG_FORMAT;
  }
});

describe('recordMetric', () => {
  it('emits an INSERT with entity, name, value and serialised dimensions', async () => {
    dbMock.execute.mockResolvedValueOnce(undefined);

    await recordMetric({
      entityId: 'ENT-1',
      metricName: 'attribution_drift_signals_total',
      value: 3,
      dimensions: { userId: 'user-42', severity: 'warning' },
    });

    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    const [sql, params] = dbMock.execute.mock.calls[0]!;
    expect(sql).toContain('INSERT INTO metrics');
    expect(params).toEqual([
      'ENT-1',
      'attribution_drift_signals_total',
      3,
      JSON.stringify({ userId: 'user-42', severity: 'warning' }),
    ]);
  });

  it('defaults dimensions to an empty object when omitted', async () => {
    dbMock.execute.mockResolvedValueOnce(undefined);

    await recordMetric({
      entityId: null,
      metricName: 'snapshot_write_latency_ms',
      value: 124,
    });

    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    const params = dbMock.execute.mock.calls[0]![1] as unknown[];
    expect(params[3]).toBe('{}');
  });

  it('accepts a null entityId for global / infrastructure metrics', async () => {
    dbMock.execute.mockResolvedValueOnce(undefined);

    await recordMetric({
      entityId: null,
      metricName: 'worker_health_ok',
      value: 1,
    });

    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    expect(dbMock.execute.mock.calls[0]![1]![0]).toBeNull();
  });

  it('skips non-finite values without throwing (NaN guard)', async () => {
    await recordMetric({
      entityId: 'ENT-1',
      metricName: 'pricing_latency_ms',
      value: Number.NaN,
    });

    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('skips Infinity / -Infinity values (overflow guard)', async () => {
    await recordMetric({
      entityId: 'ENT-1',
      metricName: 'pricing_latency_ms',
      value: Number.POSITIVE_INFINITY,
    });
    await recordMetric({
      entityId: 'ENT-1',
      metricName: 'pricing_latency_ms',
      value: Number.NEGATIVE_INFINITY,
    });

    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it('swallows db errors — emission must never break the calling business path', async () => {
    dbMock.execute.mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      recordMetric({
        entityId: 'ENT-1',
        metricName: 'attribution_drift_signals_total',
        value: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
