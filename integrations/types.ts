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

export type AdapterKind = 'core_banking' | 'crm' | 'market_data' | 'admission';

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

/**
 * Events pulled from the CRM — contact, claim, churn signal, etc. Used by
 * the CLV timeline worker to hydrate `client_events` without requiring the
 * banker to log actions twice. Optional on the interface for backwards
 * compatibility with adapters that only expose the customer master.
 */
export type CrmEventKind =
  | 'contact'
  | 'churn_signal'
  | 'claim'
  | 'crosssell_attempt'
  | 'crosssell_won'
  | 'committee_review';

export interface CrmPulledEvent {
  externalId: string;
  clientExternalId: string;
  kind: CrmEventKind;
  occurredAt: string;                 // ISO timestamp
  amountEur?: number | null;
  payload: Record<string, unknown>;
}

export interface CrmAdapter {
  kind: 'crm';
  name: string;
  health(): Promise<AdapterHealth>;
  fetchCustomer(externalId: string): Promise<AdapterResult<CrmCustomer | null>>;
  searchCustomers(query: string, limit?: number): Promise<AdapterResult<CrmCustomer[]>>;
  /**
   * Pull events for a client between `since` (exclusive) and now. Adapters
   * that don't support event ingestion return `ok([])` — callers treat the
   * empty set as "no new events" and the worker is a no-op.
   */
  pullCrmEvents?(clientExternalId: string, since?: string): Promise<AdapterResult<CrmPulledEvent[]>>;
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

/**
 * Named scenarios that the stress-pricing workflow can request. Mirrors
 * `ShockScenarioId` from `types/pricingShocks.ts` without importing it, to
 * keep the adapter layer decoupled from the domain types.
 */
export type ShockedCurveScenarioId =
  | 'parallel_up_200'
  | 'parallel_down_200'
  | 'short_up_250'
  | 'short_down_250'
  | 'steepener'
  | 'flattener';

export interface MarketDataAdapter {
  kind: 'market_data';
  name: string;
  health(): Promise<AdapterHealth>;
  fetchYieldCurve(currency: string, asOfDate?: string): Promise<AdapterResult<MarketYieldCurveSnapshot>>;
  fetchFxRate(base: string, quote: string, asOfDate?: string): Promise<AdapterResult<number>>;
  /**
   * Return the yield curve with a named EBA GL 2018/02 scenario applied.
   *
   * N-Pricing consumes these curves — it does not synthesize them on its
   * own outside the in-memory reference adapter. Real vendors (Bloomberg,
   * Refinitiv, the bank's own ALM engine) return the already-shocked curve
   * they computed internally. The in-memory adapter applies the closed-form
   * EBA shifts to a base curve so dev / tests have a realistic surface.
   *
   * Optional on the interface for backwards compatibility with existing
   * adapters — callers must handle absence (pricing falls back to the
   * uniform `interestRate` legacy path).
   */
  fetchShockedCurve?(
    scenarioId: ShockedCurveScenarioId,
    currency: string,
    asOfDate?: string,
  ): Promise<AdapterResult<MarketYieldCurveSnapshot>>;
}

// ---------- Admission (Ola 9) ----------
//
// Conecta el motor de pricing/atribuciones con el sistema de admisión de
// riesgos del banco (PUZZLE en Banca March, similares en otros tenants).
// El adapter cubre dos sentidos:
//
//   PUSH:  N-Pricing → Admission. Emite decisiones de pricing/atribución
//          (snapshot hash incluido) para que el flujo de admisión las
//          incorpore a su circuito. Idempotente — el remoto deduplica
//          por dealId + snapshotHash.
//   PULL:  Admission → N-Pricing. Lee el contexto de admisión de un
//          deal (rating interno, exposure agregada cliente, garantías,
//          decisión final del comité de admisión) para alimentar el
//          motor cuando se reprice.
//
// File-drop overnight + reconciliación batch quedan modelados como un
// método separado `pullReconciliation(asOfDate)` para que el worker que
// los procesa no necesite saber el transporte (SFTP / S3 / API).

/** Rating interno simplificado (S&P-style). El dominio puede mapearlo a
 *  su propio scoring si difiere. */
export type AdmissionRating =
  | 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D'
  | 'NR';   // Not rated

export interface AdmissionCollateral {
  type: string;             // 'mortgage', 'pledge', 'guarantee', 'standby_lc', etc.
  valueEur: number;
  ltv?: number | null;       // 0..1
  jurisdiction?: string;
}

export interface AdmissionContext {
  dealId: string;
  clientId: string;
  internalRating: AdmissionRating;
  pdAnnual: number | null;        // 0..1
  lgd: number | null;              // 0..1
  exposureEur: number;             // exposición agregada cliente
  exposureAtDefaultEur: number | null;
  collateral: AdmissionCollateral[];
  decision: 'approved' | 'rejected' | 'pending' | 'unknown';
  decidedAt: string | null;        // ISO
  notes: string | null;
}

export interface AdmissionDecisionPush {
  dealId: string;
  pricingSnapshotHash: string;     // hash chain N-Pricing
  decision: 'approved' | 'rejected' | 'escalated';
  decidedByUser: string | null;
  decidedAt: string;               // ISO
  finalClientRateBps: number;
  rarocPp: number;
  attributionLevelId: string | null;
  routingMetadata: Record<string, unknown>;
}

export interface AdmissionReconciliationItem {
  dealId: string;
  pricingSnapshotHash: string;
  ourFinalRateBps: number;
  bookedRateBps: number;
  diffBps: number;                 // bookedRate - ourFinalRate
  bookedAt: string | null;
  status: 'matched' | 'mismatch_rate' | 'mismatch_missing' | 'unknown_in_admission';
}

export interface AdmissionAdapter {
  kind: 'admission';
  name: string;
  health(): Promise<AdapterHealth>;
  /**
   * Idempotent push de la decisión hacia el sistema de admisión. La
   * implementación remota debe deduplicar por (dealId, pricingSnapshotHash).
   * Devuelve `externalId` cuando el remoto crea un registro propio.
   */
  pushPricingDecision(
    decision: AdmissionDecisionPush,
  ): Promise<AdapterResult<{ externalId: string | null }>>;
  /**
   * Lee el contexto de admisión actual del deal. Devuelve `null` cuando
   * el remoto no tiene registro del dealId (mismatch_missing en
   * reconciliation).
   */
  fetchAdmissionContext(
    dealId: string,
  ): Promise<AdapterResult<AdmissionContext | null>>;
  /**
   * Reconciliación batch — pares (dealId, ourSnapshotHash) que el caller
   * necesita confirmar contra el book oficial. Modela el flujo overnight
   * file-drop + el real-time API sin acoplar el caller al transporte.
   */
  pullReconciliation?(
    asOfDate: string,
  ): Promise<AdapterResult<AdmissionReconciliationItem[]>>;
}

export type AnyAdapter =
  | CoreBankingAdapter
  | CrmAdapter
  | MarketDataAdapter
  | AdmissionAdapter;
