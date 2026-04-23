/**
 * Supabase Edge Function: Server-side FTP Pricing
 *
 * Moves pricing calculation to the server for:
 * 1. Security: pricing logic not exposed in browser
 * 2. Performance: batch pricing without blocking UI
 * 3. Auditability: server-side pricing results are tamper-proof
 *
 * Deploy: supabase functions deploy pricing
 *
 * Endpoints:
 *   POST /pricing          — price a single deal
 *   POST /pricing/batch    — price multiple deals
 *
 * Request body (single):
 * {
 *   "deal": Transaction,
 *   "approvalMatrix": ApprovalMatrixConfig,
 *   "shocks": { interestRate: number, liquiditySpread: number }
 * }
 *
 * Request body (batch):
 * {
 *   "deals": Transaction[],
 *   "approvalMatrix": ApprovalMatrixConfig,
 *   "shocks": { interestRate: number, liquiditySpread: number }
 * }
 *
 * Build the pricing bundle before deploying:
 *   node supabase/functions/pricing/build.mjs
 *
 * This creates pricingBundle.js with the isomorphic pricing engine.
 * Then deploy:
 *   supabase functions deploy pricing
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';
import { calculatePricing, batchReprice } from './pricingBundle.js';

// ─── Local type definitions for DB → domain mapping ────────────────────────
// These mirror the interfaces from types.ts but are declared locally because
// the bundle is a plain JS file and cannot export TypeScript types at runtime.

interface YieldCurvePoint {
  tenor: string;
  rate: number;
  prev?: number;
}

interface LiquidityCurvePoint {
  tenor: string;
  wholesaleSpread: number;
  termLP: number;
}

interface DualLiquidityCurve {
  currency: string;
  curveType?: 'unsecured' | 'secured';
  lastUpdate: string;
  points: LiquidityCurvePoint[];
}

interface GeneralRule {
  id: number;
  businessUnit: string;
  product: string;
  segment: string;
  tenor: string;
  baseMethod: string;
  baseReference?: string;
  spreadMethod: string;
  liquidityReference?: string;
  strategicSpread: number;
  formulaSpec?: Record<string, unknown>;
  version?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive?: boolean;
}

interface ClientEntity {
  id: string;
  name: string;
  type: string;
  segment: string;
  rating: string;
}

interface ProductDefinition {
  id: string;
  name: string;
  category: 'Asset' | 'Liability' | 'Off-Balance';
  defaultAmortization?: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
}

interface PricingContext {
  yieldCurve: YieldCurvePoint[];
  liquidityCurves: DualLiquidityCurve[];
  rules: GeneralRule[];
  rateCards: unknown[];
  transitionGrid: unknown[];
  physicalGrid: unknown[];
  behaviouralModels: unknown[];
  clients: ClientEntity[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  sdrConfig?: unknown;
  lrConfig?: unknown;
  incentivisationRules?: unknown[];
}

interface YieldCurveRow {
  tenor: string;
  rate: number | string;
  prev?: number | string | null;
}

interface LiquidityCurveRow {
  currency: string;
  curve_type?: DualLiquidityCurve['curveType'] | null;
  last_update?: string | null;
  updated_at?: string | null;
  tenor: string;
  wholesale_spread?: number | string | null;
  wholesaleSpread?: number | string | null;
  term_lp?: number | string | null;
  termLP?: number | string | null;
}

interface RuleRow {
  id: number;
  business_unit?: string;
  businessUnit?: string;
  product?: string;
  segment?: string;
  tenor?: string;
  base_method?: string;
  baseMethod?: string;
  base_reference?: string;
  baseReference?: string;
  spread_method?: string;
  spreadMethod?: string;
  liquidity_reference?: string;
  liquidityReference?: string;
  strategic_spread?: number | string;
  strategicSpread?: number | string;
  formula_spec?: GeneralRule['formulaSpec'];
  formulaSpec?: GeneralRule['formulaSpec'];
  version?: number;
  effective_from?: string;
  effectiveFrom?: string;
  effective_to?: string;
  effectiveTo?: string;
  is_active?: boolean;
  isActive?: boolean;
}

interface ClientRow {
  id: string;
  name: string;
  type?: ClientEntity['type'];
  client_type?: ClientEntity['type'];
  segment?: string;
  rating?: string;
}

interface ProductRow {
  id: string;
  name: string;
  category?: ProductDefinition['category'];
  default_amortization?: string;
  defaultAmortization?: string;
}

interface BusinessUnitRow {
  id: string;
  name: string;
  code?: string;
}

interface PricingRequestBody {
  deal?: Record<string, unknown>;
  deals?: Array<Record<string, unknown>>;
  approvalMatrix?: Partial<{
    autoApprovalThreshold: number;
    l1Threshold: number;
    l2Threshold: number;
  }>;
  shocks?: Partial<{
    interestRate: number;
    liquiditySpread: number;
  }>;
  asOfDate?: string; // YYYY-MM-DD — optional, defaults to today UTC
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-entity-id, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'x-request-id, x-snapshot-id, x-engine-version',
};

// ─── Phase 0 — tenancy + reproducibility support ──────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENGINE_VERSION =
  Deno.env.get('ENGINE_VERSION') ?? Deno.env.get('VERCEL_GIT_COMMIT_SHA') ?? 'dev-local';
const ALLOW_MOCKS = Deno.env.get('PRICING_ALLOW_MOCKS') === 'true';

function extractEntityId(req: Request, body: PricingRequestBody): string | null {
  const fromHeader = req.headers.get('x-entity-id');
  const fromBody = (body as unknown as { entity_id?: unknown }).entity_id;
  const raw =
    (typeof fromHeader === 'string' ? fromHeader : null) ??
    (typeof fromBody === 'string' ? fromBody : null);
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

function extractRequestId(req: Request): string {
  const SAFE = /^[A-Za-z0-9._-]{8,128}$/;
  const inbound = req.headers.get('x-request-id');
  if (inbound && SAFE.test(inbound)) return inbound;
  return crypto.randomUUID();
}

async function canonicalJson(value: unknown): Promise<string> {
  // Match utils/canonicalJson — inlined here because Edge Functions can't
  // easily import from the app-level utils directory.
  const stringify = (v: unknown): string => {
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'string') return JSON.stringify(v);
    if (t === 'boolean') return v ? 'true' : 'false';
    if (t === 'number') {
      const n = v as number;
      if (!Number.isFinite(n)) throw new Error('non-finite number');
      return JSON.stringify(n);
    }
    if (t === 'bigint') return (v as bigint).toString();
    if (Array.isArray(v)) {
      return `[${v.map((x) => (x === undefined ? 'null' : stringify(x))).join(',')}]`;
    }
    if (t === 'object') {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`).join(',')}}`;
    }
    throw new Error(`unsupported type ${t}`);
  };
  return stringify(value);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < arr.length; i++) out += arr[i].toString(16).padStart(2, '0');
  return out;
}

/**
 * Ola 6 Bloque C — writer side of the snapshot hash chain.
 *
 * Reads the last `output_hash` persisted for this tenant, attaches it as
 * `prev_output_hash`, and inserts. If two concurrent pricing calls both
 * read the same last hash they will collide on the partial UNIQUE index
 * `(entity_id, prev_output_hash) WHERE prev_output_hash IS NOT NULL`
 * (see migration 20260619000003). On that specific conflict we retry —
 * re-reading the last hash reflects the winning writer's row, so the
 * loser extends the chain without a fork.
 *
 * Backoff: 10 ms → 40 ms → 160 ms. Kept short because pricing is not a
 * realtime batch path; contention windows are sub-second.
 *
 * Non-unique-violation errors bubble back to the caller unchanged so
 * the existing snapshot_write_failures_total metric keeps working.
 */
