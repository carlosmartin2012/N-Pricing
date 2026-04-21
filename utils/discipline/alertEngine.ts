/**
 * Alert Engine — evaluates discipline alert rules against current KPIs
 * and deal variances. Returns triggered alerts synchronously.
 */

import type {
  DealVariance,
  DisciplineKpis,
  DisciplineAlert,
  DisciplineAlertType,
  Cohort,
} from '../../types/discipline';
import { generateId } from '../generateId';

// ---------------------------------------------------------------------------
// Alert Rule
// ---------------------------------------------------------------------------

export interface AlertRule {
  id: string;
  type: DisciplineAlertType;
  /** Optional cohort filter — only variances matching these dimensions are considered. */
  cohort?: Partial<Cohort>;
  /** The numeric threshold that triggers the alert (interpretation depends on type). */
  threshold: number;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate all alert rules against current KPIs and variances.
 * Returns an array of triggered alerts (may be empty).
 */
export function evaluateAlerts(
  rules: AlertRule[],
  kpis: DisciplineKpis,
  variances: DealVariance[],
): DisciplineAlert[] {
  const alerts: DisciplineAlert[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    let alert: DisciplineAlert | null = null;

    switch (rule.type) {
      case 'threshold_breach':
        alert = checkThresholdBreach(rule, variances);
        break;
      case 'leakage_alert':
        alert = checkLeakageAlert(rule, kpis);
        break;
      case 'originator_drift':
        alert = checkOriginatorDrift(rule, variances);
        break;
    }

    if (alert) {
      alerts.push(alert);
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Checkers
// ---------------------------------------------------------------------------

/**
 * Threshold breach: fires when the percentage of out-of-band deals
 * (within the optional cohort filter) exceeds the rule's threshold.
 *
 * threshold is expressed as a percentage (e.g. 20 means > 20% out-of-band).
 */
function checkThresholdBreach(
  rule: AlertRule,
  variances: DealVariance[],
): DisciplineAlert | null {
  const filtered = filterByCohort(variances, rule.cohort);
  if (filtered.length === 0) return null;

  const outOfBandCount = filtered.filter((v) => v.outOfBand).length;
  const outOfBandPct = (outOfBandCount / filtered.length) * 100;

  if (outOfBandPct <= rule.threshold) return null;

  return buildAlert(rule, outOfBandPct, formatCohortLabel(rule.cohort)
    ? `${outOfBandPct.toFixed(1)}% out-of-band deals in cohort ${formatCohortLabel(rule.cohort)} exceeds ${rule.threshold}% threshold`
    : `${outOfBandPct.toFixed(1)}% out-of-band deals exceeds ${rule.threshold}% threshold`,
  );
}

/**
 * Leakage alert: fires when total leakage (absolute value) exceeds the
 * rule's threshold (expressed in EUR).
 */
function checkLeakageAlert(
  rule: AlertRule,
  kpis: DisciplineKpis,
): DisciplineAlert | null {
  const absLeakage = Math.abs(kpis.totalLeakageEur);

  if (absLeakage <= rule.threshold) return null;

  return buildAlert(
    rule,
    absLeakage,
    `Total leakage ${absLeakage.toLocaleString('en-US', { maximumFractionDigits: 0 })} EUR exceeds ${rule.threshold.toLocaleString('en-US', { maximumFractionDigits: 0 })} EUR threshold`,
  );
}

/**
 * Originator drift: fires when any single originator (identified by
 * entityId on the cohort) has an average FTP variance (absolute) exceeding
 * the threshold in bps.
 *
 * Groups variances by `cohort.entityId` and checks each originator.
 */
function checkOriginatorDrift(
  rule: AlertRule,
  variances: DealVariance[],
): DisciplineAlert | null {
  const filtered = filterByCohort(variances, rule.cohort);
  if (filtered.length === 0) return null;

  // Group by entityId (originator proxy)
  const byOriginator = new Map<string, DealVariance[]>();
  for (const v of filtered) {
    const key = v.cohort.entityId ?? 'unknown';
    const group = byOriginator.get(key);
    if (group) group.push(v);
    else byOriginator.set(key, [v]);
  }

  // Find the worst originator
  let worstId: string | null = null;
  let worstAvg = 0;

  for (const [originatorId, group] of byOriginator) {
    const avgAbsFtp =
      group.reduce((sum, v) => sum + Math.abs(v.ftpVarianceBps ?? 0), 0) /
      group.length;

    if (avgAbsFtp > worstAvg) {
      worstAvg = avgAbsFtp;
      worstId = originatorId;
    }
  }

  if (worstId === null || worstAvg <= rule.threshold) return null;

  return {
    ...buildAlert(
      rule,
      worstAvg,
      `Originator ${worstId} avg FTP variance ${worstAvg.toFixed(1)} bps exceeds ${rule.threshold} bps drift threshold`,
    ),
    originatorId: worstId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Filters variances to only those matching the rule's optional cohort dimensions.
 */
function filterByCohort(
  variances: DealVariance[],
  cohort?: Partial<Cohort>,
): DealVariance[] {
  if (!cohort) return variances;

  return variances.filter((v) => {
    if (cohort.product && v.cohort.product !== cohort.product) return false;
    if (cohort.segment && v.cohort.segment !== cohort.segment) return false;
    if (cohort.tenorBucket && v.cohort.tenorBucket !== cohort.tenorBucket) return false;
    if (cohort.currency && v.cohort.currency !== cohort.currency) return false;
    if (cohort.entityId && v.cohort.entityId !== cohort.entityId) return false;
    return true;
  });
}

function formatCohortLabel(cohort?: Partial<Cohort>): string {
  if (!cohort) return '';
  const parts: string[] = [];
  if (cohort.product) parts.push(cohort.product);
  if (cohort.segment) parts.push(cohort.segment);
  if (cohort.tenorBucket) parts.push(cohort.tenorBucket);
  if (cohort.currency) parts.push(cohort.currency);
  return parts.join(' / ');
}

function buildAlert(
  rule: AlertRule,
  actualValue: number,
  message: string,
): DisciplineAlert {
  return {
    id: generateId('alert'),
    type: rule.type,
    cohort: rule.cohort
      ? {
          product: rule.cohort.product ?? '',
          segment: rule.cohort.segment ?? '',
          tenorBucket: (rule.cohort.tenorBucket as Cohort['tenorBucket']) ?? '0-1Y',
          currency: rule.cohort.currency ?? '',
          entityId: rule.cohort.entityId,
        }
      : undefined,
    message,
    threshold: rule.threshold,
    actualValue,
    triggeredAt: new Date().toISOString(),
    acknowledged: false,
  };
}
