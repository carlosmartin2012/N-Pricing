import { pool, queryOne, execute } from '../db';
import {
  buildClientRelationship,
  mapClientPositionRow,
  mapClientMetricsSnapshotRow,
  mapPricingTargetRow,
} from '../../utils/customer360/relationshipAggregator';
import { computeLtv, defaultAssumptions } from '../../utils/clv/ltvEngine';
import { sha256CanonicalJson } from '../../utils/snapshotHash';
import type { ClientEntity } from '../../types';

/**
 * LTV snapshot worker — opt-in via LTV_SNAPSHOT_INTERVAL_MS.
 *
 * Walks the (entity, client) cartesian product and writes a CLV snapshot
 * per client at most once per (as_of_date). Idempotent thanks to the unique
 * constraint on (entity_id, client_id, as_of_date) — subsequent runs on the
 * same day hit the ON CONFLICT upsert and refresh only if inputs changed
 * (the assumptions_hash moves).
 *
 * Tick cadence recommendations:
 *   - Dev / demo: 5 min (300_000)
 *   - Prod: 6h (21_600_000) — plenty for daily refresh, cheap to run
 *
 * Each tick:
 *   1. Loads active (entity × client) pairs with at least one active position.
 *   2. For each pair, hydrates the relationship lens and runs computeLtv.
 *   3. Writes or refreshes client_ltv_snapshots for today.
 *
 * NEVER throws from the interval callback — errors are logged per-client.
 */

const ENGINE_VERSION = process.env.ENGINE_VERSION ?? 'dev-local';

interface ClientWithEntityRow {
  entity_id: string;
  client_id: string;
  client_name: string;
  client_type: ClientEntity['type'] | null;
  client_segment: string | null;
  client_rating: string | null;
}

export interface LtvTickReport {
  scanned: number;
  computed: number;
  skipped: number;
  errors: string[];
  tookMs: number;
}

async function listClientsWithActivePositions(): Promise<ClientWithEntityRow[]> {
  const { rows } = await pool.query<ClientWithEntityRow>(
    `SELECT DISTINCT
       p.entity_id,
       p.client_id,
       c.name     AS client_name,
       c.type     AS client_type,
       c.segment  AS client_segment,
       c.rating   AS client_rating
     FROM client_positions p
     JOIN clients c ON c.id = p.client_id
     WHERE p.status = 'Active'`,
  );
  return rows;
}

async function hydrateRelationship(entityId: string, clientId: string, asOfDate: string) {
  const [positions, metrics, targets] = await Promise.all([
    pool.query(`SELECT * FROM client_positions WHERE entity_id=$1 AND client_id=$2 ORDER BY status ASC, start_date DESC`, [entityId, clientId]),
    pool.query(`SELECT * FROM client_metrics_snapshots WHERE entity_id=$1 AND client_id=$2 ORDER BY computed_at DESC LIMIT 24`, [entityId, clientId]),
    pool.query(`SELECT * FROM pricing_targets WHERE entity_id=$1 AND is_active=true`, [entityId]),
  ]);

  const client = await queryOne<ClientWithEntityRow>(
    `SELECT id AS client_id, name AS client_name, type AS client_type, segment AS client_segment, rating AS client_rating,
            $1::text AS entity_id
     FROM clients WHERE id = $2`,
    [entityId, clientId],
  );
  if (!client) return null;

  return buildClientRelationship({
    client: {
      id: clientId,
      name: client.client_name,
      type: client.client_type ?? 'Corporate',
      segment: client.client_segment ?? '',
      rating: client.client_rating ?? 'BBB',
    },
    positions: positions.rows.map(mapClientPositionRow as (r: unknown) => ReturnType<typeof mapClientPositionRow>),
    metricsHistory: metrics.rows.map(mapClientMetricsSnapshotRow as (r: unknown) => ReturnType<typeof mapClientMetricsSnapshotRow>),
    targets: targets.rows.map(mapPricingTargetRow as (r: unknown) => ReturnType<typeof mapPricingTargetRow>),
    asOfDate,
  });
}

