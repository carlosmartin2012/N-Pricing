#!/usr/bin/env tsx
/**
 * Seed demo data for CLV + 360º temporal (Phase 6).
 *
 * Generates a synthetic but coherent client relationship so the CLV/NBA UI
 * has something to render on `npm run dev` without waiting on CRM imports.
 *
 * For each demo client:
 *   - 2-4 client_positions (Mortgage, Corporate_Loan, Cash_Management, …)
 *   - 4 quarterly client_metrics_snapshots (trending share-of-wallet)
 *   - 8-15 client_events (onboarding, deal_booked, contact, churn_signal)
 *   - 1 client_ltv_snapshot for today
 *   - 2 open client_nba_recommendations
 *
 * Idempotent: inserts use ON CONFLICT DO NOTHING where keys allow; re-running
 * refreshes LTV snapshots but leaves existing positions/metrics untouched.
 *
 * Usage:
 *   tsx scripts/seed-clv-demo.ts --entity-id <uuid> [--reset] [--dry-run]
 *
 * Flags:
 *   --entity-id  Target entity. Defaults to the Default Entity UUID.
 *   --reset      Deletes demo rows (client_id starting with 'DEMO-') before seeding.
 *   --dry-run    Prints what would happen without touching the DB.
 *
 * Exit 0 on success, 1 on error.
 */

import { Pool } from 'pg';
import { computeLtv, defaultAssumptions } from '../utils/clv/ltvEngine';
import { buildClientRelationship } from '../utils/customer360/relationshipAggregator';
import { sha256CanonicalJson } from '../utils/snapshotHash';
import type { ClientPosition, ClientMetricsSnapshot } from '../types/customer360';

const DEFAULT_ENTITY = '00000000-0000-0000-0000-000000000010';

interface Args {
  entityId: string;
  reset: boolean;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  return {
    entityId: get('--entity-id') ?? DEFAULT_ENTITY,
    reset: args.includes('--reset'),
    dryRun: args.includes('--dry-run'),
  };
}

interface DemoClient {
  id: string;
  name: string;
  segment: string;
  rating: string;
  positions: Array<Omit<ClientPosition, 'id' | 'entityId' | 'clientId' | 'createdAt' | 'updatedAt'>>;
  metrics: Array<Omit<ClientMetricsSnapshot, 'id' | 'entityId' | 'clientId' | 'computedAt'>>;
  events: Array<{
    type: string;
    daysAgo: number;
    source: string;
    amountEur: number | null;
    payload: Record<string, unknown>;
  }>;
}

const TODAY = new Date().toISOString().slice(0, 10);
const addYears = (base: string, years: number): string => {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
};

