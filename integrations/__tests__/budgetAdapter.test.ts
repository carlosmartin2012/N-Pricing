import { describe, it, expect } from 'vitest';
import { InMemoryBudgetSource } from '../inMemory';
import { AlquidBudgetSourceAdapter } from '../budget/alquid';
import { adapterRegistry } from '../registry';
import type { BudgetAssumption } from '../types';

const a = (over: Partial<BudgetAssumption>): BudgetAssumption => ({
  period:               '2026-04',
  segment:              'SME',
  productType:          'loan',
  currency:             'EUR',
  budgetedRateBps:      500,
  budgetedVolumeEur:    1_000_000,
  budgetedRarocPp:      14,
  externalAssumptionId: 'ALQ-1',
  fixedAt:              '2026-01-15T08:00:00Z',
  notes:                null,
  ...over,
});

describe('InMemoryBudgetSource', () => {
  it('devuelve [] si no hay supuestos seedados para el periodo', async () => {
    const adapter = new InMemoryBudgetSource();
    const r = await adapter.fetchAssumptions('2026-04');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toEqual([]);
  });

  it('seedAssumptions guarda por periodo', async () => {
    const adapter = new InMemoryBudgetSource();
    adapter.seedAssumptions('2026-04', [a({})]);
    const r = await adapter.fetchAssumptions('2026-04');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toHaveLength(1);
    const r2 = await adapter.fetchAssumptions('2026-05');
    if (!r2.ok) throw new Error('expected ok');
    expect(r2.value).toEqual([]);
  });

  it('health ok=true', async () => {
    const adapter = new InMemoryBudgetSource();
    expect((await adapter.health()).ok).toBe(true);
  });
});

describe('AlquidBudgetSourceAdapter · stub', () => {
  const config = { baseUrl: 'https://alquid.nfq.es', clientId: 'cid', clientSecret: 'shh' };

  it('throws si falta config crítica', () => {
    expect(() => new AlquidBudgetSourceAdapter({ ...config, baseUrl:      '' })).toThrow();
    expect(() => new AlquidBudgetSourceAdapter({ ...config, clientId:     '' })).toThrow();
    expect(() => new AlquidBudgetSourceAdapter({ ...config, clientSecret: '' })).toThrow();
  });

  it('health reporta ok=false con baseUrl en mensaje', async () => {
    const adapter = new AlquidBudgetSourceAdapter(config);
    const h = await adapter.health();
    expect(h.ok).toBe(false);
    expect(h.message).toContain(config.baseUrl);
  });

  it('fetchAssumptions devuelve ok([]) en stub', async () => {
    const adapter = new AlquidBudgetSourceAdapter(config);
    const r = await adapter.fetchAssumptions('2026-04');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toEqual([]);
  });
});

describe('adapter registry · budget', () => {
  it('budget() resuelve cuando se registra', () => {
    adapterRegistry.clear();
    const adapter = new InMemoryBudgetSource();
    adapterRegistry.register(adapter);
    expect(adapterRegistry.budget()).toBe(adapter);
    adapterRegistry.clear();
  });
});
