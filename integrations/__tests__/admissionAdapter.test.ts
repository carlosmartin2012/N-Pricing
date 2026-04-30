import { describe, it, expect } from 'vitest';
import { InMemoryAdmission } from '../inMemory';
import { PuzzleAdmissionAdapter } from '../admission/puzzle';
import { adapterRegistry, _newRegistry } from '../registry';
import type { AdmissionDecisionPush, AdmissionContext, AdmissionReconciliationItem } from '../types';

const samplePush: AdmissionDecisionPush = {
  dealId:                 'deal-1',
  pricingSnapshotHash:    'h-abcdef',
  decision:               'approved',
  decidedByUser:          'user@bank.es',
  decidedAt:              '2026-04-30T10:00:00Z',
  finalClientRateBps:     485,
  rarocPp:                14.2,
  attributionLevelId:     'lvl-office',
  routingMetadata:        { deviationBps: -2, rarocPp: 14.2, volumeEur: 80_000, scope: {} },
};

const sampleContext: AdmissionContext = {
  dealId:                 'deal-1',
  clientId:               'client-1',
  internalRating:         'A',
  pdAnnual:               0.012,
  lgd:                    0.45,
  exposureEur:            500_000,
  exposureAtDefaultEur:   480_000,
  collateral:             [{ type: 'mortgage', valueEur: 200_000, ltv: 0.4 }],
  decision:               'approved',
  decidedAt:              '2026-04-29T15:00:00Z',
  notes:                  'Client tier 2',
};

// ---------------------------------------------------------------------------
// InMemoryAdmission
// ---------------------------------------------------------------------------

describe('InMemoryAdmission · push idempotente', () => {
  it('primer push genera externalId; segundo push con mismo dealId+hash devuelve mismo externalId', async () => {
    const a = new InMemoryAdmission();
    const r1 = await a.pushPricingDecision(samplePush);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = await a.pushPricingDecision(samplePush);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.externalId).toBe(r1.value.externalId);
  });

  it('dos pushes con dealIds distintos generan externalIds distintos', async () => {
    const a = new InMemoryAdmission();
    const r1 = await a.pushPricingDecision(samplePush);
    const r2 = await a.pushPricingDecision({ ...samplePush, dealId: 'deal-2' });
    if (!r1.ok || !r2.ok) throw new Error('expected ok');
    expect(r1.value.externalId).not.toBe(r2.value.externalId);
  });

  it('decisionsPushed snapshot contiene cada push (sin duplicados por dedup)', async () => {
    const a = new InMemoryAdmission();
    await a.pushPricingDecision(samplePush);
    await a.pushPricingDecision(samplePush);                              // duplicate
    await a.pushPricingDecision({ ...samplePush, dealId: 'deal-2' });
    expect(a.decisionsPushed()).toHaveLength(2);
  });
});

describe('InMemoryAdmission · context fetch', () => {
  it('devuelve null cuando el deal no está seedado', async () => {
    const a = new InMemoryAdmission();
    const r = await a.fetchAdmissionContext('not-seen');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeNull();
  });

  it('devuelve el contexto seedado', async () => {
    const a = new InMemoryAdmission();
    a.seedContext(sampleContext);
    const r = await a.fetchAdmissionContext('deal-1');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value?.internalRating).toBe('A');
    expect(r.value?.collateral).toHaveLength(1);
  });
});

describe('InMemoryAdmission · reconciliation', () => {
  it('pullReconciliation devuelve los items seedados', async () => {
    const a = new InMemoryAdmission();
    const items: AdmissionReconciliationItem[] = [
      { dealId: 'd1', pricingSnapshotHash: 'h1', ourFinalRateBps: 485, bookedRateBps: 485, diffBps: 0, bookedAt: '2026-04-30T10:00:00Z', status: 'matched' },
      { dealId: 'd2', pricingSnapshotHash: 'h2', ourFinalRateBps: 480, bookedRateBps: 482, diffBps: 2, bookedAt: '2026-04-30T10:00:00Z', status: 'mismatch_rate' },
    ];
    a.seedReconciliation(items);
    const r = await a.pullReconciliation('2026-04-30');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toHaveLength(2);
    expect(r.value[1].status).toBe('mismatch_rate');
  });
});

describe('InMemoryAdmission · health', () => {
  it('reporta ok=true', async () => {
    const a = new InMemoryAdmission();
    const h = await a.health();
    expect(h.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PuzzleAdmissionAdapter (stub)
// ---------------------------------------------------------------------------

describe('PuzzleAdmissionAdapter · stub behavior', () => {
  const config = {
    baseUrl:      'https://puzzle.bancamarch.es',
    clientId:     'client-id',
    clientSecret: 'shh',
  };

  it('throws en constructor si falta config crítica', () => {
    expect(() => new PuzzleAdmissionAdapter({ ...config, baseUrl: '' })).toThrow();
    expect(() => new PuzzleAdmissionAdapter({ ...config, clientId: '' })).toThrow();
    expect(() => new PuzzleAdmissionAdapter({ ...config, clientSecret: '' })).toThrow();
  });

  it('health reporta ok=false con el baseUrl en el message', async () => {
    const a = new PuzzleAdmissionAdapter(config);
    const h = await a.health();
    expect(h.ok).toBe(false);
    expect(h.message).toContain(config.baseUrl);
  });

  it('pushPricingDecision devuelve fail unreachable (stub)', async () => {
    const a = new PuzzleAdmissionAdapter(config);
    const r = await a.pushPricingDecision(samplePush);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('unreachable');
  });

  it('fetchAdmissionContext devuelve ok(null) (stub no encuentra nada)', async () => {
    const a = new PuzzleAdmissionAdapter(config);
    const r = await a.fetchAdmissionContext('any');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBeNull();
  });

  it('pullReconciliation devuelve ok([])', async () => {
    const a = new PuzzleAdmissionAdapter(config);
    const r = await a.pullReconciliation('2026-04-30');
    if (!r.ok) throw new Error('expected ok');
    expect(r.value).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Registry integration
// ---------------------------------------------------------------------------

describe('adapter registry · admission', () => {
  it('admission() devuelve null cuando no hay adapter', () => {
    const r = _newRegistry();
    expect(r.admission()).toBeNull();
  });

  it('admission() devuelve el adapter cuando se registra', () => {
    adapterRegistry.clear();
    const inMem = new InMemoryAdmission();
    adapterRegistry.register(inMem);
    expect(adapterRegistry.admission()).toBe(inMem);
    adapterRegistry.clear();
  });

  it('healthAll incluye el adapter de admisión', async () => {
    adapterRegistry.clear();
    adapterRegistry.register(new InMemoryAdmission());
    const all = await adapterRegistry.healthAll();
    const admission = all.find((a) => a.kind === 'admission');
    expect(admission).toBeDefined();
    expect(admission?.health.ok).toBe(true);
    adapterRegistry.clear();
  });
});
