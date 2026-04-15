import { describe, it, expect, vi } from 'vitest';
import {
  evaluateAlerts,
  shouldTrigger,
  type EvaluatorDeps,
  type EvaluatorRule,
} from '../../server/workers/alertEvaluatorCore';

function makeRule(overrides: Partial<EvaluatorRule> = {}): EvaluatorRule {
  return {
    id: 'rule-1',
    entityId: 'entity-1',
    name: 'Latency warning',
    metricName: 'pricing_single_latency_ms',
    operator: 'gt',
    threshold: 300,
    severity: 'warning',
    windowSeconds: 3600,
    cooldownSeconds: 300,
    channelType: 'email',
    channelConfig: { recipients: ['ops@example.com'] },
    isActive: true,
    lastTriggeredAt: null,
    ...overrides,
  };
}

describe('shouldTrigger', () => {
  const now = new Date('2026-04-15T10:00:00Z');

  it('triggers when value breaches operator/threshold', () => {
    const r = makeRule({ operator: 'gt', threshold: 300 });
    expect(shouldTrigger(r, 500, now)).toEqual({ breach: true, coolingDown: false });
  });

  it('does not trigger when value is below threshold (gt)', () => {
    const r = makeRule({ operator: 'gt', threshold: 300 });
    expect(shouldTrigger(r, 200, now)).toEqual({ breach: false, coolingDown: false });
  });

  it('respects cooldown when last triggered was recent', () => {
    const r = makeRule({
      operator: 'gt',
      threshold: 300,
      cooldownSeconds: 600,
      lastTriggeredAt: new Date('2026-04-15T09:59:00Z'), // 60s ago
    });
    expect(shouldTrigger(r, 500, now)).toEqual({ breach: true, coolingDown: true });
  });

  it('allows re-trigger once cooldown has elapsed', () => {
    const r = makeRule({
      operator: 'gt',
      threshold: 300,
      cooldownSeconds: 60,
      lastTriggeredAt: new Date('2026-04-15T09:58:00Z'), // 120s ago
    });
    expect(shouldTrigger(r, 500, now)).toEqual({ breach: true, coolingDown: false });
  });

  it('handles eq operator correctly', () => {
    const r = makeRule({ operator: 'eq', threshold: 0 });
    expect(shouldTrigger(r, 0, now).breach).toBe(true);
    expect(shouldTrigger(r, 1, now).breach).toBe(false);
  });
});

describe('evaluateAlerts', () => {
  const fixedNow = new Date('2026-04-15T10:00:00Z');

  function makeDeps(overrides: Partial<EvaluatorDeps> = {}): EvaluatorDeps {
    return {
      loadRules: vi.fn(async () => []),
      lookupMetric: vi.fn(async () => ({ value: 0, sampleCount: 0 })),
      dispatch: vi.fn(async () => ({ status: 'sent' as const, payload: {} })),
      record: vi.fn(async () => {}),
      touchTriggered: vi.fn(async () => {}),
      now: () => fixedNow,
      ...overrides,
    };
  }

  it('reports zero when no rules exist', async () => {
    const deps = makeDeps();
    const report = await evaluateAlerts(deps);
    expect(report).toEqual({ total: 0, triggered: 0, coolingDown: 0, delivered: 0, failed: 0, errors: [] });
  });

  it('delivers alerts for rules that breach and records invocation', async () => {
    const rule = makeRule();
    const deps = makeDeps({
      loadRules: vi.fn(async () => [rule]),
      lookupMetric: vi.fn(async () => ({ value: 500, sampleCount: 42 })),
    });
    const report = await evaluateAlerts(deps);
    expect(report.triggered).toBe(1);
    expect(report.delivered).toBe(1);
    expect(report.failed).toBe(0);
    expect(deps.dispatch).toHaveBeenCalledOnce();
    expect(deps.record).toHaveBeenCalledOnce();
    expect(deps.touchTriggered).toHaveBeenCalledWith(rule.id, fixedNow);
  });

  it('skips rules that are not active', async () => {
    const rule = makeRule({ isActive: false });
    const deps = makeDeps({ loadRules: vi.fn(async () => [rule]) });
    const report = await evaluateAlerts(deps);
    expect(report.triggered).toBe(0);
    expect(deps.lookupMetric).not.toHaveBeenCalled();
  });

  it('skips rules whose metric is below threshold', async () => {
    const rule = makeRule();
    const deps = makeDeps({
      loadRules: vi.fn(async () => [rule]),
      lookupMetric: vi.fn(async () => ({ value: 100, sampleCount: 5 })),
    });
    const report = await evaluateAlerts(deps);
    expect(report.triggered).toBe(0);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch when the rule is cooling down', async () => {
    const rule = makeRule({
      cooldownSeconds: 600,
      lastTriggeredAt: new Date('2026-04-15T09:59:00Z'),
    });
    const deps = makeDeps({
      loadRules: vi.fn(async () => [rule]),
      lookupMetric: vi.fn(async () => ({ value: 500, sampleCount: 42 })),
    });
    const report = await evaluateAlerts(deps);
    expect(report.triggered).toBe(0);
    expect(report.coolingDown).toBe(1);
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it('records failed deliveries but does NOT bump last_triggered_at', async () => {
    const rule = makeRule();
    const deps = makeDeps({
      loadRules: vi.fn(async () => [rule]),
      lookupMetric: vi.fn(async () => ({ value: 500, sampleCount: 42 })),
      dispatch: vi.fn(async () => ({ status: 'failed' as const, error: 'timeout', payload: {} })),
    });
    const report = await evaluateAlerts(deps);
    expect(report.failed).toBe(1);
    expect(report.delivered).toBe(0);
    expect(deps.touchTriggered).not.toHaveBeenCalled();
  });

  it('captures per-rule errors without aborting the batch', async () => {
    const rules = [makeRule({ id: 'r1' }), makeRule({ id: 'r2' })];
    const deps = makeDeps({
      loadRules: vi.fn(async () => rules),
      lookupMetric: vi.fn(async (rule: EvaluatorRule) => {
        if (rule.id === 'r1') throw new Error('flaky metric');
        return { value: 500, sampleCount: 42 };
      }),
    });
    const report = await evaluateAlerts(deps);
    expect(report.errors).toEqual([{ ruleId: 'r1', error: 'flaky metric' }]);
    expect(report.triggered).toBe(1); // r2 still processed
  });
});
