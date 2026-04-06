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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Map DB yield_curves rows → YieldCurvePoint[] */
function mapYieldCurveRows(rows: any[]): YieldCurvePoint[] {
  if (!rows?.length) return [];
  return rows.map((r: any) => ({
    tenor: r.tenor as string,
    rate: Number(r.rate),
    ...(r.prev != null ? { prev: Number(r.prev) } : {}),
  }));
}

/** Map DB liquidity_curves rows → DualLiquidityCurve[] */
function mapLiquidityCurveRows(rows: any[]): DualLiquidityCurve[] {
  if (!rows?.length) return [];

  // Group rows by currency + curveType
  const grouped = new Map<string, { currency: string; curveType: string; lastUpdate: string; points: LiquidityCurvePoint[] }>();

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
      tenor: r.tenor as string,
      wholesaleSpread: Number(r.wholesale_spread ?? r.wholesaleSpread ?? 0),
      termLP: Number(r.term_lp ?? r.termLP ?? 0),
    });
  }

  return Array.from(grouped.values()) as DualLiquidityCurve[];
}

/** Map DB rules rows → GeneralRule[] */
function mapRuleRows(rows: any[]): GeneralRule[] {
  if (!rows?.length) return [];
  return rows.map((r: any) => ({
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
function mapClientRows(rows: any[]): ClientEntity[] {
  if (!rows?.length) return [];
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    type: r.type ?? r.client_type ?? 'Corporate',
    segment: r.segment ?? '',
    rating: r.rating ?? 'BBB',
  }));
}

/** Map DB products rows → ProductDefinition[] */
function mapProductRows(rows: any[]): ProductDefinition[] {
  if (!rows?.length) return [];
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category ?? 'Asset',
    defaultAmortization: r.default_amortization ?? r.defaultAmortization,
  }));
}

/** Map DB business_units rows → BusinessUnit[] */
function mapBusinessUnitRows(rows: any[]): BusinessUnit[] {
  if (!rows?.length) return [];
  return rows.map((r: any) => ({
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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();
    const url = new URL(req.url);
    const isBatch = url.pathname.endsWith('/batch');

    // Extract approvalMatrix and shocks from request body
    const approvalMatrix = body.approvalMatrix ?? {
      autoApprovalThreshold: 15,
      l1Threshold: 10,
      l2Threshold: 5,
    };
    const shocks = body.shocks ?? { interestRate: 0, liquiditySpread: 0 };

    // Load market data from Supabase
    const [
      { data: yieldCurveRows },
      { data: liquidityCurveRows },
      { data: ruleRows },
      { data: clientRows },
      { data: productRows },
      { data: businessUnitRows },
    ] = await Promise.all([
      supabase.from('yield_curves').select('*'),
      supabase.from('liquidity_curves').select('*'),
      supabase.from('rules').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('products').select('*'),
      supabase.from('business_units').select('*'),
    ]);

    // Build PricingContext from DB rows
    // Fields not stored in DB (rateCards, transitionGrid, physicalGrid,
    // behaviouralModels, sdrConfig, lrConfig, incentivisationRules) will
    // fall back to mock data inside calculatePricing when arrays are empty.
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

    if (isBatch) {
      // Batch pricing
      const { deals } = body;

      if (!Array.isArray(deals)) {
        return new Response(
          JSON.stringify({ error: 'deals must be an array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // batchReprice returns a Map<string, FTPResult>; convert to serializable array
      const resultsMap = batchReprice(deals, approvalMatrix, loadedContext, shocks);
      const results = Array.from(resultsMap.entries()).map(([dealId, result]: [string, any]) => ({
        dealId,
        ...result,
      }));

      // Log batch pricing to audit
      await supabase.from('audit_log').insert({
        user_email: user.email,
        user_name: user.email,
        action: 'BATCH_PRICE_SERVER',
        module: 'CALCULATOR',
        description: `Server-side batch pricing: ${deals.length} deals, ${results.length} priced`,
      });

      return new Response(
        JSON.stringify({ results, count: results.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } else {
      // Single deal pricing
      const { deal } = body;

      if (!deal) {
        return new Response(
          JSON.stringify({ error: 'deal is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const result = calculatePricing(deal, approvalMatrix, loadedContext, shocks);

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
