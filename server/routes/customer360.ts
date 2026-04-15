import { Router } from 'express';
import { query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import {
  buildClientRelationship,
  mapClientPositionRow,
  mapClientMetricsSnapshotRow,
  mapPricingTargetRow,
} from '../../utils/customer360/relationshipAggregator';
import type { ClientEntity } from '../../types';

const router = Router();

interface ClientRow {
  id: string;
  name: string;
  type: ClientEntity['type'] | null;
  segment: string | null;
  rating: string | null;
}

function mapClient(row: ClientRow): ClientEntity {
  return {
    id:      row.id,
    name:    row.name,
    type:    row.type ?? 'Corporate',
    segment: row.segment ?? '',
    rating:  row.rating ?? 'BBB',
  };
}

router.get('/clients/:clientId', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const entityId = req.tenancy.entityId;
    const clientId = req.params.clientId;
    const asOfDate = typeof req.query.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.as_of)
      ? req.query.as_of
      : new Date().toISOString().slice(0, 10);

    const client = await queryOne<ClientRow>(
      'SELECT id, name, type, segment, rating FROM clients WHERE id = $1 LIMIT 1',
      [clientId],
    );
    if (!client) {
      res.status(404).json({ code: 'not_found', message: 'Client not found' });
      return;
    }

    const [positions, metrics, targets] = await Promise.all([
      query<Parameters<typeof mapClientPositionRow>[0]>(
        `SELECT * FROM client_positions
         WHERE entity_id = $1 AND client_id = $2
         ORDER BY status ASC, start_date DESC`,
        [entityId, clientId],
      ),
      query<Parameters<typeof mapClientMetricsSnapshotRow>[0]>(
        `SELECT * FROM client_metrics_snapshots
         WHERE entity_id = $1 AND client_id = $2
         ORDER BY computed_at DESC LIMIT 24`,
        [entityId, clientId],
      ),
      query<Parameters<typeof mapPricingTargetRow>[0]>(
        `SELECT * FROM pricing_targets
         WHERE entity_id = $1 AND is_active = true`,
        [entityId],
      ),
    ]);

    const aggregate = buildClientRelationship({
      client: mapClient(client),
      positions: positions.map(mapClientPositionRow),
      metricsHistory: metrics.map(mapClientMetricsSnapshotRow),
      targets: targets.map(mapPricingTargetRow),
      asOfDate,
    });
    res.json(aggregate);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/clients/:clientId/positions', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const rows = await query<Parameters<typeof mapClientPositionRow>[0]>(
      `SELECT * FROM client_positions
       WHERE entity_id = $1 AND client_id = $2
       ORDER BY status ASC, start_date DESC`,
      [req.tenancy.entityId, req.params.clientId],
    );
    res.json(rows.map(mapClientPositionRow));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/clients/:clientId/metrics', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '12'), 10) || 12, 1), 60);
    const rows = await query<Parameters<typeof mapClientMetricsSnapshotRow>[0]>(
      `SELECT * FROM client_metrics_snapshots
       WHERE entity_id = $1 AND client_id = $2
       ORDER BY computed_at DESC LIMIT $3`,
      [req.tenancy.entityId, req.params.clientId, limit],
    );
    res.json(rows.map(mapClientMetricsSnapshotRow));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/pricing-targets', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const period = typeof req.query.period === 'string' ? req.query.period : null;
    const segment = typeof req.query.segment === 'string' ? req.query.segment : null;

    const conditions = ['entity_id = $1', 'is_active = true'];
    const params: unknown[] = [req.tenancy.entityId];
    if (period) {
      params.push(period);
      conditions.push(`period = $${params.length}`);
    }
    if (segment) {
      params.push(segment);
      conditions.push(`segment = $${params.length}`);
    }

    const rows = await query<Parameters<typeof mapPricingTargetRow>[0]>(
      `SELECT * FROM pricing_targets
       WHERE ${conditions.join(' AND ')}
       ORDER BY active_from DESC LIMIT 500`,
      params,
    );
    res.json(rows.map(mapPricingTargetRow));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
