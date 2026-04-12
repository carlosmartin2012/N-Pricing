import type { AlertOperator, AlertRule } from '../types/alertRule';
import type { Transaction } from '../types';

export interface AlertEvaluation {
  rule: AlertRule;
  triggered: boolean;
  currentValue: number;
  message: string;
}

function compare(value: number, operator: AlertOperator, threshold: number): boolean {
  switch (operator) {
    case 'gt': return value > threshold;
    case 'lt': return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    case 'eq': return value === threshold;
  }
}

const OPERATOR_LABELS: Record<AlertOperator, string> = {
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
  eq: '=',
};

/** Built-in metric extractors from portfolio deals */
const METRIC_EXTRACTORS: Record<string, (deals: Transaction[]) => number> = {
  portfolio_deal_count: (deals) => deals.length,

  portfolio_total_volume: (deals) =>
    deals.reduce((sum, d) => sum + (d.amount || 0), 0),

  portfolio_avg_margin: (deals) => {
    const booked = deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');
    if (booked.length === 0) return 0;
    return booked.reduce((sum, d) => sum + (d.marginTarget || 0), 0) / booked.length;
  },

  pending_approval_count: (deals) =>
    deals.filter((d) => d.status === 'Pending_Approval').length,

  rejected_count: (deals) =>
    deals.filter((d) => d.status === 'Rejected').length,

  draft_count: (deals) =>
    deals.filter((d) => d.status === 'Draft').length,
};

/**
 * Evaluate a set of alert rules against the current portfolio.
 * Returns evaluations for all rules, indicating which triggered.
 */
export function evaluateAlerts(
  rules: AlertRule[],
  deals: Transaction[],
  extraMetrics?: Record<string, number>,
): AlertEvaluation[] {
  return rules
    .filter((rule) => rule.isActive)
    .map((rule) => {
      const extractor = METRIC_EXTRACTORS[rule.metricName];
      const currentValue = extractor
        ? extractor(deals)
        : extraMetrics?.[rule.metricName] ?? 0;

      const triggered = compare(currentValue, rule.operator, rule.threshold);
      const opLabel = OPERATOR_LABELS[rule.operator];

      return {
        rule,
        triggered,
        currentValue,
        message: triggered
          ? `${rule.name}: ${rule.metricName} is ${currentValue.toFixed(2)} (${opLabel} ${rule.threshold})`
          : `${rule.name}: OK (${currentValue.toFixed(2)} ${opLabel} ${rule.threshold})`,
      };
    });
}

/** Pre-built alert rule templates for quick setup */
export const ALERT_TEMPLATES: Omit<AlertRule, 'id' | 'entityId' | 'lastTriggeredAt' | 'createdAt'>[] = [
  {
    name: 'High pending approvals',
    metricName: 'pending_approval_count',
    operator: 'gte',
    threshold: 5,
    recipients: [],
    isActive: true,
  },
  {
    name: 'Rejected deals > 0',
    metricName: 'rejected_count',
    operator: 'gt',
    threshold: 0,
    recipients: [],
    isActive: true,
  },
  {
    name: 'Portfolio volume > 100M',
    metricName: 'portfolio_total_volume',
    operator: 'gt',
    threshold: 100_000_000,
    recipients: [],
    isActive: true,
  },
  {
    name: 'Avg margin below 1%',
    metricName: 'portfolio_avg_margin',
    operator: 'lt',
    threshold: 1.0,
    recipients: [],
    isActive: true,
  },
];
