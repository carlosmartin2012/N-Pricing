import {
  ok, fail,
  type CoreBankingAdapter, type CoreBankingDeal,
  type CrmAdapter, type CrmCustomer, type CrmPulledEvent,
  type MarketDataAdapter, type MarketYieldCurveSnapshot, type ShockedCurveScenarioId,
  type AdmissionAdapter, type AdmissionContext, type AdmissionDecisionPush, type AdmissionReconciliationItem,
  type AdapterHealth, type AdapterResult,
} from './types';
import { computeEbaCurveShift } from '../utils/pricing/shockPresets';
import type { ShockTenor } from '../types/pricingShocks';

/**
 * Reference in-memory adapters. Used by tests and by `npm run dev` when no
 * external integration is configured. Production deployments register a real
 * adapter (T24, Salesforce, Bloomberg) instead.
 */

function nowIso(): string { return new Date().toISOString(); }

export class InMemoryCoreBanking implements CoreBankingAdapter {
  readonly kind = 'core_banking' as const;
  readonly name = 'in-memory';
  private deals = new Map<string, CoreBankingDeal[]>();   // by clientId
  private booked = new Map<string, CoreBankingDeal>();

  async health(): Promise<AdapterHealth> {
    return { ok: true, latencyMs: 0, checkedAt: nowIso() };
  }

  seed(clientId: string, deals: CoreBankingDeal[]): void {
    this.deals.set(clientId, deals);
  }

  async fetchActiveDeals(clientId: string): Promise<AdapterResult<CoreBankingDeal[]>> {
    const list = this.deals.get(clientId) ?? [];
    return ok(list.filter((d) => d.status === 'Active'));
  }

  async upsertBookedDeal(deal: CoreBankingDeal): Promise<AdapterResult<{ externalId: string }>> {
    if (!deal.id || !deal.clientId) {
      return fail('parse_error', 'deal must have id and clientId');
    }
    this.booked.set(deal.id, deal);
    const list = this.deals.get(deal.clientId) ?? [];
    const idx = list.findIndex((d) => d.id === deal.id);
    if (idx >= 0) list[idx] = deal; else list.push(deal);
    this.deals.set(deal.clientId, list);
    return ok({ externalId: deal.id });
  }
}

export class InMemoryCrm implements CrmAdapter {
  readonly kind = 'crm' as const;
  readonly name = 'in-memory';
  private customers = new Map<string, CrmCustomer>();
  private events = new Map<string, CrmPulledEvent[]>();       // by clientExternalId

  async health(): Promise<AdapterHealth> {
    return { ok: true, latencyMs: 0, checkedAt: nowIso() };
  }

  seed(customers: CrmCustomer[]): void {
    for (const c of customers) this.customers.set(c.id, c);
  }

  seedEvents(clientExternalId: string, events: CrmPulledEvent[]): void {
    this.events.set(clientExternalId, [...(this.events.get(clientExternalId) ?? []), ...events]);
  }

  async fetchCustomer(externalId: string): Promise<AdapterResult<CrmCustomer | null>> {
    return ok(this.customers.get(externalId) ?? null);
  }

  async searchCustomers(query: string, limit = 25): Promise<AdapterResult<CrmCustomer[]>> {
    const q = query.toLowerCase();
    const matches: CrmCustomer[] = [];
    for (const c of this.customers.values()) {
      if (matches.length >= limit) break;
      if (c.name.toLowerCase().includes(q) || c.id.includes(q)) matches.push(c);
    }
    return ok(matches);
  }

  async pullCrmEvents(
    clientExternalId: string,
    since?: string,
  ): Promise<AdapterResult<CrmPulledEvent[]>> {
    const all = this.events.get(clientExternalId) ?? [];
    if (!since) return ok([...all]);
    return ok(all.filter((e) => e.occurredAt > since));
  }
}

export class InMemoryMarketData implements MarketDataAdapter {
  readonly kind = 'market_data' as const;
  readonly name = 'in-memory';
  private curves = new Map<string, MarketYieldCurveSnapshot>();   // currency → latest
  private fx = new Map<string, number>();                         // 'EUR/USD' → rate

  async health(): Promise<AdapterHealth> {
    return { ok: true, latencyMs: 0, checkedAt: nowIso() };
  }

