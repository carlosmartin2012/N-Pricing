/**
 * Supabase Edge Function — Ex-post RAROC Realization
 *
 * Monthly cron (suggested: 0 3 1 * * Europe/Madrid — 1st of month 03:00)
 * that recomputes RAROC for each booked deal using the current yield
 * curves and inserts/upserts a snapshot into deal_realizations.
 *
 * Method: SPOT_CURVE (MVP) — recompute with current curves vs. origination.
 * Future: CORE_FEED — ingest realized P&L from bank core banking.
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque F
 *      supabase/migrations/20260501000001_deal_realizations.sql
 *
 * Deploy:
 *   supabase functions deploy realize-raroc
 *
 * Schedule:
 *   SELECT cron.schedule('raroc-monthly', '0 3 1 * *', ...);
 *
 * NOTE: This implementation uses a simplified RAROC recomputation based on
 * observed margin vs. current curve spot to illustrate the pipeline. The
 * production variant should import the real pricing bundle and call
 * calculatePricing() with origination curves → current curves delta.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

interface DealRow {
  id: string;
  product_type: string;
  amount: number;
  duration_months: number;
  margin_target: number;
  target_roe: number;
  risk_weight: number;
  capital_ratio: number;
  currency: string;
  start_date: string;
}

interface YieldCurveRow {
  currency: string;
  tenor: string;
  rate: number;
  as_of_date: string;
}

const TENOR_MAP: Record<string, number> = {
  '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '3Y': 36,
  '5Y': 60, '7Y': 84, '10Y': 120, '15Y': 180, '20Y': 240, '30Y': 360,
};

const interpolateCurve = (curve: YieldCurveRow[], months: number): number => {
  const points = curve
    .map((c) => ({ months: TENOR_MAP[c.tenor] ?? NaN, rate: Number(c.rate) }))
    .filter((p) => Number.isFinite(p.months) && Number.isFinite(p.rate))
    .sort((a, b) => a.months - b.months);
  if (points.length === 0) return 0;
  if (months <= points[0].months) return points[0].rate;
  if (months >= points[points.length - 1].months) return points[points.length - 1].rate;
  for (let i = 1; i < points.length; i++) {
    if (months <= points[i].months) {
      const lo = points[i - 1];
      const hi = points[i];
      const w = (months - lo.months) / (hi.months - lo.months);
      return lo.rate * (1 - w) + hi.rate * w;
    }
  }
  return points[points.length - 1].rate;
};

const recomputeRaroc = (deal: DealRow, curveRate: number): {
  realized_ftp_rate: number;
  realized_margin: number;
  realized_ecl: number;
  realized_raroc: number;
} => {
  const ftp = curveRate;
  const margin = deal.margin_target;
  const coupon = ftp + margin;
  const ead = deal.amount;
  const rwa = ead * deal.risk_weight;
  const regCap = rwa * deal.capital_ratio;
  // Simplified ECL: 25bp for rated, scaled by risk weight
  const ecl = ead * 0.0025 * deal.risk_weight;
  const revenue = ead * (coupon / 100);
  const cof = ead * (ftp / 100);
  const netIncome = revenue - cof - ecl;
  const raroc = regCap > 0 ? (netIncome / regCap) * 100 : 0;
  return {
    realized_ftp_rate: ftp,
    realized_margin: margin,
    realized_ecl: ecl,
    realized_raroc: raroc,
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500 });
  }
  const supabase: SupabaseClient = createClient(supabaseUrl, serviceKey);

  // Optional entity scoping — the cron scheduler fans out one call per entity
  // by passing ?entity_id=<uuid>. When omitted, the job processes all
  // entities together (legacy behaviour, kept for backwards compatibility).
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
    const dealsQuery = supabase
      .from('deals')
      .select('id, product_type, amount, duration_months, margin_target, target_roe, risk_weight, capital_ratio, currency, start_date')
      .eq('status', 'Booked');
    const { data: deals, error: dealsError } = scopedEntityId
      ? await dealsQuery.eq('entity_id', scopedEntityId)
      : await dealsQuery;
    if (dealsError) throw dealsError;

    const bookedDeals = (deals ?? []) as DealRow[];

    const curvesQuery = supabase
      .from('yield_curves')
      .select('currency, tenor, rate, as_of_date')
      .order('as_of_date', { ascending: false });
    const { data: curves, error: curvesError } = scopedEntityId
      ? await curvesQuery.eq('entity_id', scopedEntityId)
      : await curvesQuery;
    if (curvesError) throw curvesError;

    const curveByCurrency = new Map<string, YieldCurveRow[]>();
    for (const row of (curves ?? []) as YieldCurveRow[]) {
      if (!curveByCurrency.has(row.currency)) curveByCurrency.set(row.currency, []);
      curveByCurrency.get(row.currency)!.push(row);
    }

    const today = new Date().toISOString().slice(0, 10);
    const rows: Array<{
      deal_id: string;
      snapshot_date: string;
      realized_ftp_rate: number;
      realized_margin: number;
      realized_ecl: number;
      realized_raroc: number;
      recompute_method: 'SPOT_CURVE';
    }> = [];

    let skipped = 0;
    for (const deal of bookedDeals) {
      const curve = curveByCurrency.get(deal.currency);
      if (!curve || curve.length === 0) {
        skipped++;
        continue;
      }
      const curveRate = interpolateCurve(curve, deal.duration_months);
      const realized = recomputeRaroc(deal, curveRate);
      rows.push({
        deal_id: deal.id,
        snapshot_date: today,
        ...realized,
        recompute_method: 'SPOT_CURVE',
      });
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('deal_realizations')
        .upsert(rows, { onConflict: 'deal_id,snapshot_date' });
      if (upsertError) throw upsertError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        entityId: scopedEntityId,
        dealsBooked: bookedDeals.length,
        realizationsInserted: rows.length,
        skippedMissingCurve: skipped,
        snapshotDate: today,
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
