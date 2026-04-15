import { describe, it, expect } from 'vitest';
import { detectDrift, DEFAULT_DRIFT_THRESHOLDS } from '../backtesting/driftDetector';
import type { BacktestResult } from '../../types/whatIf';

const make = (overrides: Partial<BacktestResult>): BacktestResult => ({
  runId: 'run-1',
  simulatedPnl: 1_000_000,
  actualPnl: 1_000_000,
  pnlDelta: 0,
  pnlDeltaPct: 0,
  simulatedAvgRaroc: 0.15,
  actualAvgRaroc: 0.15,
  rarocDeltaPp: 0,
  periodBreakdown: [],
  cohortBreakdown: [],
  ...overrides,
});

describe('detectDrift', () => {
  it('reports ok when both metrics are below warn thresholds', () => {
    const v = detectDrift(make({ pnlDeltaPct: 1, rarocDeltaPp: 0.5 }));
    expect(v.severity).toBe('ok');
    expect(v.reasons).toEqual([]);
  });

  it('warns when pnl drift crosses the warn threshold', () => {
    const v = detectDrift(make({ pnlDeltaPct: 6 }));
    expect(v.pnlSeverity).toBe('warning');
    expect(v.severity).toBe('warning');
    expect(v.reasons.some((r) => r.includes('PnL drift'))).toBe(true);
  });

  it('marks breached when pnl drift crosses the breach threshold', () => {
    const v = detectDrift(make({ pnlDeltaPct: -15 }));
    expect(v.pnlSeverity).toBe('breached');
    expect(v.severity).toBe('breached');
  });

  it('promotes overall severity to the worst dimension', () => {
    const v = detectDrift(make({ pnlDeltaPct: 1, rarocDeltaPp: 3 }));
    expect(v.rarocSeverity).toBe('breached');
    expect(v.severity).toBe('breached');
  });

  it('symmetric: positive and negative drift treated equally', () => {
    const a = detectDrift(make({ pnlDeltaPct: 12 }));
    const b = detectDrift(make({ pnlDeltaPct: -12 }));
    expect(a.severity).toBe(b.severity);
  });

  it('respects custom thresholds', () => {
    const v = detectDrift(make({ pnlDeltaPct: 3 }), { ...DEFAULT_DRIFT_THRESHOLDS, pnlWarnPct: 1, pnlBreachPct: 2 });
    expect(v.severity).toBe('breached');
  });
});
