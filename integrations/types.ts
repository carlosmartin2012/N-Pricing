/**
 * Phase 4 — Integration adapter interfaces.
 *
 * Three connector families:
 *   1. CoreBankingAdapter — fetch live portfolio, persist booked deals
 *   2. CrmAdapter         — pull customer master + relationship metadata
 *   3. MarketDataAdapter  — yield curves, FX, benchmarks
 *
 * Concrete implementations live in separate files (in-memory reference
 * adapter ships in this sprint so the rest of the system can develop
 * against the interface; T24 / Salesforce / Bloomberg adapters are stubs
 * the bank's IT team plugs in).
 *
 * Every adapter:
 *   - reports its `kind` (used by the registry)
 *   - exposes a `health()` probe for the integrations dashboard
 *   - never throws on transport failure — returns a Result<T, AdapterError>
 */

export type AdapterKind = 'core_banking' | 'crm' | 'market_data';

export interface AdapterHealth {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  checkedAt: string;
}

export interface AdapterError {
  code: 'unreachable' | 'auth' | 'rate_limited' | 'not_found' | 'parse_error' | 'unknown';
  message: string;
  cause?: unknown;
}

export type AdapterResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AdapterError };

export const ok = <T>(value: T): AdapterResult<T> => ({ ok: true, value });
export const fail = (
  code: AdapterError['code'],
  message: string,
  cause?: unknown,
): AdapterResult<never> => ({ ok: false, error: { code, message, cause } });

// ---------- Core banking ----------

export interface CoreBankingDeal {
  id: string;
  clientId: string;
  productType: string;
  amount: number;
  currency: string;
  startDate: string;
  maturityDate: string | null;
  marginBps: number | null;
  status: 'Active' | 'Matured' | 'Cancelled';
}

export interface CoreBankingAdapter {
  kind: 'core_banking';
  name: string;
  health(): Promise<AdapterHealth>;
  fetchActiveDeals(clientId: string): Promise<AdapterResult<CoreBankingDeal[]>>;
  upsertBookedDeal(deal: CoreBankingDeal): Promise<AdapterResult<{ externalId: string }>>;
}

// ---------- CRM ----------

export interface CrmCustomer {
  id: string;
  name: string;
  segment: string;
  rating: string | null;
  countryCode: string;
  relationshipStartDate: string | null;
  email: string | null;
  phone: string | null;
  attributes: Record<string, unknown>;
}

export interface CrmAdapter {
  kind: 'crm';
  name: string;
  health(): Promise<AdapterHealth>;
  fetchCustomer(externalId: string): Promise<AdapterResult<CrmCustomer | null>>;
  searchCustomers(query: string, limit?: number): Promise<AdapterResult<CrmCustomer[]>>;
}

// ---------- Market data ----------

export interface MarketYieldCurvePoint {
  tenor: string;     // '3M', '1Y', '5Y'
  rate: number;
}

export interface MarketYieldCurveSnapshot {
  currency: string;
  asOfDate: string;
  source: string;
  points: MarketYieldCurvePoint[];
}

export interface MarketDataAdapter {
  kind: 'market_data';
  name: string;
  health(): Promise<AdapterHealth>;
  fetchYieldCurve(currency: string, asOfDate?: string): Promise<AdapterResult<MarketYieldCurveSnapshot>>;
  fetchFxRate(base: string, quote: string, asOfDate?: string): Promise<AdapterResult<number>>;
}

export type AnyAdapter = CoreBankingAdapter | CrmAdapter | MarketDataAdapter;
