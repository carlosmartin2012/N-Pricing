// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { adapterRegistry } from '../../integrations/registry';
import { bootstrapAdapters } from '../../server/integrations/bootstrap';

// Snapshot env y restoremos en cada test — el guard inspecciona
// `NODE_ENV` y `PRICING_ALLOW_MOCKS` directamente.
const ENV_KEYS_TO_TRACK = [
  'NODE_ENV', 'PRICING_ALLOW_MOCKS',
  'ADAPTER_CORE_BANKING', 'BM_HOST_SFTP_HOST', 'BM_HOST_SFTP_USER', 'BM_HOST_SFTP_PRIVATE_KEY_PEM',
  'ADAPTER_CRM',          'SALESFORCE_INSTANCE_URL', 'SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET',
  'ADAPTER_MARKET_DATA',  'BLOOMBERG_APP_NAME',
  'ADAPTER_ADMISSION',    'PUZZLE_BASE_URL', 'PUZZLE_CLIENT_ID', 'PUZZLE_CLIENT_SECRET',
  'ADAPTER_BUDGET',       'ALQUID_BASE_URL', 'ALQUID_CLIENT_ID', 'ALQUID_CLIENT_SECRET',
];

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS_TO_TRACK) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
  adapterRegistry.clear();
});

afterEach(() => {
  for (const k of ENV_KEYS_TO_TRACK) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

// ---------------------------------------------------------------------------
// Default behaviour — sin ADAPTER_* setados, registra in-memory de los 5.
// ---------------------------------------------------------------------------

describe('bootstrapAdapters · default in-memory', () => {
  it('sin ADAPTER_* setados → registra los 5 adapters in-memory sin warn ni throw', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => bootstrapAdapters()).not.toThrow();
    expect(adapterRegistry.coreBanking()?.name).toContain('in-memory');
    expect(adapterRegistry.crm()?.name).toContain('in-memory');
    expect(adapterRegistry.marketData()?.name).toContain('in-memory');
    expect(adapterRegistry.admission()?.name).toContain('in-memory');
    expect(adapterRegistry.budget()?.name).toContain('in-memory');
    // Sin ADAPTER_* set, NO debe haber warn — esto es el path "fresh dev"
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Fail-loud guard (Ola 10.3 fix #3) — adapter real pedido + faltan creds.
// ---------------------------------------------------------------------------

describe('bootstrapAdapters · fail-loud cuando ADAPTER_*=real sin credenciales', () => {
  // Tabla de los 5 adapters que tienen variantes "real" con guard
  const SCENARIOS = [
    { kind: 'CORE_BANKING', requested: 'bm-host',    creds: 'BM_HOST_SFTP_HOST/USER/PRIVATE_KEY' },
    { kind: 'CRM',          requested: 'salesforce', creds: 'SALESFORCE_INSTANCE_URL/CLIENT_ID/CLIENT_SECRET' },
    { kind: 'MARKET_DATA',  requested: 'bloomberg',  creds: 'BLOOMBERG_APP_NAME' },
    { kind: 'ADMISSION',    requested: 'puzzle',     creds: 'PUZZLE_BASE_URL/CLIENT_ID/CLIENT_SECRET' },
    { kind: 'BUDGET',       requested: 'alquid',     creds: 'ALQUID_BASE_URL/CLIENT_ID/CLIENT_SECRET' },
  ];

  it.each(SCENARIOS)(
    'NODE_ENV=production + ADAPTER_$kind=$requested + sin creds + sin PRICING_ALLOW_MOCKS → throw',
    ({ kind, requested, creds }) => {
      process.env.NODE_ENV = 'production';
      process.env[`ADAPTER_${kind}`] = requested;
      // PRICING_ALLOW_MOCKS NO set → el guard debe disparar

      expect(() => bootstrapAdapters()).toThrow(
        new RegExp(`ADAPTER_${kind}=${requested}.*${creds.replace(/\//g, '\\/')}.*refusing to fall back`),
      );
    },
  );

  it.each(SCENARIOS)(
    'NODE_ENV=production + ADAPTER_$kind=$requested + sin creds + PRICING_ALLOW_MOCKS=true → warn + fallback',
    ({ kind, requested }) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      process.env.NODE_ENV = 'production';
      process.env.PRICING_ALLOW_MOCKS = 'true';
      process.env[`ADAPTER_${kind}`] = requested;

      expect(() => bootstrapAdapters()).not.toThrow();
      // Verifica que se registró un adapter (in-memory) — el getter lo expone
      const getter: Record<string, () => { name: string } | null> = {
        CORE_BANKING: () => adapterRegistry.coreBanking(),
        CRM:          () => adapterRegistry.crm(),
        MARKET_DATA:  () => adapterRegistry.marketData(),
        ADMISSION:    () => adapterRegistry.admission(),
        BUDGET:       () => adapterRegistry.budget(),
      };
      expect(getter[kind]()?.name).toContain('in-memory');
      // Y debe haber loggeado el warn
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      expect(warnCalls.some((m) => m.includes(`ADAPTER_${kind}=${requested}`))).toBe(true);
      warnSpy.mockRestore();
    },
  );

  it.each(SCENARIOS)(
    'NODE_ENV=development + ADAPTER_$kind=$requested + sin creds → warn + fallback (sin throw)',
    ({ kind, requested }) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      process.env.NODE_ENV = 'development';
      process.env[`ADAPTER_${kind}`] = requested;

      expect(() => bootstrapAdapters()).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    },
  );
});

// ---------------------------------------------------------------------------
// Path positivo — credenciales presentes, registra el adapter real.
// ---------------------------------------------------------------------------

describe('bootstrapAdapters · adapter real con credenciales', () => {
  it('ADAPTER_CRM=salesforce + creds completas → registra Salesforce real (sin warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    process.env.NODE_ENV = 'production';
    process.env.ADAPTER_CRM = 'salesforce';
    process.env.SALESFORCE_INSTANCE_URL = 'https://example.my.salesforce.com';
    process.env.SALESFORCE_CLIENT_ID = 'client-id';
    process.env.SALESFORCE_CLIENT_SECRET = 'client-secret';

    expect(() => bootstrapAdapters()).not.toThrow();
    // El adapter Salesforce stubbed identifica por name
    expect(adapterRegistry.crm()?.name).not.toContain('in-memory');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