export async function runLtvSnapshotTick(asOfDate?: string): Promise<LtvTickReport> {
  const start = Date.now();
  const as_of = asOfDate ?? new Date().toISOString().slice(0, 10);
  const errors: string[] = [];
  let computed = 0;
  let skipped = 0;

  const clients = await listClientsWithActivePositions();

  for (const c of clients) {
    try {
      const rel = await hydrateRelationship(c.entity_id, c.client_id, as_of);
      if (!rel) {
        skipped++;
        continue;
      }

      const assumptions = defaultAssumptions(as_of);
      const ltv = computeLtv(rel, assumptions);
      const assumptionsHashFull = await sha256CanonicalJson(ltv.assumptions);

      await execute(
        `INSERT INTO client_ltv_snapshots (
           entity_id, client_id, as_of_date, horizon_years, discount_rate,
           clv_point_eur, clv_p5_eur, clv_p95_eur,
           churn_hazard_annual, renewal_prob,
           share_of_wallet_est, share_of_wallet_gap,
           breakdown, assumptions, assumptions_hash, engine_version, computed_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17)
         ON CONFLICT (entity_id, client_id, as_of_date) DO UPDATE SET
           clv_point_eur       = EXCLUDED.clv_point_eur,
           clv_p5_eur          = EXCLUDED.clv_p5_eur,
           clv_p95_eur         = EXCLUDED.clv_p95_eur,
           churn_hazard_annual = EXCLUDED.churn_hazard_annual,
           renewal_prob        = EXCLUDED.renewal_prob,
           share_of_wallet_est = EXCLUDED.share_of_wallet_est,
           share_of_wallet_gap = EXCLUDED.share_of_wallet_gap,
           breakdown           = EXCLUDED.breakdown,
           assumptions         = EXCLUDED.assumptions,
           assumptions_hash    = EXCLUDED.assumptions_hash,
           engine_version      = EXCLUDED.engine_version,
           computed_at         = NOW()
         WHERE client_ltv_snapshots.assumptions_hash <> EXCLUDED.assumptions_hash
            OR client_ltv_snapshots.clv_point_eur    <> EXCLUDED.clv_point_eur`,
        [
          c.entity_id, c.client_id, as_of,
          ltv.horizonYears, ltv.discountRate,
          ltv.clvPointEur, ltv.clvP5Eur, ltv.clvP95Eur,
          ltv.churnHazardAnnual, ltv.renewalProb,
          ltv.shareOfWalletEst, ltv.shareOfWalletGap,
          JSON.stringify(ltv.breakdown),
          JSON.stringify(ltv.assumptions),
          assumptionsHashFull,
          ENGINE_VERSION,
          'worker:ltvSnapshotWorker',
        ],
      );
      computed++;
    } catch (err) {
      errors.push(`${c.entity_id}:${c.client_id} ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { scanned: clients.length, computed, skipped, errors, tookMs: Date.now() - start };
}

// ---------------------------------------------------------------------------
// Runtime loop — opt-in via LTV_SNAPSHOT_INTERVAL_MS env var
// ---------------------------------------------------------------------------

let interval: ReturnType<typeof setInterval> | null = null;

export function startLtvSnapshotWorker(): void {
  const ms = Number(process.env.LTV_SNAPSHOT_INTERVAL_MS ?? '0');
  if (!Number.isFinite(ms) || ms < 60_000) return;      // minimum 1 min
  if (interval) return;

  interval = setInterval(async () => {
    try {
      const report = await runLtvSnapshotTick();
      if (report.computed > 0 || report.errors.length > 0) {
        console.info('[ltv-snapshot]', report);
      }
    } catch (err) {
      console.error('[ltv-snapshot] tick failed', err);
    }
  }, ms);
}

export function stopLtvSnapshotWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
