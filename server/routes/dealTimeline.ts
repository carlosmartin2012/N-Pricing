import { Router } from 'express';
import { query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { buildDealTimeline } from '../../utils/dealTimeline/aggregator';
import type {
  DealRow,
  DossierRow,
  EscalationRow,
  PricingSnapshotRow,
} from '../../types/dealTimeline';

/**
 * GET /api/deals/:id/timeline — Ola 7 Bloque A.
 *
 * Aggregates pricing snapshots, approval escalations and signed dossiers
 * for a single deal into a chronological DealTimeline. Read-only, entity
 * scoped via the standard tenancy middleware. Routes are mounted *after*
 * the main dealsRouter so the existing `GET /:id` keeps matching deal
 * lookups (Express path matching is exact — `/D-123/timeline` does not
 * match `/:id`).
 */

const router = Router();

router.get('/:id/timeline', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const entityId = req.tenancy.entityId;
    const dealId = req.params.id;

    const deal = await queryOne<DealRow>(
      `SELECT id, entity_id, status, created_at, updated_at
       FROM deals WHERE id = $1 AND entity_id = $2 LIMIT 1`,
      [dealId, entityId],
    );
    if (!deal) {
      res.status(404).json({ code: 'not_found', message: 'Deal not found' });
      return;
    }

    const [snapshots, escalations, dossiers] = await Promise.all([
      query<PricingSnapshotRow>(
        `SELECT id, deal_id, entity_id, total_ftp, final_client_rate, raroc,
                engine_version, created_by_email, created_at
         FROM pricing_snapshots
         WHERE deal_id = $1 AND entity_id = $2
         ORDER BY created_at ASC LIMIT 500`,
        [dealId, entityId],
      ),
      query<EscalationRow>(
        `SELECT id, deal_id, entity_id, level, status, due_at,
                notified_at, resolved_at, created_at
         FROM approval_escalations
         WHERE deal_id = $1 AND entity_id = $2
         ORDER BY created_at ASC LIMIT 200`,
        [dealId, entityId],
      ),
      query<DossierRow>(
        `SELECT id, deal_id, entity_id, pricing_snapshot_id, payload_hash,
                signature_hex, signed_by_email, signed_at
         FROM signed_committee_dossiers
         WHERE deal_id = $1 AND entity_id = $2
         ORDER BY signed_at ASC LIMIT 100`,
        [dealId, entityId],
      ),
    ]);

    const timeline = buildDealTimeline({ deal, snapshots, escalations, dossiers });
    res.json(timeline);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
