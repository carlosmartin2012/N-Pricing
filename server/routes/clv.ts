import { Router } from 'express';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';
import {
  buildClientRelationship,
  mapClientPositionRow,
  mapClientMetricsSnapshotRow,
  mapPricingTargetRow,
} from '../../utils/customer360/relationshipAggregator';
import { computeLtv, defaultAssumptions } from '../../utils/clv/ltvEngine';
import { computeMarginalLtvImpact } from '../../utils/clv/marginalLtvImpact';
import { rankNextBestActions, REFERENCE_CATALOGUE } from '../../utils/clv/nextBestAction';
import { sha256CanonicalJson } from '../../utils/snapshotHash';
import type { ClientEntity } from '../../types';
import type {
  ClientEvent,
  ClientLtvSnapshot,
  LtvAssumptions,
  LtvBreakdown,
  NbaRecommendation,
  DealCandidate,
} from '../../types/clv';

/**
 * CLV + 360º temporal HTTP surface.
 *
 * Every handler follows the existing customer360 convention:
 *   - requires `req.tenancy` (400 if missing, surfaced by global middleware in strict mode)
 *   - scopes every query by req.tenancy.entityId
 *   - never trusts `entity_id` from the body
 *
 * Snapshots are written append-only (RLS enforces this). Replays happen by
 * reading the snapshot row and re-running the pure engine — same pattern as
 * pricing_snapshots.
 */

const router = Router();

const ENGINE_VERSION = process.env.ENGINE_VERSION ?? 'dev-local';

interface ClientRow {
  id: string;
  name: string;
  type: ClientEntity['type'] | null;
  segment: string | null;
  rating: string | null;
}

function mapClient(row: ClientRow): ClientEntity {
  return {
    id: row.id,
    name: row.name,
    type: row.type ?? 'Corporate',
    segment: row.segment ?? '',
    rating: row.rating ?? 'BBB',
  };
}

interface LtvSnapshotRow {
  id: string;
  entity_id: string;
  client_id: string;
  as_of_date: string;
  horizon_years: number;
  discount_rate: string;
  clv_point_eur: string;
  clv_p5_eur: string | null;
  clv_p95_eur: string | null;
  churn_hazard_annual: string | null;
  renewal_prob: string | null;
  share_of_wallet_est: string | null;
  share_of_wallet_gap: string | null;
  breakdown: LtvBreakdown;
  assumptions: LtvAssumptions;
  assumptions_hash: string;
  engine_version: string;
  computed_at: string;
  computed_by: string | null;
}

function mapSnapshot(row: LtvSnapshotRow): ClientLtvSnapshot {
  const num = (x: string | null): number | null => x === null ? null : Number(x);
  return {
    id: row.id,
    entityId: row.entity_id,
    clientId: row.client_id,
    asOfDate: row.as_of_date,
    horizonYears: row.horizon_years,
    discountRate: Number(row.discount_rate),
    clvPointEur: Number(row.clv_point_eur),
    clvP5Eur: num(row.clv_p5_eur),
    clvP95Eur: num(row.clv_p95_eur),
    churnHazardAnnual: num(row.churn_hazard_annual),
    renewalProb: num(row.renewal_prob),
    shareOfWalletEst: num(row.share_of_wallet_est),
    shareOfWalletGap: num(row.share_of_wallet_gap),
    breakdown: row.breakdown,
    assumptions: row.assumptions,
    assumptionsHash: row.assumptions_hash,
    engineVersion: row.engine_version,
    computedAt: row.computed_at,
    computedBy: row.computed_by,
  };
}