const DEMO: DemoClient[] = [
  {
    id: 'DEMO-ACME-001',
    name: 'Acme Industrial SA',
    segment: 'Large Corporate',
    rating: 'A',
    positions: [
      { productId: null, productType: 'Corporate_Loan', category: 'Asset', dealId: null, amount: 5_000_000, currency: 'EUR', marginBps: 210, startDate: addYears(TODAY, -2), maturityDate: addYears(TODAY, 3), status: 'Active' },
      { productId: null, productType: 'Cash_Management', category: 'Service', dealId: null, amount: 1_200_000, currency: 'EUR', marginBps: 80, startDate: addYears(TODAY, -2), maturityDate: null, status: 'Active' },
      { productId: null, productType: 'FX_Hedging', category: 'Off-Balance', dealId: null, amount: 3_500_000, currency: 'EUR', marginBps: 45, startDate: addYears(TODAY, -1), maturityDate: addYears(TODAY, 1), status: 'Active' },
    ],
    metrics: [
      { period: '2025-Q3', nimBps: 175, feesEur: 45_000, evaEur: 120_000, shareOfWalletPct: 0.38, relationshipAgeYears: 4.0, npsScore: 45, activePositionCount: 3, totalExposureEur: 9_700_000, source: 'computed', detail: {} },
      { period: '2025-Q4', nimBps: 182, feesEur: 48_000, evaEur: 135_000, shareOfWalletPct: 0.42, relationshipAgeYears: 4.25, npsScore: 50, activePositionCount: 3, totalExposureEur: 9_700_000, source: 'computed', detail: {} },
      { period: '2026-Q1', nimBps: 188, feesEur: 51_000, evaEur: 142_000, shareOfWalletPct: 0.44, relationshipAgeYears: 4.5, npsScore: 48, activePositionCount: 3, totalExposureEur: 9_700_000, source: 'computed', detail: {} },
      { period: '2026-Q2', nimBps: 190, feesEur: 53_000, evaEur: 150_000, shareOfWalletPct: 0.45, relationshipAgeYears: 4.75, npsScore: 52, activePositionCount: 3, totalExposureEur: 9_700_000, source: 'computed', detail: {} },
    ],
    events: [
      { type: 'onboarding',       daysAgo: 1700, source: 'crm',     amountEur: null,      payload: { channel: 'Relationship Manager' } },
      { type: 'deal_booked',      daysAgo: 730,  source: 'pricing', amountEur: 5_000_000, payload: { product: 'Corporate_Loan' } },
      { type: 'crosssell_won',    daysAgo: 540,  source: 'crm',     amountEur: 1_200_000, payload: { product: 'Cash_Management' } },
      { type: 'contact',          daysAgo: 90,   source: 'crm',     amountEur: null,      payload: { subject: 'Renewal discussion' } },
      { type: 'price_review',     daysAgo: 45,   source: 'ops',     amountEur: null,      payload: { reason: 'tier-change' } },
      { type: 'committee_review', daysAgo: 30,   source: 'ops',     amountEur: null,      payload: { decision: 'approved' } },
    ],
  },
  {
    id: 'DEMO-BETASOLAR-002',
    name: 'Beta Solar Energy SL',
    segment: 'Mid-market',
    rating: 'BBB',
    positions: [
      { productId: null, productType: 'ESG_Green_Loan', category: 'Asset', dealId: null, amount: 8_000_000, currency: 'EUR', marginBps: 195, startDate: addYears(TODAY, -1), maturityDate: addYears(TODAY, 6), status: 'Active' },
      { productId: null, productType: 'Trade_Finance', category: 'Off-Balance', dealId: null, amount: 1_500_000, currency: 'EUR', marginBps: 160, startDate: addYears(TODAY, -0.5), maturityDate: addYears(TODAY, 0.5), status: 'Active' },
    ],
    metrics: [
      { period: '2025-Q3', nimBps: 155, feesEur: 18_000, evaEur: 65_000, shareOfWalletPct: 0.22, relationshipAgeYears: 2.5, npsScore: 60, activePositionCount: 2, totalExposureEur: 9_500_000, source: 'computed', detail: {} },
      { period: '2025-Q4', nimBps: 162, feesEur: 19_500, evaEur: 72_000, shareOfWalletPct: 0.25, relationshipAgeYears: 2.75, npsScore: 58, activePositionCount: 2, totalExposureEur: 9_500_000, source: 'computed', detail: {} },
      { period: '2026-Q1', nimBps: 170, feesEur: 22_000, evaEur: 80_000, shareOfWalletPct: 0.28, relationshipAgeYears: 3.0, npsScore: 62, activePositionCount: 2, totalExposureEur: 9_500_000, source: 'computed', detail: {} },
      { period: '2026-Q2', nimBps: 175, feesEur: 24_000, evaEur: 88_000, shareOfWalletPct: 0.30, relationshipAgeYears: 3.25, npsScore: 65, activePositionCount: 2, totalExposureEur: 9_500_000, source: 'computed', detail: {} },
    ],
    events: [
      { type: 'onboarding',       daysAgo: 1050, source: 'crm',     amountEur: null,      payload: { channel: 'Digital' } },
      { type: 'deal_booked',      daysAgo: 365,  source: 'pricing', amountEur: 8_000_000, payload: { product: 'ESG_Green_Loan', greenium: true } },
      { type: 'crosssell_attempt',daysAgo: 180,  source: 'crm',     amountEur: 2_000_000, payload: { product: 'FX_Hedging', outcome: 'lost' } },
      { type: 'contact',          daysAgo: 15,   source: 'crm',     amountEur: null,      payload: { subject: 'ESG reporting' } },
    ],
  },
  {
    id: 'DEMO-GAMMAHEALTH-003',
    name: 'Gamma Healthcare Group',
    segment: 'Mid-market',
    rating: 'BB',
    positions: [
      { productId: null, productType: 'Corporate_Loan', category: 'Asset', dealId: null, amount: 2_500_000, currency: 'EUR', marginBps: 250, startDate: addYears(TODAY, -3), maturityDate: addYears(TODAY, 0.25), status: 'Active' },
    ],
    metrics: [
      { period: '2025-Q3', nimBps: 245, feesEur: 8_000, evaEur: 35_000, shareOfWalletPct: 0.15, relationshipAgeYears: 3.0, npsScore: 35, activePositionCount: 1, totalExposureEur: 2_500_000, source: 'computed', detail: {} },
      { period: '2025-Q4', nimBps: 240, feesEur: 7_500, evaEur: 30_000, shareOfWalletPct: 0.14, relationshipAgeYears: 3.25, npsScore: 30, activePositionCount: 1, totalExposureEur: 2_500_000, source: 'computed', detail: {} },
      { period: '2026-Q1', nimBps: 235, feesEur: 7_000, evaEur: 25_000, shareOfWalletPct: 0.12, relationshipAgeYears: 3.5, npsScore: 25, activePositionCount: 1, totalExposureEur: 2_500_000, source: 'computed', detail: {} },
      { period: '2026-Q2', nimBps: 230, feesEur: 6_500, evaEur: 22_000, shareOfWalletPct: 0.10, relationshipAgeYears: 3.75, npsScore: 20, activePositionCount: 1, totalExposureEur: 2_500_000, source: 'computed', detail: {} },
    ],
    events: [
      { type: 'onboarding',      daysAgo: 1400, source: 'crm',     amountEur: null,      payload: {} },
      { type: 'deal_booked',     daysAgo: 1095, source: 'pricing', amountEur: 2_500_000, payload: { product: 'Corporate_Loan' } },
      { type: 'claim',           daysAgo: 300,  source: 'ops',     amountEur: 45_000,    payload: { category: 'service' } },
      { type: 'churn_signal',    daysAgo: 120,  source: 'ml',      amountEur: null,      payload: { score: 0.72, drivers: ['nps_drop', 'balance_decline'] } },
      { type: 'churn_signal',    daysAgo: 60,   source: 'ml',      amountEur: null,      payload: { score: 0.85, drivers: ['nps_drop', 'complaint_volume'] } },
    ],
  },
];

