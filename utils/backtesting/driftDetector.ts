import type { BacktestResult } from '../../types/whatIf';

/**
 * Pure drift detector — turns a BacktestResult into a structured drift
 * verdict that can be persisted as a metric and evaluated by the alert
 * evaluator.
 *
 * Two dimensions evaluated:
 *   - PnL drift: |pnlDeltaPct|. If above threshold, the methodology has
 *     drifted enough that re-running it on the historical window produces
 *     materially different P&L vs what the bank actually booked.
 *   - RAROC drift: |rarocDeltaPp|. Captures profitability mis-estimation
 *     even when total P&L roughly matches.
 *
 * Severity is the worst of the two dimensions.
 */

export type DriftSeverity = 'ok' | 'warning' | 'breached';

export interface DriftThresholds {
  /** PnL drift % above which we warn (default 5). */
  pnlWarnPct: number;
  /** PnL drift % above which we mark breached (default 10). */
  pnlBreachPct: number;
  /** RAROC drift in pp above which we warn (default 1). */
  rarocWarnPp: number;
  /** RAROC drift in pp above which we mark breached (default 2). */
  rarocBreachPp: number;
}

export const DEFAULT_DRIFT_THRESHOLDS: DriftThresholds = {
  pnlWarnPct: 5,
  pnlBreachPct: 10,
  rarocWarnPp: 1,
  rarocBreachPp: 2,
};

export interface DriftVerdict {
  severity: DriftSeverity;
  pnlDeltaPct: number;
  pnlSeverity: DriftSeverity;
  rarocDeltaPp: number;
  rarocSeverity: DriftSeverity;
  reasons: string[];
}

function rank(s: DriftSeverity): number {
  return s === 'breached' ? 2 : s === 'warning' ? 1 : 0;
}

function classify(value: number, warn: number, breach: number): DriftSeverity {
  const abs = Math.abs(value);
  if (abs >= breach) return 'breached';
  if (abs >= warn)   return 'warning';
  return 'ok';
}

export function detectDrift(
  result: BacktestResult,
  thresholds: DriftThresholds = DEFAULT_DRIFT_THRESHOLDS,
): DriftVerdict {
  const pnlSeverity   = classify(result.pnlDeltaPct,    thresholds.pnlWarnPct,   thresholds.pnlBreachPct);
  const rarocSeverity = classify(result.rarocDeltaPp,   thresholds.rarocWarnPp,  thresholds.rarocBreachPp);
  const overall: DriftSeverity = rank(pnlSeverity) >= rank(rarocSeverity) ? pnlSeverity : rarocSeverity;
  const reasons: string[] = [];
  if (pnlSeverity !== 'ok') {
    reasons.push(`PnL drift ${result.pnlDeltaPct.toFixed(2)}% (${pnlSeverity})`);
  }
  if (rarocSeverity !== 'ok') {
    reasons.push(`RAROC drift ${result.rarocDeltaPp.toFixed(2)}pp (${rarocSeverity})`);
  }
  return {
    severity: overall,
    pnlDeltaPct: result.pnlDeltaPct,
    pnlSeverity,
    rarocDeltaPp: result.rarocDeltaPp,
    rarocSeverity,
    reasons,
  };
}
