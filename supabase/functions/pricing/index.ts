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
 * Request body:
 * {
 *   "deal": Transaction,
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

// @ts-nocheck — Deno imports not available in Node/Vite context
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

    // Load market data from Supabase
    const [
      { data: yieldCurves },
      { data: liquidityCurves },
      { data: rules },
      { data: clients },
      { data: products },
      { data: businessUnits },
    ] = await Promise.all([
      supabase.from('yield_curves').select('*'),
      supabase.from('liquidity_curves').select('*'),
      supabase.from('rules').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('products').select('*'),
      supabase.from('business_units').select('*'),
    ]);

    const context = {
      yieldCurve: yieldCurves || [],
      liquidityCurves: liquidityCurves || [],
      rules: rules || [],
      clients: clients || [],
      products: products || [],
      businessUnits: businessUnits || [],
      rateCards: [],
      transitionGrid: [],
      physicalGrid: [],
      behaviouralModels: [],
    };

    if (isBatch) {
      // Batch pricing
      const { deals, approvalMatrix, shocks } = body;

      if (!Array.isArray(deals)) {
        return new Response(
          JSON.stringify({ error: 'deals must be an array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // TODO: Import and call batchReprice(deals, approvalMatrix, context, shocks)
      // For now, return scaffold response
      const results = deals.map((deal: any) => ({
        dealId: deal.id,
        status: 'pending_implementation',
        message: 'Server-side pricing engine not yet bundled for Deno runtime',
      }));

      // Log batch pricing to audit
      await supabase.from('audit_log').insert({
        user_email: user.email,
        user_name: user.email,
        action: 'BATCH_PRICE_SERVER',
        module: 'CALCULATOR',
        description: `Server-side batch pricing: ${deals.length} deals`,
      });

      return new Response(
        JSON.stringify({ results, count: deals.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    } else {
      // Single deal pricing
      const { deal, approvalMatrix, shocks } = body;

      if (!deal) {
        return new Response(
          JSON.stringify({ error: 'deal is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // TODO: Import and call calculatePricing(deal, approvalMatrix, context, shocks)
      const result = {
        status: 'pending_implementation',
        message: 'Server-side pricing engine not yet bundled for Deno runtime',
        deal_id: deal.id,
      };

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
