/**
 * Ola 9 Bloque B — Core Banking router (HOST mainframe reconciliation).
 *
 * Endpoint:
 *   GET /reconciliation?as_of=YYYY-MM-DD[&tolerance_bps=N]
 *     - Pulls booked rows from the registered core_banking adapter
 *       (via pullBookedRows).
 *     - Reads pricing_snapshots most recent per deal for the same entity.
 *     - Cruza con `reconcileBookedVsPricing` y devuelve outcomes + summary.
 *
 * Tenancy-scoped. El adapter HOST en producción es per-deployment del
 * banco, pero mantenemos el guard para defense-in-depth.
 */

import { Router } from 'express';
import { adapterRegistry } from '../../integrations/registry';
import { query } from '../db';
import { safeError } from '../middleware/errorHandler';
import {
  reconcileBookedVsPricing,
  summarizeReconciliation,
  type PricingSnapshotPair,
} from '../../utils/coreBanking/hostReconciliationMatcher';

const router = Router();

interface SnapshotRow {
  deal_id: string;
  output: { finalClientRate?: number } | null;
  output_hash: string;
  created_at: string | Date;
}

router.get('/reconciliation', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const adapter = adapterRegistry.coreBanking();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No core_banking adapter registered' });
      return;
    }
    if (!adapter.pullBookedRows) {
      res.status(501).json({ code: 'not_implemented', message: 'Adapter does not support reconciliation pull' });
      return;
    }

    // Idéntica política a admission /reconciliation: ausente → today,
    // presente + inválido → 400 (no fallback silencioso).
    let asOfDate: string;
    if (req.query.as_of === undefined) {
      asOfDate = new Date().toISOString().slice(0, 10);
    } else if (typeof req.query.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.as_of)) {
      asOfDate = req.query.as_of;
    } else {
      res.status(400).json({
        code: 'invalid_as_of_format',
        message: 'as_of must be a YYYY-MM-DD date',
      });
      return;
    }

    const toleranceBps = (() => {
      const raw = parseFloat(String(req.query.tolerance_bps ?? '0.5'));
      return Number.isFinite(raw) && raw >= 0 ? raw : 0.5;
    })();

    const [bookedResult, pricingRows] = await Promise.all([
      adapter.pullBookedRows(asOfDate),
      query<SnapshotRow>(
        `SELECT DISTINCT ON (deal_id) deal_id, output, output_hash, created_at
         FROM pricing_snapshots
         WHERE entity_id = $1 AND deal_id IS NOT NULL
           AND created_at <= ($2::date + interval '1 day')
         ORDER BY deal_id, created_at DESC`,
        [req.tenancy.entityId, asOfDate],
      ),
    ]);

    if (!bookedResult.ok) {
      res.status(502).json({ code: bookedResult.error.code, message: bookedResult.error.message });
      return;
    }

    const pricingPairs: PricingSnapshotPair[] = pricingRows
      .map((row) => {
        const final = row.output?.finalClientRate;
        if (typeof final !== 'number') return null;
        return {
          dealId:              row.deal_id,
          pricingSnapshotHash: row.output_hash,
          finalClientRateBps:  final * 10_000,
          lastSnapshotAt:      row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at,
        };
      })
      .filter((pair): pair is PricingSnapshotPair => pair !== null);

    const outcomes = reconcileBookedVsPricing(bookedResult.value, pricingPairs, { toleranceBps });
    const summary = summarizeReconciliation(outcomes);

    res.json({
      asOfDate,
      toleranceBps,
      summary,
      outcomes,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/health', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const adapter = adapterRegistry.coreBanking();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No core_banking adapter registered' });
      return;
    }
    const health = await adapter.health();
    res.json({ kind: adapter.kind, name: adapter.name, health });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
