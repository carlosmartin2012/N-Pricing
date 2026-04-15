import {
  ok, fail,
  type CoreBankingAdapter, type CoreBankingDeal,
  type CrmAdapter, type CrmCustomer,
  type MarketDataAdapter, type MarketYieldCurveSnapshot,
  type AdapterHealth, type AdapterResult,
} from './types';

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

  async health(): Promise<AdapterHealth> {
    return { ok: true, latencyMs: 0, checkedAt: nowIso() };
  }

  seed(customers: CrmCustomer[]): void {
    for (const c of customers) this.customers.set(c.id, c);
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
}
