import type {
  AlertChannelConfig,
  AlertChannelType,
  AlertSeverity,
} from '../../types/phase0';
import type { AlertContext, DeliveryResult } from '../integrations/alertChannels';

/**
 * Pure core of the alert evaluator. No Postgres, no network, no setInterval.
 * The runtime adapters in `./alertEvaluator.ts` plug the real dependencies in.
 * Kept import-free from `../db` so tests can import without a DATABASE_URL.
 */

export interface EvaluatorRule {
  id: string;
  entityId: string;
  entityName?: string;
  name: string;
  metricName: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  severity: AlertSeverity;
  windowSeconds: number;
  cooldownSeconds: number;
  channelType: AlertChannelType;
  channelConfig: AlertChannelConfig;
  isActive: boolean;
  lastTriggeredAt: Date | null;
}

export interface MetricLookup {
  (rule: EvaluatorRule, now: Date): Promise<{ value: number; sampleCount: number }>;
}

export interface RecordInvocation {
  (params: {
    rule: EvaluatorRule;
    metricValue: number;
    delivery: DeliveryResult;
    triggeredAt: Date;
  }): Promise<void>;
}

export interface LoadRules { (): Promise<EvaluatorRule[]>; }
export interface TouchRuleTriggered { (ruleId: string, triggeredAt: Date): Promise<void>; }

export interface EvaluatorDeps {
  loadRules:       LoadRules;
  lookupMetric:    MetricLookup;
  dispatch:        (type: AlertChannelType, config: AlertChannelConfig, ctx: AlertContext) => Promise<DeliveryResult>;
  record:          RecordInvocation;
  touchTriggered:  TouchRuleTriggered;
  now:             () => Date;
}

function compare(op: EvaluatorRule['operator'], value: number, threshold: number): boolean {
  switch (op) {
    case 'gt':  return value >  threshold;
    case 'gte': return value >= threshold;
    case 'lt':  return value <  threshold;
    case 'lte': return value <= threshold;
    case 'eq':  return value === threshold;
  }
}

export function shouldTrigger(rule: EvaluatorRule, metricValue: number, now: Date): {
  breach: boolean;
  coolingDown: boolean;
} {
  const breach = compare(rule.operator, metricValue, rule.threshold);
  if (!breach) return { breach: false, coolingDown: false };
  if (!rule.lastTriggeredAt) return { breach: true, coolingDown: false };
  const elapsedSec = (now.getTime() - rule.lastTriggeredAt.getTime()) / 1000;
  return { breach: true, coolingDown: elapsedSec < rule.cooldownSeconds };
}

export interface EvaluationReport {
  total: number;
  triggered: number;
  coolingDown: number;
  delivered: number;
  failed: number;
  errors: Array<{ ruleId: string; error: string }>;
}

export async function evaluateAlerts(deps: EvaluatorDeps): Promise<EvaluationReport> {
  const now = deps.now();
  const rules = await deps.loadRules();
  const report: EvaluationReport = {
    total: rules.length,
    triggered: 0,
    coolingDown: 0,
    delivered: 0,
    failed: 0,
    errors: [],
  };

  for (const rule of rules) {
    if (!rule.isActive) continue;
    try {
      const { value } = await deps.lookupMetric(rule, now);
      const { breach, coolingDown } = shouldTrigger(rule, value, now);

      if (!breach) continue;
      if (coolingDown) {
        report.coolingDown++;
        continue;
      }

      report.triggered++;

      const ctx: AlertContext = {
        ruleId:        rule.id,
        ruleName:      rule.name,
        entityId:      rule.entityId,
        entityName:    rule.entityName,
        sli:           rule.metricName,
        severity:      rule.severity,
        operator:      rule.operator,
        threshold:     rule.threshold,
        metricValue:   value,
        windowSeconds: rule.windowSeconds,
        triggeredAt:   now.toISOString(),
      };

      const delivery = await deps.dispatch(rule.channelType, rule.channelConfig, ctx);
      await deps.record({ rule, metricValue: value, delivery, triggeredAt: now });

      if (delivery.status === 'sent') {
        report.delivered++;
        await deps.touchTriggered(rule.id, now);
      } else {
        report.failed++;
      }
    } catch (err) {
      report.errors.push({
        ruleId: rule.id,
        error: err instanceof Error ? err.message : 'unknown evaluator error',
      });
    }
  }

  return report;
}
