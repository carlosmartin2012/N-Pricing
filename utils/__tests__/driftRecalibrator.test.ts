import { describe, it, expect } from 'vitest';
import {
  proposeThresholdAdjustments,
  __recalibratorInternals,
} from '../attributions/driftRecalibrator';
import type { AttributionDecision, AttributionThreshold } from '../../types/attributions';

const ENTITY = '00000000-0000-0000-0000-000000000099';

const threshold = (over: Partial<AttributionThreshold> = {}): AttributionThreshold => ({
  id:                'thr-1',
  entityId:          ENTITY,
  levelId:           'lvl-1',
  scope:             {},
  deviationBpsMax:   10,
  rarocPpMin:        12,
  volumeEurMax:      500_000,
  activeFrom:        '2026-01-01',
  activeTo:          null,
  isActive:          true,
  createdAt:         '2026-04-01T00:00:00Z',
  updatedAt:         '2026-04-01T00:00:00Z',
  ...over,
});

const decision = (over: Partial<AttributionDecision> = {}): AttributionDecision => ({
  id:                  'dec-' + Math.random().toString(36).slice(2, 8),
  entityId:            ENTITY,
  dealId:              'd-1',
  requiredLevelId:     'lvl-1',
  decidedByLevelId:    'lvl-1',
  decidedByUser:       'u@bank.es',
  decision:            'approved',
  reason:              null,
  pricingSnapshotHash: 'h',
  routingMetadata:     { deviationBps: -3, rarocPp: 14, volumeEur: 100, scope: {} },
  decidedAt:           '2026-04-30T10:00:00Z',
  ...over,
});

const lots = (n: number, deviationBps: number, decisionStatus: AttributionDecision['decision'] = 'approved') =>
  Array.from({ length: n }).map(() =>
    decision({
      decision: decisionStatus,
      routingMetadata: { deviationBps, rarocPp: 14, volumeEur: 100, scope: {} },
    }),
  );

// ---------------------------------------------------------------------------
// proposeThresholdAdjustments
// ---------------------------------------------------------------------------

describe('driftRecalibrator · proposeThresholdAdjustments', () => {
  it('emite RELAX cuando drift medio supera meanDriftRelaxBps', () => {
    // Threshold holgado (deviationBpsMax=30 → limit=24) para que el drift
    // de -10 bps no dispare la condición pctAtLimit y sólo llegue al
    // umbral 'warning' por meanDeviationBps.
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({ deviationBpsMax: 30 })],
      decisions:   lots(40, -10),                   // |drift|=10 ≥ 8 warn, < 16 breach
      options:     { now: () => new Date('2026-04-30T12:00:00Z') },
    });
    expect(proposals).toHaveLength(1);
    const p = proposals[0];
    expect(p.proposedDeviationBpsMax).toBe(36);   // 30 * 1.20
    expect(p.proposedRarocPpMin).toBeCloseTo(9.6, 2);  // 12 * 0.80
    expect(p.proposedVolumeEurMax).toBe(600_000);
    expect(p.rationale.driftSeverity).toBe('warning');
    expect(p.proposedAt).toBe('2026-04-30T12:00:00.000Z');
  });

  it('emite RELAX con severity breached cuando el drift dobla el warn threshold', () => {
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({})],
      decisions:   lots(40, -20),                   // 20 ≥ 16 (8*2)
    });
    expect(proposals[0].rationale.driftSeverity).toBe('breached');
  });

  it('emite TIGHTEN cuando hay cero drift, cero at-limit y cero escalation', () => {
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({})],
      decisions:   lots(40, 0, 'approved'),         // todo approved, drift cero
    });
    expect(proposals).toHaveLength(1);
    const p = proposals[0];
    expect(p.proposedDeviationBpsMax).toBe(9.5);    // 10 * 0.95
    expect(p.proposedRarocPpMin).toBeCloseTo(12.6, 2); // 12 * 1.05
    expect(p.proposedVolumeEurMax).toBe(475_000);
    expect(p.rationale.driftSeverity).toBe('ok');
  });

  it('emite RELAX cuando escalation rate supera el umbral', () => {
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({})],
      // 40% escalation, drift bajo
      decisions:   [
        ...lots(24, -2, 'approved'),
        ...lots(16, -2, 'escalated'),
      ],
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].rationale.escalationRate).toBeCloseTo(0.4, 4);
  });

  it('omite thresholds con muestra menor que minSampleSize', () => {
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({})],
      decisions:   lots(20, -10),                   // 20 < 30 default
    });
    expect(proposals).toEqual([]);
  });

  it('omite thresholds inactivos', () => {
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({ isActive: false })],
      decisions:   lots(40, -10),
    });
    expect(proposals).toEqual([]);
  });

  it('campos NULL en threshold se mantienen NULL en propuesta', () => {
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({ deviationBpsMax: null, rarocPpMin: null, volumeEurMax: 500_000 })],
      decisions:   lots(40, -10),
    });
    expect(proposals[0].proposedDeviationBpsMax).toBeNull();
    expect(proposals[0].proposedRarocPpMin).toBeNull();
    expect(proposals[0].proposedVolumeEurMax).toBe(600_000);
  });

  it('options custom: meanDriftRelaxBps más estricto dispara con menos drift', () => {
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({})],
      decisions:   lots(40, -3),
      options:     { meanDriftRelaxBps: 2 },
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].rationale.driftSeverity).toBe('warning');
  });

  it('si hay drift y no hay shouldRelax + tampoco shouldTighten devuelve []', () => {
    // drift moderado entre 1 y 8 bps medios → no relax (default 8) y no tighten (>1)
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  [threshold({})],
      decisions:   lots(40, -3),  // |drift|=3 → no warn, mas que 1 → no tighten
    });
    expect(proposals).toEqual([]);
  });

  it('múltiples thresholds del mismo nivel: se asigna decisión al más estricto', () => {
    const ts = [
      threshold({ id: 'tight', deviationBpsMax: 5,  levelId: 'lvl-1' }),
      threshold({ id: 'loose', deviationBpsMax: 50, levelId: 'lvl-1' }),
    ];
    const decisions = lots(40, -10);
    const proposals = proposeThresholdAdjustments({
      entityId:    ENTITY,
      thresholds:  ts,
      decisions,
    });
    // Sólo el threshold tight recibe asignación (más restrictivo)
    expect(proposals).toHaveLength(1);
    expect(proposals[0].thresholdId).toBe('tight');
  });
});

// ---------------------------------------------------------------------------
// statsByThreshold (internal)
// ---------------------------------------------------------------------------

describe('driftRecalibrator · statsByThreshold (internal)', () => {
  it('calcula meanDeviationBps + pctAtLimit + escalationRate', () => {
    const t = threshold({ deviationBpsMax: 10 });
    const ds = [
      ...lots(20, -2,  'approved'),     // 20 within
      ...lots(10, -10, 'approved'),     // 10 at limit
      ...lots(10, -2,  'escalated'),    // 10 escalated
    ];
    const stats = __recalibratorInternals.statsByThreshold(ds, [t]);
    const s = stats.get('thr-1')!;
    expect(s.count).toBe(40);
    expect(s.escalationRate).toBeCloseTo(0.25, 4);
    expect(s.pctAtLimit).toBeCloseTo(0.25, 4);  // 10/40 con limit=8 (0.8*10)
  });
});
