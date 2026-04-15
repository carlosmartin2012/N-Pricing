import { describe, it, expect } from 'vitest';
import { parseArgs, DEFAULT_FLAGS } from '../../scripts/provision-tenant';

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
