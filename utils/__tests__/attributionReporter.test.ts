import { describe, it, expect } from 'vitest';
import {
  aggregateByLevel,
  aggregateByUser,
  decisionFunnel,
  timeToDecisionStats,
  detectSystematicDrift,
  buildAttributionSummary,
  DEFAULT_ATTRIBUTION_DRIFT_THRESHOLDS,
} from '../attributions/attributionReporter';
import type { AttributionDecision, AttributionLevel } from '../../types/attributions';

const ENTITY = '00000000-0000-0000-0000-000000000099';

const baseLevel = (over: Partial<AttributionLevel>): AttributionLevel => ({
  id:          'lvl-x',
  entityId:    ENTITY,
  name:        'Office',
  parentId:    null,
  levelOrder:  1,
  rbacRole:    'BranchManager',
  metadata:    {},
  active:      true,
  createdAt:   '2026-04-01T00:00:00Z',
  updatedAt:   '2026-04-01T00:00:00Z',
  ...over,
});

const baseDecision = (over: Partial<AttributionDecision>): AttributionDecision => ({
  id:                  'dec-' + Math.random().toString(36).slice(2, 8),
  entityId:            ENTITY,
  dealId:              'deal-1',
  requiredLevelId:     'lvl-office',
  decidedByLevelId:    'lvl-office',
  decidedByUser:       'user-a',
  decision:            'approved',
  reason:              null,
  pricingSnapshotHash: 'h-1',
  routingMetadata:     { deviationBps: -3, rarocPp: 14, volumeEur: 100_000, scope: {} },
  decidedAt:           '2026-04-30T10:00:00Z',
  ...over,
});

// ---------------------------------------------------------------------------
// aggregateByLevel
// ---------------------------------------------------------------------------

