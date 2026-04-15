/**
 * Supabase Edge Function — Elasticity Recalibration
 *
 * Nightly cron (suggested: 0 2 * * * Europe/Madrid) that:
 *  1. Reads deals with decision_date in the last 6 months and won_lost set.
 *  2. Calibrates elasticity models per (product × clientType × amount × tenor)
 *     bucket using OLS on >=30 obs or Bayesian shrinkage for 3-29 obs.
 *  3. Inserts new rows into elasticity_models, marking prior rows
 *     is_active=false for the same segment_key.
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque D
 *      utils/pricing/elasticityCalibration.ts (core logic)
 *      supabase/migrations/20260420000001_elasticity_models.sql
 *
 * Deploy:
 *   supabase functions deploy elasticity-recalibrate
 *
 * Schedule via pg_cron or Supabase cron:
 *   SELECT cron.schedule('elasticity-nightly', '0 2 * * *',
 *     'SELECT net.http_post(url:=''<edge_fn_url>'', ...);');
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

// ─── Bucket helpers (duplicated from utils/pricing/priceElasticity.ts) ─────
// Edge Functions can't import from src directly; kept inline for portability.

type AmountBucket = 'SMALL' | 'MEDIUM' | 'LARGE' | 'JUMBO';
type TenorBucket = 'ST' | 'MT' | 'LT';
type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
type Method = 'FREQUENTIST' | 'BAYESIAN';

const bucketAmount = (amount: number): AmountBucket => {
  if (amount < 100_000) return 'SMALL';
  if (amount < 1_000_000) return 'MEDIUM';
  if (amount < 10_000_000) return 'LARGE';
  return 'JUMBO';
};

const bucketTenor = (months: number): TenorBucket => {
  if (months <= 12) return 'ST';
  if (months <= 60) return 'MT';
  return 'LT';
};

const buildSegmentKey = (p: string, c: string, a: AmountBucket, t: TenorBucket) =>
  `${p}|${c}|${a}|${t}`;

const MIN_SAMPLE_FOR_OLS = 30;
const MIN_SAMPLE_FOR_BAYES = 3;
const HIGH_CONFIDENCE_THRESHOLD = 100;

const DEFAULT_PRIOR = { elasticity: -0.3, baselineConversion: 0.5, anchorRate: 4.0 };

interface DealRow {
  id: string;
  product_type: string;
  client_type: string;
  amount: number;
  duration_months: number;
  won_lost: 'WON' | 'LOST' | 'PENDING' | 'WITHDRAWN';
  proposed_rate: number | null;
  margin_target: number;
  decision_date: string;
}

interface CalibratedModel {
  segmentKey: string;
  elasticity: number;
  baselineConversion: number;
  anchorRate: number;
  sampleSize: number;
  confidence: Confidence;
  method: Method;
}

interface Observation {
  offeredRate: number;
  converted: 0 | 1;
}

const fitFrequentist = (obs: Observation[], segmentKey: string): CalibratedModel | null => {
  if (obs.length < MIN_SAMPLE_FOR_OLS) return null;

  const sorted = [...obs].sort((a, b) => a.offeredRate - b.offeredRate);
  const numBins = Math.min(10, Math.max(3, Math.floor(sorted.length / 5)));
  const binSize = Math.floor(sorted.length / numBins);

  const bins: Array<{ avgRate: number; convRate: number }> = [];
  for (let i = 0; i < numBins; i++) {
    const start = i * binSize;
    const end = i === numBins - 1 ? sorted.length : (i + 1) * binSize;
    const slice = sorted.slice(start, end);
    if (slice.length === 0) continue;
    const avgRate = slice.reduce((s, o) => s + o.offeredRate, 0) / slice.length;
    const conv = slice.reduce((s, o) => s + o.converted, 0) / slice.length;
    if (avgRate > 0 && conv > 0) bins.push({ avgRate, convRate: conv });
  }
  if (bins.length < 3) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const bin of bins) {
    const x = Math.log(bin.avgRate);
    const y = Math.log(bin.convRate);
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  }
  const n = bins.length;
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const avgRate = obs.reduce((s, o) => s + o.offeredRate, 0) / obs.length;
  const convAtAvg = Math.exp(intercept + slope * Math.log(avgRate));

  return {
    segmentKey,
    elasticity: -slope,
    baselineConversion: Math.max(0, Math.min(1, convAtAvg)),
    anchorRate: avgRate,
    sampleSize: obs.length,
    confidence: obs.length >= HIGH_CONFIDENCE_THRESHOLD ? 'HIGH' : 'MEDIUM',
    method: 'FREQUENTIST',
  };
};

const shrinkToPrior = (obs: Observation[], segmentKey: string, prior: typeof DEFAULT_PRIOR): CalibratedModel => {
  const n = obs.length;
  const w = n / (n + MIN_SAMPLE_FOR_OLS);
  const convRate = obs.reduce((s, o) => s + o.converted, 0) / n;
  const avgRate = obs.reduce((s, o) => s + o.offeredRate, 0) / n;
  return {
    segmentKey,
    elasticity: prior.elasticity,
    baselineConversion: w * convRate + (1 - w) * prior.baselineConversion,
    anchorRate: w * avgRate + (1 - w) * prior.anchorRate,
    sampleSize: n,
    confidence: 'LOW',
    method: 'BAYESIAN',
  };
};

const calibrate = (deals: DealRow[]): CalibratedModel[] => {
  const bySegment = new Map<string, Observation[]>();
  for (const deal of deals) {
    if (deal.won_lost !== 'WON' && deal.won_lost !== 'LOST') continue;
    const offeredRate = deal.proposed_rate ?? deal.margin_target;
    if (!Number.isFinite(offeredRate) || offeredRate <= 0) continue;
    const key = buildSegmentKey(
      deal.product_type,
      deal.client_type,
      bucketAmount(deal.amount),
      bucketTenor(deal.duration_months),
    );
    if (!bySegment.has(key)) bySegment.set(key, []);
    bySegment.get(key)!.push({
      offeredRate: Number(offeredRate),
      converted: deal.won_lost === 'WON' ? 1 : 0,
    });
  }

  const results: CalibratedModel[] = [];
  for (const [segmentKey, obs] of bySegment.entries()) {
    if (obs.length >= MIN_SAMPLE_FOR_OLS) {
      const fitted = fitFrequentist(obs, segmentKey);
      if (fitted) results.push(fitted);
      continue;
    }
    if (obs.length >= MIN_SAMPLE_FOR_BAYES) {
      results.push(shrinkToPrior(obs, segmentKey, DEFAULT_PRIOR));
    }
  }
  return results;
};

const persistModels = async (supabase: SupabaseClient, models: CalibratedModel[]) => {
  if (models.length === 0) return { deactivated: 0, inserted: 0 };

  const segmentKeys = models.map((m) => m.segmentKey);

  const { error: deactivateError } = await supabase
    .from('elasticity_models')
    .update({ is_active: false })
    .in('segment_key', segmentKeys)
    .eq('is_active', true);
  if (deactivateError) throw deactivateError;

  const rows = models.map((m) => ({
    segment_key: m.segmentKey,
    elasticity: m.elasticity,
    baseline_conversion: m.baselineConversion,
    anchor_rate: m.anchorRate,
    sample_size: m.sampleSize,
    confidence: m.confidence,
    method: m.method,
    is_active: true,
    calibrated_at: new Date().toISOString(),
  }));
  const { error: insertError } = await supabase.from('elasticity_models').insert(rows);
  if (insertError) throw insertError;

  return { deactivated: segmentKeys.length, inserted: rows.length };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // Optional entity scoping — scheduler can fan out one call per entity via
  // ?entity_id=<uuid>. Omitted → calibrates across all entities (legacy).
  const url = new URL(req.url);
  const entityIdParam = url.searchParams.get('entity_id');
  const scopedEntityId = entityIdParam && UUID_RE.test(entityIdParam) ? entityIdParam : null;
  if (entityIdParam && !scopedEntityId) {
    return new Response(
      JSON.stringify({ ok: false, error: 'entity_id must be a UUID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const dealsQuery = supabase
      .from('deals')
      .select('id, product_type, client_type, amount, duration_months, won_lost, proposed_rate, margin_target, decision_date')
      .not('won_lost', 'is', null)
      .gte('decision_date', sixMonthsAgo);
    const { data, error } = scopedEntityId
      ? await dealsQuery.eq('entity_id', scopedEntityId)
      : await dealsQuery;
    if (error) throw error;

    const deals = (data ?? []) as DealRow[];
    const models = calibrate(deals);
    const persistence = await persistModels(supabase, models);

    return new Response(
      JSON.stringify({
        ok: true,
        entityId: scopedEntityId,
        dealsConsidered: deals.length,
        segmentsCalibrated: models.length,
        ...persistence,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