async function insertSnapshotWithChain(
  // Supabase v2.95's generics require threading `PostgrestVersion` through
  // every call site — we erase to any here to match the rest of this file,
  // which also treats the client as a loose untyped handle.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: Record<string, unknown>,
  entityId: string,
  maxRetries = 3,
): Promise<{ error: { code?: string; message: string } | null; attempts: number }> {
  const MAX_ATTEMPTS = maxRetries + 1;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data: lastRows } = await supabase
      .from('pricing_snapshots')
      .select('output_hash')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(1);

    const prevOutputHash = lastRows && lastRows.length > 0
      ? ((lastRows[0] as { output_hash: string }).output_hash ?? null)
      : null;

    const { error: insErr } = await supabase
      .from('pricing_snapshots')
      .insert({ ...row, prev_output_hash: prevOutputHash });

    if (!insErr) return { error: null, attempts: attempt };

    const code = (insErr as { code?: string }).code;
    const message = insErr.message ?? '';
    const isChainConflict = code === '23505'
      || /uniq_pricing_snapshots_prev_hash/i.test(message);

    if (!isChainConflict || attempt >= MAX_ATTEMPTS) {
      return { error: insErr, attempts: attempt };
    }

    await new Promise((resolve) => setTimeout(resolve, 10 * Math.pow(4, attempt - 1)));
  }

  return {
    error: { code: 'chain_retry_exhausted', message: 'snapshot chain write retries exhausted' },
    attempts: MAX_ATTEMPTS,
  };
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function usedMockForFromContext(ctx: PricingContext): string[] {
  const missing: string[] = [];
  if (!ctx.rateCards?.length) missing.push('rateCards');
  if (!ctx.transitionGrid?.length) missing.push('transitionGrid');
  if (!ctx.physicalGrid?.length) missing.push('physicalGrid');
  if (!ctx.behaviouralModels?.length) missing.push('behaviouralModels');
  if (!ctx.sdrConfig) missing.push('sdrConfig');
  if (!ctx.lrConfig) missing.push('lrConfig');
  return missing;
}