interface EventRow {
  id: string;
  entity_id: string;
  client_id: string;
  event_type: ClientEvent['eventType'];
  event_ts: string;
  source: ClientEvent['source'];
  deal_id: string | null;
  position_id: string | null;
  amount_eur: string | null;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

function mapEvent(row: EventRow): ClientEvent {
  return {
    id: row.id,
    entityId: row.entity_id,
    clientId: row.client_id,
    eventType: row.event_type,
    eventTs: row.event_ts,
    source: row.source,
    dealId: row.deal_id,
    positionId: row.position_id,
    amountEur: row.amount_eur === null ? null : Number(row.amount_eur),
    payload: row.payload ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

interface NbaRow {
  id: string;
  entity_id: string;
  client_id: string;
  recommended_product: string;
  recommended_rate_bps: string | null;
  recommended_volume_eur: string | null;
  recommended_currency: string;
  expected_clv_delta_eur: string;
  confidence: string;
  reason_codes: NbaRecommendation['reasonCodes'];
  rationale: string | null;
  source: NbaRecommendation['source'];
  generated_at: string;
  consumed_at: string | null;
  consumed_by: string | null;
}

function mapNba(row: NbaRow): NbaRecommendation {
  return {
    id: row.id,
    entityId: row.entity_id,
    clientId: row.client_id,
    recommendedProduct: row.recommended_product,
    recommendedRateBps: row.recommended_rate_bps === null ? null : Number(row.recommended_rate_bps),
    recommendedVolumeEur: row.recommended_volume_eur === null ? null : Number(row.recommended_volume_eur),
    recommendedCurrency: row.recommended_currency,
    expectedClvDeltaEur: Number(row.expected_clv_delta_eur),
    confidence: Number(row.confidence),
    reasonCodes: row.reason_codes ?? [],
    rationale: row.rationale,
    source: row.source,
    generatedAt: row.generated_at,
    consumedAt: row.consumed_at,
    consumedBy: row.consumed_by,
  };
}

async function loadRelationship(entityId: string, clientId: string, asOfDate: string) {
  const client = await queryOne<ClientRow>(
    'SELECT id, name, type, segment, rating FROM clients WHERE id = $1 LIMIT 1',
    [clientId],
  );
  if (!client) return null;
  const [positions, metrics, targets] = await Promise.all([
    query<Parameters<typeof mapClientPositionRow>[0]>(
      `SELECT * FROM client_positions WHERE entity_id=$1 AND client_id=$2 ORDER BY status ASC, start_date DESC`,
      [entityId, clientId],
    ),
    query<Parameters<typeof mapClientMetricsSnapshotRow>[0]>(
      `SELECT * FROM client_metrics_snapshots WHERE entity_id=$1 AND client_id=$2 ORDER BY computed_at DESC LIMIT 24`,
      [entityId, clientId],
    ),
    query<Parameters<typeof mapPricingTargetRow>[0]>(
      `SELECT * FROM pricing_targets WHERE entity_id=$1 AND is_active=true`,
      [entityId],
    ),
  ]);
  return buildClientRelationship({
    client: mapClient(client),
    positions: positions.map(mapClientPositionRow),
    metricsHistory: metrics.map(mapClientMetricsSnapshotRow),
    targets: targets.map(mapPricingTargetRow),
    asOfDate,
  });
}

// ---------- Timeline ----------

router.get('/clients/:clientId/timeline', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);
    const rows = await query<EventRow>(
      `SELECT * FROM client_events
       WHERE entity_id = $1 AND client_id = $2
       ORDER BY event_ts DESC LIMIT $3`,
      [req.tenancy.entityId, req.params.clientId, limit],
    );
    res.json(rows.map(mapEvent));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/clients/:clientId/timeline', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = (req.body ?? {}) as Partial<ClientEvent> & Record<string, unknown>;
    const eventType = String(body.eventType ?? '');
    if (!eventType) {
      res.status(400).json({ code: 'invalid_payload', message: 'eventType required' });
      return;
    }
    const row = await queryOne<EventRow>(
      `INSERT INTO client_events (
         entity_id, client_id, event_type, event_ts, source,
         deal_id, position_id, amount_eur, payload, created_by
       ) VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), COALESCE($5, 'manual'),
                 $6, $7, $8, $9::jsonb, $10)
       RETURNING *`,
      [
        req.tenancy.entityId,
        req.params.clientId,
        eventType,
        body.eventTs ?? null,
        body.source ?? null,
        body.dealId ?? null,
        body.positionId ?? null,
        body.amountEur ?? null,
        JSON.stringify(body.payload ?? {}),
        req.tenancy.userEmail,
      ],
    );
    res.status(201).json(row ? mapEvent(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------- LTV ----------

router.get('/clients/:clientId/ltv', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const rows = await query<LtvSnapshotRow>(
      `SELECT * FROM client_ltv_snapshots
       WHERE entity_id = $1 AND client_id = $2
       ORDER BY as_of_date DESC LIMIT 36`,
      [req.tenancy.entityId, req.params.clientId],
    );
    res.json(rows.map(mapSnapshot));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/clients/:clientId/ltv/recompute', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = (req.body ?? {}) as Partial<LtvAssumptions> & { asOfDate?: string };
    const asOfDate = typeof body.asOfDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.asOfDate)
      ? body.asOfDate
      : new Date().toISOString().slice(0, 10);

    const rel = await loadRelationship(req.tenancy.entityId, req.params.clientId, asOfDate);
    if (!rel) {
      res.status(404).json({ code: 'not_found', message: 'Client not found' });
      return;
    }

    const assumptions = defaultAssumptions(asOfDate, body);
    const computed = computeLtv(rel, assumptions);
    const assumptionsHashFull = await sha256CanonicalJson(computed.assumptions);

    const row = await queryOne<LtvSnapshotRow>(
      `INSERT INTO client_ltv_snapshots (
         entity_id, client_id, as_of_date, horizon_years, discount_rate,
         clv_point_eur, clv_p5_eur, clv_p95_eur,
         churn_hazard_annual, renewal_prob,
         share_of_wallet_est, share_of_wallet_gap,
         breakdown, assumptions, assumptions_hash, engine_version, computed_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17)
       ON CONFLICT (entity_id, client_id, as_of_date) DO UPDATE SET
         horizon_years       = EXCLUDED.horizon_years,
         discount_rate       = EXCLUDED.discount_rate,
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
         computed_at         = NOW(),
         computed_by         = EXCLUDED.computed_by
       RETURNING *`,
      [
        req.tenancy.entityId,
        req.params.clientId,
        asOfDate,
        computed.horizonYears,
        computed.discountRate,
        computed.clvPointEur,
        computed.clvP5Eur,
        computed.clvP95Eur,
        computed.churnHazardAnnual,
        computed.renewalProb,
        computed.shareOfWalletEst,
        computed.shareOfWalletGap,
        JSON.stringify(computed.breakdown),
        JSON.stringify(computed.assumptions),
        assumptionsHashFull,
        ENGINE_VERSION,
        req.tenancy.userEmail,
      ],
    );

    // Timeline event — best-effort, never blocks.
    await execute(
      `INSERT INTO client_events (entity_id, client_id, event_type, source, payload, created_by)
       VALUES ($1, $2, 'price_review', 'ops', $3::jsonb, $4)`,
      [req.tenancy.entityId, req.params.clientId,
       JSON.stringify({ kind: 'ltv_recompute', clvPointEur: computed.clvPointEur, asOfDate }),
       req.tenancy.userEmail],
    ).catch(() => undefined);

    res.status(201).json(row ? mapSnapshot(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------- NBA ----------

/**
 * Firmwide Pipeline — cross-client NBA feed (Phase 6.8).
 *
 * Returns every open NBA recommendation for the current entity enriched
 * with the client name + segment + rating (JOIN clients). Powers the
 * new /pipeline sidebar view — the banker's landing page for "what
 * actions need my attention across the book today".
 *
 * Design choices:
 *   - JOIN done server-side (1 query) instead of N+1 on the client.
 *   - Defaults to open only; ?status=consumed|all opt into other rows.
 *   - LIMIT high (500) because pipeline is a work queue, not a page —
 *     filtering happens client-side in the UI.
 *   - Entity-scoped via the usual req.tenancy guard.
 */
router.get('/nba', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const statusParam = String(req.query.status ?? 'open');
    let statusClause = 'AND nba.consumed_at IS NULL';
    if (statusParam === 'consumed') statusClause = 'AND nba.consumed_at IS NOT NULL';
    else if (statusParam === 'all') statusClause = '';

    const rows = await query<NbaRow & { client_name: string; client_segment: string | null; client_rating: string | null }>(
      `SELECT nba.*,
              c.name    AS client_name,
              c.segment AS client_segment,
              c.rating  AS client_rating
       FROM client_nba_recommendations nba
       JOIN clients c ON c.id = nba.client_id
       WHERE nba.entity_id = $1
         ${statusClause}
       ORDER BY nba.generated_at DESC
       LIMIT 500`,
      [req.tenancy.entityId],
    );
    res.json(rows.map((row) => ({
      ...mapNba(row),
      clientName:    row.client_name,
      clientSegment: row.client_segment,
      clientRating:  row.client_rating,
    })));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/clients/:clientId/nba', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const onlyOpen = String(req.query.open ?? 'true') !== 'false';
    const rows = await query<NbaRow>(
      `SELECT * FROM client_nba_recommendations
       WHERE entity_id = $1 AND client_id = $2
         ${onlyOpen ? 'AND consumed_at IS NULL' : ''}
       ORDER BY generated_at DESC LIMIT 20`,
      [req.tenancy.entityId, req.params.clientId],
    );
    res.json(rows.map(mapNba));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/clients/:clientId/nba/generate', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = (req.body ?? {}) as Partial<LtvAssumptions> & { asOfDate?: string; topN?: number };
    const asOfDate = typeof body.asOfDate === 'string' ? body.asOfDate : new Date().toISOString().slice(0, 10);

    const rel = await loadRelationship(req.tenancy.entityId, req.params.clientId, asOfDate);
    if (!rel) {
      res.status(404).json({ code: 'not_found', message: 'Client not found' });
      return;
    }

    const assumptions = defaultAssumptions(asOfDate, body);
    const ltv = computeLtv(rel, assumptions);
    const ranked = rankNextBestActions({
      relationship: rel,
      ltv,
      assumptions,
      catalogue: REFERENCE_CATALOGUE,
      topN: body.topN ?? 3,
    });

    const created: NbaRecommendation[] = [];
    for (const r of ranked) {
      const row = await queryOne<NbaRow>(
        `INSERT INTO client_nba_recommendations (
           entity_id, client_id,
           recommended_product, recommended_rate_bps, recommended_volume_eur, recommended_currency,
           expected_clv_delta_eur, confidence, reason_codes, rationale, source
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
         RETURNING *`,
        [
          req.tenancy.entityId,
          req.params.clientId,
          r.recommendedProduct,
          r.recommendedRateBps,
          r.recommendedVolumeEur,
          r.recommendedCurrency,
          r.expectedClvDeltaEur,
          r.confidence,
          JSON.stringify(r.reasonCodes),
          r.rationale,
          r.source,
        ],
      );
      if (row) created.push(mapNba(row));
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/nba/:id/consume', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const row = await queryOne<NbaRow>(
      `UPDATE client_nba_recommendations
         SET consumed_at = NOW(), consumed_by = $3
       WHERE id = $1 AND entity_id = $2 AND consumed_at IS NULL
       RETURNING *`,
      [req.params.id, req.tenancy.entityId, req.tenancy.userEmail],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Recommendation not found or already consumed' });
      return;
    }
    res.json(mapNba(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------- Marginal LTV impact — killer demo endpoint ----------

router.post('/preview-ltv-impact', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = (req.body ?? {}) as {
      clientId?: string;
      candidate?: Partial<DealCandidate>;
      asOfDate?: string;
      assumptions?: Partial<LtvAssumptions>;
    };

    const clientId = String(body.clientId ?? '');
    const c = body.candidate ?? {};
    if (!clientId || !c.productType || !Number.isFinite(c.amountEur) || !Number.isFinite(c.marginBps)) {
      res.status(400).json({ code: 'invalid_payload', message: 'clientId + candidate{productType, amountEur, marginBps} required' });
      return;
    }

    const asOfDate = typeof body.asOfDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.asOfDate)
      ? body.asOfDate
      : new Date().toISOString().slice(0, 10);

    const rel = await loadRelationship(req.tenancy.entityId, clientId, asOfDate);
    if (!rel) {
      res.status(404).json({ code: 'not_found', message: 'Client not found' });
      return;
    }

    const assumptions = defaultAssumptions(asOfDate, body.assumptions ?? {});
    const before = computeLtv(rel, assumptions);

    const candidate: DealCandidate = {
      productType: String(c.productType),
      currency: String(c.currency ?? 'EUR'),
      amountEur: Number(c.amountEur),
      tenorYears: Number(c.tenorYears ?? 5),
      rateBps: Number(c.rateBps ?? 0),
      marginBps: Number(c.marginBps),
      capitalEur: Number(c.capitalEur ?? (Number(c.amountEur) * assumptions.capitalAllocationRate)),
      rarocAnnual: c.rarocAnnual,
    };
    const impact = computeMarginalLtvImpact(rel, candidate, before, assumptions);

    res.json({
      before: {
        clvPointEur: before.clvPointEur,
        clvP5Eur: before.clvP5Eur,
        clvP95Eur: before.clvP95Eur,
      },
      impact,
      assumptions: before.assumptions,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
