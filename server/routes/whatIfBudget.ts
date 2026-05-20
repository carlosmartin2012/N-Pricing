import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, withTransaction } from '../db';
import { safeError } from '../middleware/errorHandler';
import {
  asNumber,
  asString,
  isoDate,
  requireMethodologyAuthor,
  tenant,
} from './_whatIfShared';

/**
 * Budget targets — top-down NII/volume/RAROC objectives per
 * product × segment × currency × period. Consumed by What-If's
 * "budget vs grid consistency" view to surface gaps between targets
 * and the methodology-implied output.
 *
 * Split out of whatIf.ts because budget is the most self-contained
 * dominio (no dependency on sandbox/elasticity computation graphs).
 */

const router = Router();

function budgetToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    product: String(row.product ?? ''),
    segment: String(row.segment ?? ''),
    currency: String(row.currency ?? ''),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    period: String(row.period ?? ''),
    targetNii: asNumber(row.target_nii),
    targetVolume: asNumber(row.target_volume),
    targetRaroc: asNumber(row.target_raroc),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

router.get('/', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM budget_targets
       WHERE entity_id = $1
       ORDER BY period DESC, product, segment, currency
       LIMIT 500`,
      [tenancy.entityId],
    );
    res.json(rows.map(budgetToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = asString(body.product);
    const segment = asString(body.segment);
    const currency = asString(body.currency);
    const period = asString(body.period);
    if (!product || !segment || !currency || !period) {
      res.status(400).json({ code: 'invalid_payload' });
      return;
    }
    const row = await withTransaction(async (tx) => {
      const updated = await tx.queryOne<Record<string, unknown>>(
        `UPDATE budget_targets
         SET target_nii = $1, target_volume = $2, target_raroc = $3, updated_at = now()
         WHERE product = $4 AND segment = $5 AND currency = $6 AND entity_id = $7 AND period = $8
         RETURNING *`,
        [
          asNumber(body.targetNii),
          asNumber(body.targetVolume),
          asNumber(body.targetRaroc),
          product,
          segment,
          currency,
          tenancy.entityId,
          period,
        ],
      );
      if (updated) return updated;
      return tx.queryOne<Record<string, unknown>>(
        `INSERT INTO budget_targets
           (id, product, segment, currency, entity_id, period,
            target_nii, target_volume, target_raroc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          asString(body.id, randomUUID()),
          product,
          segment,
          currency,
          tenancy.entityId,
          period,
          asNumber(body.targetNii),
          asNumber(body.targetVolume),
          asNumber(body.targetRaroc),
        ],
      );
    });
    res.status(201).json(row ? budgetToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/consistency', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const snapshotId = asString(req.query.snapshot_id);
    if (!snapshotId) {
      res.status(400).json({ code: 'invalid_params', message: 'snapshot_id required' });
      return;
    }
    const [budgets, cells] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT * FROM budget_targets WHERE entity_id = $1 ORDER BY product, segment, currency`,
        [tenancy.entityId],
      ),
      query<Record<string, unknown>>(
        `SELECT * FROM target_grid_cells WHERE snapshot_id = $1 AND entity_id = $2`,
        [snapshotId, tenancy.entityId],
      ),
    ]);
    const comparisons = budgets.map((budget) => {
      const match = cells.find((cell) => (
        String(cell.product) === String(budget.product) &&
        String(cell.segment) === String(budget.segment) &&
        String(cell.currency) === String(budget.currency)
      ));
      const budgetNii = asNumber(budget.target_nii);
      const budgetVolume = asNumber(budget.target_volume);
      const gridRate = match ? asNumber(match.target_client_rate) : 0;
      const gridImpliedNii = budgetVolume * (gridRate / 100);
      const niiGap = gridImpliedNii - budgetNii;
      return {
        product: String(budget.product),
        segment: String(budget.segment),
        currency: String(budget.currency),
        budgetNii,
        gridImpliedNii,
        niiGap,
        niiGapPct: budgetNii === 0 ? 0 : (niiGap / budgetNii) * 100,
        budgetVolume,
        gridImpliedVolume: budgetVolume,
        volumeGap: 0,
        volumeGapPct: 0,
      };
    });
    res.json(comparisons);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