  seedCurve(snapshot: MarketYieldCurveSnapshot): void {
    this.curves.set(snapshot.currency, snapshot);
  }

  seedFx(base: string, quote: string, rate: number): void {
    this.fx.set(`${base}/${quote}`, rate);
  }

  async fetchYieldCurve(currency: string): Promise<AdapterResult<MarketYieldCurveSnapshot>> {
    const c = this.curves.get(currency);
    if (!c) return fail('not_found', `no curve for ${currency}`);
    return ok(c);
  }

  async fetchFxRate(base: string, quote: string): Promise<AdapterResult<number>> {
    if (base === quote) return ok(1);
    const r = this.fx.get(`${base}/${quote}`);
    if (r !== undefined) return ok(r);
    const inverse = this.fx.get(`${quote}/${base}`);
    if (inverse !== undefined && inverse !== 0) return ok(1 / inverse);
    return fail('not_found', `no FX rate ${base}/${quote}`);
  }

  async fetchShockedCurve(
    scenarioId: ShockedCurveScenarioId,
    currency: string,
    _asOfDate?: string,
  ): Promise<AdapterResult<MarketYieldCurveSnapshot>> {
    const base = this.curves.get(currency);
    if (!base) return fail('not_found', `no base curve for ${currency}`);
    const shifts = computeEbaCurveShift(scenarioId);
    const shiftedPoints = base.points.map((p) => {
      const shiftBps = shifts[p.tenor as ShockTenor];
      if (shiftBps === undefined) return { ...p };
      // Shifts are bps; curve points store rates in percent. bps → percent = /100.
      return { ...p, rate: p.rate + shiftBps / 100 };
    });
    return ok({
      currency: base.currency,
      asOfDate: base.asOfDate,
      source: `${base.source} +eba:${scenarioId}`,
      points: shiftedPoints,
    });
  }
}

/**
 * In-memory Admission adapter (Ola 9). Idempotente por (dealId,
 * pricingSnapshotHash) — un push duplicado devuelve el mismo externalId.
 * Tests pueden seedar contextos via `seedContext` y leer las decisiones
 * pushed via `decisionsPushed` (snapshot inmutable).
 */
export class InMemoryAdmission implements AdmissionAdapter {
  readonly kind = 'admission' as const;
  readonly name = 'in-memory-admission';

  private contexts = new Map<string, AdmissionContext>();
  /** dedupKey → { decision, externalId } — preserva el externalId asignado
   *  en el primer push para garantizar idempotencia. */
  private pushed = new Map<string, { decision: AdmissionDecisionPush; externalId: string }>();
  private reconciliation: AdmissionReconciliationItem[] = [];
  private nextExternalSeq = 1;

  async health(): Promise<AdapterHealth> {
    return { ok: true, latencyMs: 0, checkedAt: nowIso() };
  }

  seedContext(ctx: AdmissionContext): void {
    this.contexts.set(ctx.dealId, ctx);
  }

  seedReconciliation(items: AdmissionReconciliationItem[]): void {
    this.reconciliation = [...items];
  }

  /** Snapshot inmutable de las decisiones empujadas. Útil en tests. */
  decisionsPushed(): AdmissionDecisionPush[] {
    return Array.from(this.pushed.values()).map((entry) => entry.decision);
  }

  async pushPricingDecision(
    decision: AdmissionDecisionPush,
  ): Promise<AdapterResult<{ externalId: string | null }>> {
    const dedupKey = `${decision.dealId}:${decision.pricingSnapshotHash}`;
    const existing = this.pushed.get(dedupKey);
    if (existing) {
      // Idempotencia: devuelve el externalId asignado en el primer push.
      return ok({ externalId: existing.externalId });
    }
    const externalId = `puzzle-mem-${this.nextExternalSeq++}`;
    this.pushed.set(dedupKey, { decision, externalId });
    return ok({ externalId });
  }

  async fetchAdmissionContext(
    dealId: string,
  ): Promise<AdapterResult<AdmissionContext | null>> {
    return ok(this.contexts.get(dealId) ?? null);
  }

  async pullReconciliation(
    _asOfDate: string,
  ): Promise<AdapterResult<AdmissionReconciliationItem[]>> {
    return ok(this.reconciliation);
  }
}
