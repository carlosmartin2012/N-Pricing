import { describe, it, expect } from 'vitest';
import { parseArgs, DEFAULT_FLAGS, DEFAULT_ALERT_RULES } from '../../scripts/provision-tenant';

describe('provision-tenant parseArgs', () => {
  it('parses long-form args', () => {
    const args = parseArgs([
      '--short-code', 'BBVA-ES',
      '--name', 'BBVA España',
      '--legal-name', 'BBVA, S.A.',
      '--country', 'ES',
      '--currency', 'EUR',
      '--admin-email', 'admin@bbva.es',
    ]);
    expect(args.shortCode).toBe('BBVA-ES');
    expect(args.name).toBe('BBVA España');
    expect(args.legalName).toBe('BBVA, S.A.');
    expect(args.country).toBe('ES');
    expect(args.currency).toBe('EUR');
    expect(args.adminEmail).toBe('admin@bbva.es');
  });

  it('falls back to ES/EUR defaults when not provided', () => {
    const args = parseArgs([
      '--short-code', 'X', '--name', 'X', '--admin-email', 'x@x',
    ]);
    expect(args.country).toBe('ES');
    expect(args.currency).toBe('EUR');
  });
});

describe('default feature flags', () => {
  it('includes the four canonical flags', () => {
    const flags = DEFAULT_FLAGS.map((f) => f.flag).sort();
    expect(flags).toEqual([
      'ai_assistant_enabled',
      'channel_api_enabled',
      'kill_switch',
      'pricing_enabled',
    ]);
  });

  it('kill_switch defaults off, pricing_enabled defaults on', () => {
    const kill = DEFAULT_FLAGS.find((f) => f.flag === 'kill_switch');
    const pricing = DEFAULT_FLAGS.find((f) => f.flag === 'pricing_enabled');
    expect(kill?.enabled).toBe(false);
    expect(pricing?.enabled).toBe(true);
  });
});

describe('default alert rules (Ola 6 Bloque A)', () => {
  it('seeds the 3 canonical rules required before tenancy strict flip', () => {
    const names = DEFAULT_ALERT_RULES.map((r) => r.name).sort();
    expect(names).toEqual([
      'pricing p95 breach',
      'snapshot write failure',
      'tenancy violation',
    ]);
  });

  it('matches the severity/channel routing from migration 20260619000004', () => {
    const byName = new Map(DEFAULT_ALERT_RULES.map((r) => [r.name, r]));

    expect(byName.get('pricing p95 breach')).toMatchObject({
      channelType: 'slack',
      severity: 'warning',
      threshold: 300,
      metricName: 'pricing_single_latency_ms',
    });
    expect(byName.get('tenancy violation')).toMatchObject({
      channelType: 'pagerduty',
      severity: 'critical',
      threshold: 0,
      metricName: 'tenancy_violations_total',
    });
    expect(byName.get('snapshot write failure')).toMatchObject({
      channelType: 'pagerduty',
      severity: 'page',
      threshold: 0,
      metricName: 'snapshot_write_failures_total',
    });
  });

  it('uses operator="gt" with a NOW() − 5m window for all 3 rules', () => {
    for (const rule of DEFAULT_ALERT_RULES) {
      expect(rule.operator).toBe('gt');
      expect(rule.windowSeconds).toBe(300);
    }
  });
});
