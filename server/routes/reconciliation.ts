import { Router } from 'express';
import { query } from '../db';
import { safeError } from '../middleware/errorHandler';
import { entityScopedClause } from '../middleware/requireTenancy';
import {
  matchEntries,
  summariseEntries,
  type UnmatchedInput,
} from '../../utils/reconciliation/matchEntries';
import type { EntryPair, LedgerSide, ReconciliationSummary } from '../../types/reconciliation';

/**
 * FTP Reconciliation — controller-grade view of BU ↔ Treasury journal
 * matching. Phase 6.9 MVP.
 *
 * Data sourcing (MVP strategy):
 *   - BU side: derive from `pricing_snapshots` + `deals`. Every time the
 *     engine prices a booked deal, it records the client rate and EUR
 *     amount. That is our BU journal proxy until the bank wires its real
 *     product-control feed.
 *   - Treasury side: derived from the same `pricing_snapshots` but using
 *     the engine's FTP rate as the Treasury mirror. In real deployments
 *     this row comes from the Treasury book of record (feed).
 *
 * Because both sides in MVP are derived from the same source, the feed is
 * by construction matched for every booked deal. The value of the view
 * still stands because:
 *   1. It shows the controller the *shape* of the reconciliation UI and
 *      what it will look like with real mismatches.
 *   2. Once the bank wires the Treasury feed, the engine picks up real
 *      drift and the unmatched counts start being non-zero.
 *   3. Deals without a snapshot show up as `bu_only` (booked but never
 *      priced), which is a genuine regression signal today.
 */

const router = Router();

interface DealRow {
  id: string;
  client_id: string | null;
  client_name: string | null;
  business_unit: string | null;
  product_type: string | null;
  amount: string;
  currency: string | null;
  created_at: string;
}

interface SnapshotRow {
  deal_id: string | null;
  output_final_client_rate: string | null;
  output_total_ftp: string | null;
  as_of_date: string | null;
}

function toLedgerSide(deal: DealRow, rate: number | null): LedgerSide | null {
  if (rate === null) return null;
  return {
    dealId: deal.id,
    amountEur: Number(deal.amount),
    currency: deal.currency ?? 'EUR',
    ratePct: rate,
    postedAt: (deal.created_at ?? '').slice(0, 10),
  };
}

router.get('/summary', async (req, res) => {
  try {
    const period = typeof req.query.asOf === 'string'
      ? req.query.asOf
      : new Date().toISOString().slice(0, 7); // YYYY-MM

    const dealScope = entityScopedClause(req, 1);
    const deals = await query<DealRow>(
      `SELECT d.id, d.client_id,
              (SELECT c.name FROM clients c WHERE c.id = d.client_id) AS client_name,
              d.business_unit, d.product_type, d.amount, d.currency, d.created_at
       FROM deals d
       ${dealScope.where}
       ORDER BY d.created_at DESC
       LIMIT 500`,
      dealScope.params,
    );

    const dealIds = deals.map((d) => d.id).filter(Boolean);
    let snapshots: SnapshotRow[] = [];
    if (dealIds.length > 0) {
      snapshots = await query<SnapshotRow>(
        `SELECT DISTINCT ON (deal_id)
                deal_id, output_final_client_rate, output_total_ftp, as_of_date
         FROM pricing_snapshots
         WHERE deal_id = ANY($1)
         ORDER BY deal_id, created_at DESC`,
        [dealIds],
      );
    }
    const snapByDeal = new Map<string, SnapshotRow>();
    for (const s of snapshots) {
      if (s.deal_id) snapByDeal.set(s.deal_id, s);
    }

    const inputs: UnmatchedInput[] = deals.map((d) => {
      const snap = snapByDeal.get(d.id);
      const buRate  = snap?.output_final_client_rate != null ? Number(snap.output_final_client_rate) : null;
      const trRate  = snap?.output_total_ftp         != null ? Number(snap.output_total_ftp)         : null;
      return {
        dealId: d.id,
        clientId: d.client_id,
        clientName: d.client_name,
        businessUnit: d.business_unit ?? 'BU_UNKNOWN',
        productType: d.product_type ?? 'UNKNOWN',
        bu: toLedgerSide(d, buRate),
        treasury: toLedgerSide(d, trRate),
      };
    });

    const pairs = matchEntries(inputs);
    const summary: ReconciliationSummary = summariseEntries(pairs, period);
    res.json({ summary, pairs });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/entries', async (req, res) => {
  try {
    const statusFilter = String(req.query.status ?? 'all');
    const period = typeof req.query.asOf === 'string'
      ? req.query.asOf
      : new Date().toISOString().slice(0, 7);

    // Reuse the same logic as /summary — this endpoint exists so the
    // paginated UI can request entries without dragging the summary
    // aggregate if it already has it cached. Kept as a thin wrapper.
    const dealScope = entityScopedClause(req, 1);
    const deals = await query<DealRow>(
      `SELECT d.id, d.client_id,
              (SELECT c.name FROM clients c WHERE c.id = d.client_id) AS client_name,
              d.business_unit, d.product_type, d.amount, d.currency, d.created_at
       FROM deals d
       ${dealScope.where}
       ORDER BY d.created_at DESC
       LIMIT 500`,
      dealScope.params,
    );

    const dealIds = deals.map((d) => d.id).filter(Boolean);
    const snapshots = dealIds.length === 0 ? [] : await query<SnapshotRow>(
      `SELECT DISTINCT ON (deal_id)
              deal_id, output_final_client_rate, output_total_ftp, as_of_date
       FROM pricing_snapshots
       WHERE deal_id = ANY($1)
       ORDER BY deal_id, created_at DESC`,
      [dealIds],
    );
    const snapByDeal = new Map<string, SnapshotRow>();
    for (const s of snapshots) if (s.deal_id) snapByDeal.set(s.deal_id, s);

    const inputs: UnmatchedInput[] = deals.map((d) => {
      const snap = snapByDeal.get(d.id);
      const buRate  = snap?.output_final_client_rate != null ? Number(snap.output_final_client_rate) : null;
      const trRate  = snap?.output_total_ftp         != null ? Number(snap.output_total_ftp)         : null;
      return {
        dealId: d.id,
        clientId: d.client_id,
        clientName: d.client_name,
        businessUnit: d.business_unit ?? 'BU_UNKNOWN',
        productType: d.product_type ?? 'UNKNOWN',
        bu: toLedgerSide(d, buRate),
        treasury: toLedgerSide(d, trRate),
      };
    });

    let pairs: EntryPair[] = matchEntries(inputs);
    if (statusFilter === 'matched' || statusFilter === 'unmatched') {
      pairs = pairs.filter((p) =>
        statusFilter === 'matched' ? p.matchStatus === 'matched' : p.matchStatus !== 'matched' && p.matchStatus !== 'unknown',
      );
    } else if (statusFilter !== 'all') {
      pairs = pairs.filter((p) => p.matchStatus === statusFilter);
    }

    res.json({ asOfPeriod: period, pairs });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