async function ensureDemoClient(pool: Pool, entityId: string, c: DemoClient): Promise<void> {
  await pool.query(
    `INSERT INTO clients (id, name, type, segment, rating, country, entity_id)
     VALUES ($1, $2, 'Corporate', $3, $4, 'ES', $5::uuid)
     ON CONFLICT (id) DO NOTHING`,
    [c.id, c.name, c.segment, c.rating, entityId],
  );
}

async function seedPositions(pool: Pool, entityId: string, c: DemoClient): Promise<number> {
  let inserted = 0;
  for (const p of c.positions) {
    const res = await pool.query(
      `INSERT INTO client_positions (
         entity_id, client_id, product_id, product_type, category, deal_id,
         amount, currency, margin_bps, start_date, maturity_date, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [entityId, c.id, p.productId, p.productType, p.category, p.dealId,
       p.amount, p.currency, p.marginBps, p.startDate, p.maturityDate, p.status],
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

async function seedMetrics(pool: Pool, entityId: string, c: DemoClient): Promise<number> {
  let inserted = 0;
  for (const m of c.metrics) {
    const res = await pool.query(
      `INSERT INTO client_metrics_snapshots (
         entity_id, client_id, period,
         nim_bps, fees_eur, eva_eur, share_of_wallet_pct,
         relationship_age_years, nps_score,
         active_position_count, total_exposure_eur, source, detail
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
       ON CONFLICT (entity_id, client_id, period) DO NOTHING`,
      [entityId, c.id, m.period, m.nimBps, m.feesEur, m.evaEur, m.shareOfWalletPct,
       m.relationshipAgeYears, m.npsScore, m.activePositionCount, m.totalExposureEur,
       m.source, JSON.stringify(m.detail)],
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

async function seedEvents(pool: Pool, entityId: string, c: DemoClient): Promise<number> {
  let inserted = 0;
  const now = Date.now();
  for (const e of c.events) {
    const ts = new Date(now - e.daysAgo * 86_400_000).toISOString();
    const res = await pool.query(
      `INSERT INTO client_events (
         entity_id, client_id, event_type, event_ts, source,
         amount_eur, payload, created_by
       ) VALUES ($1,$2,$3,$4::timestamptz,$5,$6,$7::jsonb,'seed:clv-demo')
       ON CONFLICT DO NOTHING`,
      [entityId, c.id, e.type, ts, e.source, e.amountEur, JSON.stringify(e.payload)],
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

async function seedLtvSnapshot(pool: Pool, entityId: string, c: DemoClient): Promise<boolean> {
  // Hydrate a ClientRelationship from the data we just inserted and compute
  // CLV deterministically — better than hardcoding CLV numbers, and exercises
  // the engine as part of the seed.
  const positions = c.positions.map((p, i) => ({
    id: `${c.id}-pos-${i}`,
    entityId, clientId: c.id,
    productId: p.productId, productType: p.productType, category: p.category,
    dealId: p.dealId, amount: p.amount, currency: p.currency, marginBps: p.marginBps,
    startDate: p.startDate, maturityDate: p.maturityDate, status: p.status,
    createdAt: TODAY, updatedAt: TODAY,
  }));
  const metricsHistory = c.metrics.map((m, i) => ({
    id: `${c.id}-metric-${i}`,
    entityId, clientId: c.id,
    period: m.period, computedAt: TODAY,
    nimBps: m.nimBps, feesEur: m.feesEur, evaEur: m.evaEur,
    shareOfWalletPct: m.shareOfWalletPct, relationshipAgeYears: m.relationshipAgeYears,
    npsScore: m.npsScore, activePositionCount: m.activePositionCount,
    totalExposureEur: m.totalExposureEur, source: m.source, detail: m.detail,
  }));
  const relationship = buildClientRelationship({
    client: { id: c.id, name: c.name, type: 'Corporate', segment: c.segment, rating: c.rating },
    positions, metricsHistory, targets: [], asOfDate: TODAY,
  });
  const assumptions = defaultAssumptions(TODAY, { shareOfWalletEst: relationship.metrics.latest?.shareOfWalletPct ?? 0.3 });
  const ltv = computeLtv(relationship, assumptions);
  const assumptionsHash = await sha256CanonicalJson(ltv.assumptions);

  const res = await pool.query(
    `INSERT INTO client_ltv_snapshots (
       entity_id, client_id, as_of_date, horizon_years, discount_rate,
       clv_point_eur, clv_p5_eur, clv_p95_eur,
       churn_hazard_annual, renewal_prob, share_of_wallet_est, share_of_wallet_gap,
       breakdown, assumptions, assumptions_hash, engine_version, computed_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,'dev-seed','seed:clv-demo')
     ON CONFLICT (entity_id, client_id, as_of_date) DO UPDATE SET
       clv_point_eur    = EXCLUDED.clv_point_eur,
       clv_p5_eur       = EXCLUDED.clv_p5_eur,
       clv_p95_eur      = EXCLUDED.clv_p95_eur,
       breakdown        = EXCLUDED.breakdown,
       assumptions      = EXCLUDED.assumptions,
       assumptions_hash = EXCLUDED.assumptions_hash,
       computed_at      = NOW()
     RETURNING id`,
    [entityId, c.id, TODAY, ltv.horizonYears, ltv.discountRate,
     ltv.clvPointEur, ltv.clvP5Eur, ltv.clvP95Eur,
     ltv.churnHazardAnnual, ltv.renewalProb, ltv.shareOfWalletEst, ltv.shareOfWalletGap,
     JSON.stringify(ltv.breakdown), JSON.stringify(ltv.assumptions), assumptionsHash],
  );
  return (res.rowCount ?? 0) > 0;
}

async function seedNba(pool: Pool, entityId: string, c: DemoClient): Promise<number> {
  // Two canonical NBA candidates per client — the engine would generate
  // these from REFERENCE_CATALOGUE at runtime; we just seed illustrative
  // rows so the UI renders immediately.
  const recs = [
    {
      product: 'FX_Hedging', rate: 40, volume: 2_000_000, delta: 85_000, confidence: 0.72,
      codes: ['cross_sell_cohort_signal', 'capacity_underused'],
      rationale: 'FX_Hedging ticket €2M → ΔCLV 2.1% · cross-sell cohort signal',
    },
    {
      product: 'ESG_Green_Loan', rate: 360, volume: 3_000_000, delta: 210_000, confidence: 0.81,
      codes: ['regulatory_incentive_available', 'nim_below_target'],
      rationale: 'ESG_Green_Loan ticket €3M → ΔCLV 4.6% · regulatory incentive · lifts NIM toward target',
    },
  ];
  let inserted = 0;
  for (const r of recs) {
    const res = await pool.query(
      `INSERT INTO client_nba_recommendations (
         entity_id, client_id,
         recommended_product, recommended_rate_bps, recommended_volume_eur, recommended_currency,
         expected_clv_delta_eur, confidence, reason_codes, rationale, source
       ) VALUES ($1,$2,$3,$4,$5,'EUR',$6,$7,$8::jsonb,$9,'engine')
       ON CONFLICT DO NOTHING`,
      [entityId, c.id, r.product, r.rate, r.volume, r.delta, r.confidence, JSON.stringify(r.codes), r.rationale],
    );
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

async function resetDemo(pool: Pool, entityId: string): Promise<void> {
  // Order matters — children first
  await pool.query(`DELETE FROM client_nba_recommendations WHERE entity_id = $1 AND client_id LIKE 'DEMO-%'`, [entityId]);
  await pool.query(`DELETE FROM client_ltv_snapshots       WHERE entity_id = $1 AND client_id LIKE 'DEMO-%'`, [entityId]);
  await pool.query(`DELETE FROM client_events              WHERE entity_id = $1 AND client_id LIKE 'DEMO-%'`, [entityId]);
  await pool.query(`DELETE FROM client_metrics_snapshots   WHERE entity_id = $1 AND client_id LIKE 'DEMO-%'`, [entityId]);
  await pool.query(`DELETE FROM client_positions           WHERE entity_id = $1 AND client_id LIKE 'DEMO-%'`, [entityId]);
  await pool.query(`DELETE FROM clients                    WHERE entity_id = $1 AND id        LIKE 'DEMO-%'`, [entityId]);
}

async function main() {
  const args = parseArgs();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL env var required');
    process.exit(1);
  }

  console.info(`[seed-clv-demo] entity=${args.entityId} reset=${args.reset} dryRun=${args.dryRun}`);
  if (args.dryRun) {
    console.info(`[seed-clv-demo] Would seed ${DEMO.length} demo clients with positions, metrics, events, LTV, NBA`);
    return;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    if (args.reset) {
      console.info('[seed-clv-demo] Resetting DEMO-* rows…');
      await resetDemo(pool, args.entityId);
    }
    const totals = { clients: 0, positions: 0, metrics: 0, events: 0, ltv: 0, nba: 0 };
    for (const c of DEMO) {
      await ensureDemoClient(pool, args.entityId, c);
      totals.clients++;
      totals.positions += await seedPositions(pool, args.entityId, c);
      totals.metrics   += await seedMetrics(pool, args.entityId, c);
      totals.events    += await seedEvents(pool, args.entityId, c);
      if (await seedLtvSnapshot(pool, args.entityId, c)) totals.ltv++;
      totals.nba       += await seedNba(pool, args.entityId, c);
    }
    console.info(`[seed-clv-demo] ✅ ${JSON.stringify(totals)}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[seed-clv-demo] failed', err);
  process.exit(1);
});