function jsonResponse(body: unknown, init: ResponseInit = {}, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

/** Map DB yield_curves rows → YieldCurvePoint[] */
function mapYieldCurveRows(rows: YieldCurveRow[]): YieldCurvePoint[] {
  if (!rows?.length) return [];
  return rows.map((r) => ({
    tenor: r.tenor,
    rate: Number(r.rate),
    ...(r.prev != null ? { prev: Number(r.prev) } : {}),
  }));
}

/** Map DB liquidity_curves rows → DualLiquidityCurve[] */
function mapLiquidityCurveRows(rows: LiquidityCurveRow[]): DualLiquidityCurve[] {
  if (!rows?.length) return [];

  // Group rows by currency + curveType
  const grouped = new Map<string, {
    currency: string;
    curveType: NonNullable<DualLiquidityCurve['curveType']>;
    lastUpdate: string;
    points: LiquidityCurvePoint[];
  }>();

  for (const r of rows) {
    const key = `${r.currency}_${r.curve_type || 'unsecured'}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        currency: r.currency,
        curveType: r.curve_type || 'unsecured',
        lastUpdate: r.last_update || r.updated_at || new Date().toISOString(),
        points: [],
      });
    }
    grouped.get(key)!.points.push({
      tenor: r.tenor,
      wholesaleSpread: Number(r.wholesale_spread ?? r.wholesaleSpread ?? 0),
      termLP: Number(r.term_lp ?? r.termLP ?? 0),
    });
  }

  return Array.from(grouped.values()) as DualLiquidityCurve[];
}

/** Map DB rules rows → GeneralRule[] */
function mapRuleRows(rows: RuleRow[]): GeneralRule[] {
  if (!rows?.length) return [];
  return rows.map((r) => ({
    id: r.id,
    businessUnit: r.business_unit ?? r.businessUnit ?? 'All',
    product: r.product ?? 'Any',
    segment: r.segment ?? 'All',
    tenor: r.tenor ?? 'Any',
    baseMethod: r.base_method ?? r.baseMethod ?? 'Matched Maturity',
    baseReference: r.base_reference ?? r.baseReference ?? undefined,
    spreadMethod: r.spread_method ?? r.spreadMethod ?? '',
    liquidityReference: r.liquidity_reference ?? r.liquidityReference ?? undefined,
    strategicSpread: Number(r.strategic_spread ?? r.strategicSpread ?? 0),
    formulaSpec: r.formula_spec ?? r.formulaSpec ?? undefined,
    version: r.version,
    effectiveFrom: r.effective_from ?? r.effectiveFrom,
    effectiveTo: r.effective_to ?? r.effectiveTo,
    isActive: r.is_active ?? r.isActive ?? true,
  }));
}

/** Map DB clients rows → ClientEntity[] */
function mapClientRows(rows: ClientRow[]): ClientEntity[] {
  if (!rows?.length) return [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type ?? r.client_type ?? 'Corporate',
    segment: r.segment ?? '',
    rating: r.rating ?? 'BBB',
  }));
}

/** Map DB products rows → ProductDefinition[] */
function mapProductRows(rows: ProductRow[]): ProductDefinition[] {
  if (!rows?.length) return [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? 'Asset',
    defaultAmortization: r.default_amortization ?? r.defaultAmortization,
  }));
}

/** Map DB business_units rows → BusinessUnit[] */
function mapBusinessUnitRows(rows: BusinessUnitRow[]): BusinessUnit[] {
  if (!rows?.length) return [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code ?? '',
  }));
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = extractRequestId(req);
  const t0 = performance.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(
        { code: 'unauthenticated', message: 'Missing authorization header', requestId },
        { status: 401 },
        { 'x-request-id': requestId },
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (authError || !user) {
      return jsonResponse(
        { code: 'unauthenticated', message: 'Invalid or expired token', requestId },
        { status: 401 },
        { 'x-request-id': requestId },
      );
    }

    const body = await req.json() as PricingRequestBody;
    const url = new URL(req.url);
    const isBatch = url.pathname.endsWith('/batch');

    // ─── Tenancy validation (Phase 0) ──────────────────────────────────────
    const entityId = extractEntityId(req, body);
    if (!entityId) {
      return jsonResponse(
        { code: 'tenancy_missing_header', message: 'Missing x-entity-id', requestId },
        { status: 400 },
        { 'x-request-id': requestId },
      );
    }
    const { data: entityUserRow, error: entityUserErr } = await supabase
      .from('entity_users')
      .select('role')
      .eq('user_id', user.email)
      .eq('entity_id', entityId)
      .maybeSingle();
    if (entityUserErr || !entityUserRow) {
      await supabase.from('tenancy_violations').insert({
        request_id: requestId,
        user_email: user.email,
        endpoint: `POST ${url.pathname}`,
        claimed_entity: entityId,
        error_code: 'tenancy_denied',
      }).catch(() => { /* best effort */ });
      return jsonResponse(
        { code: 'tenancy_denied', message: 'User does not have access to this entity', requestId },
        { status: 403 },
        { 'x-request-id': requestId },
      );
    }

    // Extract approvalMatrix and shocks from request body
    const approvalMatrix = {
      autoApprovalThreshold: 15,
      l1Threshold: 10,
      l2Threshold: 5,
    };
    Object.assign(approvalMatrix, body.approvalMatrix);
    const shocks = { interestRate: 0, liquiditySpread: 0 };
    Object.assign(shocks, body.shocks);

    const asOfDate = typeof body.asOfDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.asOfDate)
      ? body.asOfDate
      : todayUtc();

    // Load market data from Supabase (scoped to caller's entity).
    const [
      { data: yieldCurveRows },
      { data: liquidityCurveRows },
      { data: ruleRows },
      { data: clientRows },
      { data: productRows },
      { data: businessUnitRows },
    ] = await Promise.all([
      supabase.from('yield_curves').select('*').eq('entity_id', entityId),
      supabase.from('liquidity_curves').select('*').eq('entity_id', entityId),
      supabase.from('rules').select('*').eq('entity_id', entityId),
      supabase.from('clients').select('*').eq('entity_id', entityId),
      supabase.from('products').select('*').eq('entity_id', entityId),
      supabase.from('business_units').select('*').eq('entity_id', entityId),
    ]);

    // Build PricingContext from DB rows
    const loadedContext: PricingContext = {
      yieldCurve: mapYieldCurveRows(yieldCurveRows ?? []),
      liquidityCurves: mapLiquidityCurveRows(liquidityCurveRows ?? []),
      rules: mapRuleRows(ruleRows ?? []),
      rateCards: [],
      transitionGrid: [],
      physicalGrid: [],
      behaviouralModels: [],
      clients: mapClientRows(clientRows ?? []),
      products: mapProductRows(productRows ?? []),
      businessUnits: mapBusinessUnitRows(businessUnitRows ?? []),
    };

    const usedMockFor = usedMockForFromContext(loadedContext);
    if (usedMockFor.length > 0 && !ALLOW_MOCKS) {
      return jsonResponse(
        {
          code: 'configuration_incomplete',
          message: 'Pricing context is missing production data; set PRICING_ALLOW_MOCKS=true to allow dev fallbacks',
          missing: usedMockFor,
          requestId,
        },
        { status: 400 },
        { 'x-request-id': requestId },
      );
    }

    if (isBatch) {
      // Batch pricing
      const { deals } = body;

      if (!Array.isArray(deals)) {
        return jsonResponse(
          { code: 'invalid_payload', message: 'deals must be an array', requestId },
          { status: 400 },
          { 'x-request-id': requestId },
        );
      }

      const resultsMap = batchReprice(deals, approvalMatrix, loadedContext, shocks) as Map<string, Record<string, unknown>>;
      const results: Array<Record<string, unknown>> = [];
      resultsMap.forEach((result, dealId) => {
        results.push({ dealId, ...result });
      });

      const durationMs = performance.now() - t0;

      // Persist one snapshot per deal so each result is independently replayable.
      const snapshotIds: string[] = [];
      for (const [dealId, result] of resultsMap.entries()) {
        const inputPayload = { deal: { ...(deals.find((d) => String((d as Record<string, unknown>).id) === dealId) ?? {}), id: dealId }, approvalMatrix, shocks };
        const inputHash = await sha256Hex(await canonicalJson({ input: inputPayload, context: loadedContext }));
        const outputHash = await sha256Hex(await canonicalJson(result));
        const snapshotId = crypto.randomUUID();
        const shocksRecord = (shocks as Record<string, unknown> | undefined) ?? {};
        const scenarioId = typeof shocksRecord.id === 'string' ? shocksRecord.id : null;
        const scenarioSource = typeof shocksRecord.source === 'string' ? shocksRecord.source : null;
        const { error: snapErr, attempts: snapAttempts } = await insertSnapshotWithChain(supabase, {
          id: snapshotId,
          entity_id: entityId,
          deal_id: UUID_RE.test(dealId) ? dealId : null,
          request_id: requestId,
          engine_version: ENGINE_VERSION,
          as_of_date: asOfDate,
          used_mock_for: usedMockFor,
          input: inputPayload,
          context: loadedContext,
          output: result,
          input_hash: inputHash,
          output_hash: outputHash,
          scenario_id: scenarioId,
          scenario_source: scenarioSource,
        }, entityId);
        if (snapErr) {
          await supabase.from('metrics').insert({
            entity_id: entityId,
            metric_name: 'snapshot_write_failures_total',
            metric_value: 1,
            dimensions: { request_id: requestId, endpoint: '/pricing/batch', error: snapErr.message, attempts: String(snapAttempts) },
          }).catch(() => { /* best effort */ });
        }
        snapshotIds.push(snapshotId);
      }

      await supabase.from('metrics').insert({
        entity_id: entityId,
        metric_name: 'pricing_batch_latency_ms_per_deal',
        metric_value: deals.length > 0 ? durationMs / deals.length : durationMs,
        dimensions: { request_id: requestId, endpoint: '/pricing/batch', status_code: '200', count: String(deals.length) },
      }).catch(() => { /* best effort */ });

      // Log batch pricing to audit
      await supabase.from('audit_log').insert({
        user_email: user.email,
        user_name: user.email,
        action: 'BATCH_PRICE_SERVER',
        module: 'CALCULATOR',
        description: `Server-side batch pricing: ${deals.length} deals, ${results.length} priced`,
      });

      return jsonResponse(
        { results, count: results.length, snapshotIds, requestId },
        {},
        {
          'x-request-id': requestId,
          'x-engine-version': ENGINE_VERSION,
        },
      );
    } else {
      // Single deal pricing
      const { deal } = body;

      if (!deal) {
        return jsonResponse(
          { code: 'invalid_payload', message: 'deal is required', requestId },
          { status: 400 },
          { 'x-request-id': requestId },
        );
      }

      const result = calculatePricing(deal, approvalMatrix, loadedContext, shocks) as Record<string, unknown>;
      const durationMs = performance.now() - t0;

      // Persist reproducibility snapshot.
      const inputPayload = { deal, approvalMatrix, shocks };
      const inputHash = await sha256Hex(await canonicalJson({ input: inputPayload, context: loadedContext }));
      const outputHash = await sha256Hex(await canonicalJson(result));
      const snapshotId = crypto.randomUUID();
      const dealId = typeof (deal as Record<string, unknown>).id === 'string' && UUID_RE.test(String((deal as Record<string, unknown>).id))
        ? String((deal as Record<string, unknown>).id)
        : null;
      const shocksRecord = (shocks as Record<string, unknown> | undefined) ?? {};
      const scenarioId = typeof shocksRecord.id === 'string' ? shocksRecord.id : null;
      const scenarioSource = typeof shocksRecord.source === 'string' ? shocksRecord.source : null;
      const { error: snapErr, attempts: snapAttempts } = await insertSnapshotWithChain(supabase, {
        id: snapshotId,
        entity_id: entityId,
        deal_id: dealId,
        request_id: requestId,
        engine_version: ENGINE_VERSION,
        as_of_date: asOfDate,
        used_mock_for: usedMockFor,
        input: inputPayload,
        context: loadedContext,
        output: result,
        input_hash: inputHash,
        output_hash: outputHash,
        scenario_id: scenarioId,
        scenario_source: scenarioSource,
      }, entityId);
      if (snapErr) {
        await supabase.from('metrics').insert({
          entity_id: entityId,
          metric_name: 'snapshot_write_failures_total',
          metric_value: 1,
          dimensions: { request_id: requestId, endpoint: '/pricing', error: snapErr.message, attempts: String(snapAttempts) },
        }).catch(() => { /* best effort */ });
      }

      await supabase.from('metrics').insert({
        entity_id: entityId,
        metric_name: 'pricing_single_latency_ms',
        metric_value: durationMs,
        dimensions: { request_id: requestId, endpoint: '/pricing', status_code: '200' },
      }).catch(() => { /* best effort */ });

      return jsonResponse(
        { ...result, snapshotId, requestId },
        {},
        {
          'x-request-id': requestId,
          'x-snapshot-id': snapshotId,
          'x-engine-version': ENGINE_VERSION,
        },
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown pricing error';
    return jsonResponse(
      { code: 'pricing_error', message, requestId },
      { status: 500 },
      { 'x-request-id': requestId },
    );
  }
});
