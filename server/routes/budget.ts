/**
 * Ola 9 Bloque C — Budget reconciliation router (ALQUID wrapper).
 *
 * Endpoint:
 *   GET /comparison?period=YYYY-MM[&rate_tolerance_bps=N&volume_tolerance_pct=X]
 *     - Pulls supuestos via BudgetSourceAdapter (ALQUID en BM, in-memory dev).
 *     - Agrega lo realizado del periodo desde pricing_snapshots agrupando
 *       por (segment × productType × currency) con promedio ponderado por
 *       volumen.
 *     - Cruza con `reconcileBudgetVsRealized` y devuelve items + summary.
 *
 *   GET /health → adapter status.
 *
 * Tenancy-scoped. NO escribe a ALQUID — N-Pricing es consumidor read-only.
 */

import { Router } from 'express';
import { adapterRegistry } from '../../integrations/registry';
import { query } from '../db';
import { safeError } from '../middleware/errorHandler';
import {
  reconcileBudgetVsRealized,
  summarizeBudgetVariance,
  type RealizedAggregate,
} from '../../utils/budget/budgetReconciler';

const router = Router();

interface RealizedRow {
  segment: string;
  product_type: string;
  currency: string;
  realized_rate_bps: string | number | null;
  realized_volume_eur: string | number | null;
  realized_raroc_pp: string | number | null;
  deal_count: string | number;
}

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;     // YYYY-MM only for V1

router.get('/health', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const adapter = adapterRegistry.budget();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No budget adapter registered' });
      return;
    }
    const health = await adapter.health();
    res.json({ kind: adapter.kind, name: adapter.name, health });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/comparison', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const adapter = adapterRegistry.budget();
    if (!adapter) {
      res.status(503).json({ code: 'no_adapter', message: 'No budget adapter registered' });
      return;
    }

    // Igual política que /admission, /coreBanking: ausente → mes actual,
    // presente + inválido → 400. Sin esto, `period=2024-13` colapsaba
    // a "este mes" y el dashboard mostraba datos del mes equivocado
    // sin alerta — trazabilidad rota.
    let period: string;
    if (req.query.period === undefined) {
      period = new Date().toISOString().slice(0, 7);
    } else if (typeof req.query.period === 'string' && PERIOD_RE.test(req.query.period)) {
      period = req.query.period;
    } else {
      res.status(400).json({
        code: 'invalid_period_format',
        message: 'period must be YYYY-MM',
      });
      return;
    }

    const rateTolerance = (() => {
      const raw = parseFloat(String(req.query.rate_tolerance_bps ?? '5'));
      return Number.isFinite(raw) && raw >= 0 ? raw : 5;
    })();
    const volumeTolerance = (() => {
      const raw = parseFloat(String(req.query.volume_tolerance_pct ?? '0.10'));
      return Number.isFinite(raw) && raw >= 0 ? raw : 0.10;
    })();

    // Pull budget assumptions desde el adapter (ALQUID o in-memory)
    const assumptionsResult = await adapter.fetchAssumptions(period);
    if (!assumptionsResult.ok) {
      res.status(502).json({ code: assumptionsResult.error.code, message: assumptionsResult.error.message });
      return;
    }

    // Aggregate realized del periodo desde pricing_snapshots + deals
    // Agrupado por segment × productType × currency. Volume-weighted rate.
    const realizedRows = await query<RealizedRow>(
      `SELECT
         COALESCE(d.segment, 'Unknown')      AS segment,
         COALESCE(d.product_type, 'Unknown') AS product_type,
         COALESCE(d.currency, 'EUR')         AS currency,
         CASE WHEN SUM(COALESCE(d.amount, 0)) > 0
              THEN SUM(((s.output->>'finalClientRate')::numeric * 10000)
                       * COALESCE(d.amount, 0))
                   / SUM(COALESCE(d.amount, 0))
              ELSE NULL
         END                                       AS realized_rate_bps,
         SUM(COALESCE(d.amount, 0))                AS realized_volume_eur,
         AVG(NULLIF((s.output->>'raroc')::numeric, 0)) * 100 AS realized_raroc_pp,
         COUNT(DISTINCT s.deal_id)                 AS deal_count
       FROM pricing_snapshots s
       LEFT JOIN deals d ON d.id = s.deal_id
       WHERE s.entity_id = $1
         AND s.deal_id IS NOT NULL
         AND to_char(s.created_at, 'YYYY-MM') = $2
       GROUP BY 1, 2, 3`,
      [req.tenancy.entityId, period],
    );

    const realized: RealizedAggregate[] = realizedRows.map((r) => ({
      period,
      segment:           r.segment,
      productType:       r.product_type,
      currency:          r.currency,
      // realized_rate_bps NULL ⇒ no había deals con amount>0 en esa
      // key (la query usa CASE … ELSE NULL). Mapearlo a 0 colapsaba
      // "sin datos" a "tasa 0%" — el reconciler luego reportaba
      // `under_budget_rate` masivo cuando el estado real es `budget_only`.
      realizedRateBps:   r.realized_rate_bps   === null ? null : Number(r.realized_rate_bps),
      // Volume=0 vs volume=NULL: si SUM(COALESCE(...)) devuelve null es
      // porque no hay rows en el GROUP BY (caso imposible aquí porque
      // el GROUP BY ya generó la fila). 0 es semánticamente correcto.
      realizedVolumeEur: r.realized_volume_eur === null ? 0    : Number(r.realized_volume_eur),
      realizedRarocPp:   r.realized_raroc_pp   === null ? null : Number(r.realized_raroc_pp),
      dealCount:         Number(r.deal_count),
    }));

    const items = reconcileBudgetVsRealized(
      assumptionsResult.value,
      realized,
      { rateToleranceBps: rateTolerance, volumeTolerancePct: volumeTolerance },
    );
    const summary = summarizeBudgetVariance(items);

    res.json({
      period,
      rateToleranceBps:   rateTolerance,
      volumeTolerancePct: volumeTolerance,
      summary,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