describe('attributionReporter · aggregateByLevel', () => {
  const office    = baseLevel({ id: 'lvl-office', name: 'Oficina',  levelOrder: 1 });
  const zone      = baseLevel({ id: 'lvl-zone',   name: 'Zona',     levelOrder: 2, parentId: 'lvl-office' });

  it('agrupa por decidedByLevelId y resuelve el level por id', () => {
    const ds = [
      baseDecision({ decidedByLevelId: 'lvl-office', decision: 'approved' }),
      baseDecision({ decidedByLevelId: 'lvl-office', decision: 'rejected' }),
      baseDecision({ decidedByLevelId: 'lvl-zone',   decision: 'approved' }),
    ];
    const result = aggregateByLevel(ds, [office, zone]);
    const officeEntry = result.find((e) => e.levelId === 'lvl-office')!;
    expect(officeEntry.stats.count).toBe(2);
    expect(officeEntry.byDecision.approved).toBe(1);
    expect(officeEntry.byDecision.rejected).toBe(1);
    expect(officeEntry.level?.name).toBe('Oficina');
  });

  it('decisions sin decidedByLevelId van a la entrada PENDING', () => {
    const ds = [baseDecision({ decidedByLevelId: null, decision: 'escalated' })];
    const result = aggregateByLevel(ds, [office]);
    expect(result[0].levelId).toBe('PENDING');
    expect(result[0].level).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// aggregateByUser
// ---------------------------------------------------------------------------

describe('attributionReporter · aggregateByUser', () => {
  it('calcula pctAtLimit con fallback heurístico (8 bps)', () => {
    const ds = [
      baseDecision({ decidedByUser: 'u1', routingMetadata: { deviationBps: -2,  rarocPp: 14, volumeEur: 100, scope: {} } }),
      baseDecision({ decidedByUser: 'u1', routingMetadata: { deviationBps: -10, rarocPp: 13, volumeEur: 100, scope: {} } }),
      baseDecision({ decidedByUser: 'u1', routingMetadata: { deviationBps: -12, rarocPp: 12, volumeEur: 100, scope: {} } }),
    ];
    const result = aggregateByUser(ds);
    expect(result[0].userId).toBe('u1');
    expect(result[0].stats.count).toBe(3);
    // 2 de 3 superan 8 bps → 0.667
    expect(result[0].pctAtLimit).toBeCloseTo(2 / 3, 4);
  });

  it('respeta thresholdLookup cuando está disponible', () => {
    const ds = [
      baseDecision({ decidedByUser: 'u1', decidedByLevelId: 'lvl-A', routingMetadata: { deviationBps: -8, rarocPp: 14, volumeEur: 100, scope: {} } }),
    ];
    // threshold 20 bps → al-limite es 0.8 * 20 = 16; 8 < 16 → no al límite
    const result = aggregateByUser(ds, () => ({ deviationBpsMax: 20 }));
    expect(result[0].pctAtLimit).toBe(0);
  });

  it('decisiones sin decidedByUser se ignoran', () => {
    const ds = [baseDecision({ decidedByUser: null })];
    expect(aggregateByUser(ds)).toEqual([]);
  });

  it('approvedRate refleja la fracción de aprobadas', () => {
    const ds = [
      baseDecision({ decidedByUser: 'u1', decision: 'approved' }),
      baseDecision({ decidedByUser: 'u1', decision: 'approved' }),
      baseDecision({ decidedByUser: 'u1', decision: 'rejected' }),
    ];
    const r = aggregateByUser(ds);
    expect(r[0].approvedRate).toBeCloseTo(2 / 3, 4);
  });
});

// ---------------------------------------------------------------------------
// decisionFunnel
// ---------------------------------------------------------------------------

describe('attributionReporter · decisionFunnel', () => {
  it('cuenta correctamente y calcula rates', () => {
    const ds = [
      baseDecision({ decision: 'approved' }),
      baseDecision({ decision: 'approved' }),
      baseDecision({ decision: 'rejected' }),
      baseDecision({ decision: 'escalated' }),
    ];
    const f = decisionFunnel(ds);
    expect(f.total).toBe(4);
    expect(f.approved).toBe(2);
    expect(f.approvedRate).toBe(0.5);
    expect(f.rejectedRate).toBe(0.25);
  });

  it('lista vacía → rates 0', () => {
    const f = decisionFunnel([]);
    expect(f.total).toBe(0);
    expect(f.approvedRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// timeToDecisionStats
// ---------------------------------------------------------------------------

describe('attributionReporter · timeToDecisionStats', () => {
  it('calcula media/mediana/p95 + breakdown por nivel', () => {
    const pairs = [
      { levelId: 'office', openedAt: '2026-04-30T10:00:00Z', decidedAt: '2026-04-30T10:30:00Z' }, // 30 min
      { levelId: 'office', openedAt: '2026-04-30T10:00:00Z', decidedAt: '2026-04-30T11:00:00Z' }, // 60 min
      { levelId: 'zone',   openedAt: '2026-04-30T10:00:00Z', decidedAt: '2026-04-30T13:00:00Z' }, // 180 min
    ];
    const stats = timeToDecisionStats(pairs);
    expect(stats.count).toBe(3);
    expect(stats.byLevel.office.count).toBe(2);
    expect(stats.byLevel.zone.count).toBe(1);
    expect(stats.medianMs).toBeGreaterThan(0);
  });

  it('lista vacía → todo 0', () => {
    const s = timeToDecisionStats([]);
    expect(s.count).toBe(0);
    expect(s.medianMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// detectSystematicDrift
// ---------------------------------------------------------------------------

describe('attributionReporter · detectSystematicDrift', () => {
  const lots = (n: number, deviationBps: number, atLimitFlag = false) => {
    const arr: AttributionDecision[] = [];
    for (let i = 0; i < n; i++) {
      arr.push(baseDecision({
        decidedByUser: 'u-heavy',
        routingMetadata: { deviationBps: atLimitFlag ? deviationBps : Math.min(0, deviationBps + i % 3), rarocPp: 13, volumeEur: 100, scope: {} },
      }));
    }
    return arr;
  };

  it('emite WARNING cuando drift medio supera el warn threshold', () => {
    const ds = Array.from({ length: 25 }).map(() =>
      baseDecision({
        decidedByUser: 'u-warn',
        routingMetadata: { deviationBps: -7, rarocPp: 13, volumeEur: 100, scope: {} },
      }),
    );
    const byUser = aggregateByUser(ds);
    const drift = detectSystematicDrift(byUser);
    expect(drift).toHaveLength(1);
    expect(drift[0].severity).toBe('warning');
  });

  it('emite BREACHED cuando drift medio supera el breach threshold', () => {
    const ds = Array.from({ length: 25 }).map(() =>
      baseDecision({
        decidedByUser: 'u-breach',
        routingMetadata: { deviationBps: -15, rarocPp: 13, volumeEur: 100, scope: {} },
      }),
    );
    const byUser = aggregateByUser(ds);
    const drift = detectSystematicDrift(byUser);
    expect(drift[0].severity).toBe('breached');
  });

  it('ignora usuarios con muestra menor a minSampleSize', () => {
    const ds = lots(10, -20); // 10 < 20 default
    const byUser = aggregateByUser(ds);
    const drift = detectSystematicDrift(byUser);
    expect(drift).toEqual([]);
  });

  it('ordena BREACHED antes que WARNING', () => {
    const dsWarn = Array.from({ length: 25 }).map(() =>
      baseDecision({ decidedByUser: 'u-warn',   routingMetadata: { deviationBps: -7,  rarocPp: 13, volumeEur: 100, scope: {} } }),
    );
    const dsBreach = Array.from({ length: 25 }).map(() =>
      baseDecision({ decidedByUser: 'u-breach', routingMetadata: { deviationBps: -15, rarocPp: 13, volumeEur: 100, scope: {} } }),
    );
    const byUser = aggregateByUser([...dsWarn, ...dsBreach]);
    const drift = detectSystematicDrift(byUser);
    expect(drift[0].severity).toBe('breached');
    expect(drift[1].severity).toBe('warning');
  });

  it('thresholds custom permiten endurecer / suavizar', () => {
    const ds = Array.from({ length: 25 }).map(() =>
      baseDecision({ decidedByUser: 'u1', routingMetadata: { deviationBps: -3, rarocPp: 13, volumeEur: 100, scope: {} } }),
    );
    const byUser = aggregateByUser(ds);
    const strict = detectSystematicDrift(byUser, {
      ...DEFAULT_ATTRIBUTION_DRIFT_THRESHOLDS,
      meanDeviationWarnBps:   2,
      meanDeviationBreachBps: 4,
    });
    expect(strict[0].severity).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// buildAttributionSummary
// ---------------------------------------------------------------------------

describe('attributionReporter · buildAttributionSummary', () => {
  it('compone un resumen completo con generatedAt determinista via now() override', () => {
    const summary = buildAttributionSummary({
      decisions: [
        baseDecision({ decidedByUser: 'u1', decision: 'approved' }),
        baseDecision({ decidedByUser: 'u1', decision: 'rejected' }),
      ],
      levels:     [baseLevel({ id: 'lvl-office' })],
      windowDays: 30,
      now:        () => new Date('2026-04-30T12:00:00Z'),
    });
    expect(summary.generatedAt).toBe('2026-04-30T12:00:00.000Z');
    expect(summary.windowDays).toBe(30);
    expect(summary.totalDecisions).toBe(2);
    expect(summary.timeToDecision).toBeNull(); // sin pairs
    expect(summary.funnel.total).toBe(2);
  });
});
