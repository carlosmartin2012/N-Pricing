import { Router } from 'express';
import { query } from '../db';
import { safeError } from '../middleware/errorHandler';
import type { UsageAggregateDay, UsageEventKind } from '../../types/metering';

const router = Router();

interface AggRow {
  entity_id: string;
  day: string;
  event_kind: UsageEventKind;
  event_count: string;
  units_total: string;
}

router.get('/usage', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const periodStart = String(req.query.period_start ?? '').trim();
    const periodEnd   = String(req.query.period_end ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
      res.status(400).json({ code: 'invalid_period', message: 'period_start and period_end (YYYY-MM-DD) required' });
      return;
    }
    const rows = await query<AggRow>(
      `SELECT entity_id, day::text AS day, event_kind, event_count::text AS event_count, units_total::text AS units_total
       FROM usage_aggregates_daily
       WHERE entity_id = $1 AND day BETWEEN $2 AND $3
       ORDER BY day ASC, event_kind ASC`,
      [req.tenancy.entityId, periodStart, periodEnd],
    );
    const aggregates: UsageAggregateDay[] = rows.map((r) => ({
      entityId:   r.entity_id,
      day:        r.day,
      eventKind:  r.event_kind,
      eventCount: Number(r.event_count),
      unitsTotal: Number(r.units_total),
    }));
    res.json({ entityId: req.tenancy.entityId, periodStart, periodEnd, aggregates });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/feature-flags', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const rows = await query(
      `SELECT entity_id, flag, enabled, set_by, set_at, notes
       FROM tenant_feature_flags
       WHERE entity_id = $1
       ORDER BY flag ASC`,
      [req.tenancy.entityId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
