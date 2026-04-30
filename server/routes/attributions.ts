/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A).
 *
 * Server router. Endpoints:
 *
 *   GET    /matrix                   → AttributionMatrix (levels + thresholds activos)
 *   POST   /levels                   → crear nivel (Admin/Risk_Manager)
 *   PATCH  /levels/:id               → actualizar nivel (Admin/Risk_Manager)
 *   POST   /thresholds               → crear threshold
 *   PATCH  /thresholds/:id           → actualizar threshold
 *   POST   /route                    → routeApproval(quote, matrix) sin persistir
 *   POST   /simulate                 → simulate(input, matrix) sin persistir
 *   POST   /decisions/:dealId        → registrar AttributionDecision (append-only)
 *   GET    /decisions                → listado para reporting (paginado)
 *
 * Tenancy: cada handler valida `req.tenancy?.entityId` y rechaza con 400 si
 * falta. Reads scope-ados por entity_id. Writes incluyen entity_id implícito
 * de la tenancy (no se confía en el body).
 */

import { Router } from 'express';
import { query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { routeApproval } from '../../utils/attributions/attributionRouter';
import { simulate } from '../../utils/attributions/attributionSimulator';
import type {
  AttributionLevel,
  AttributionMatrix,
  AttributionQuote,
  AttributionRoutingMetadata,
  AttributionThreshold,
  AttributionDecisionStatus,
  AttributionScope,
  SimulationInput,
} from '../../types/attributions';

const router = Router();

// ---------------------------------------------------------------------------
// Row types + mappers (snake_case ↔ camelCase)
// ---------------------------------------------------------------------------

interface LevelRow {
  id: string;
  entity_id: string;
  name: string;
  parent_id: string | null;
  level_order: number;
  rbac_role: string;
  metadata: Record<string, unknown> | null;
  active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

interface ThresholdRow {
  id: string;
  entity_id: string;
  level_id: string;
  scope: AttributionScope | null;
  deviation_bps_max: string | number | null;
  raroc_pp_min: string | number | null;
  volume_eur_max: string | number | null;
  active_from: string | Date;
  active_to: string | Date | null;
  is_active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function num(v: string | number | null): number | null {
  if (v === null) return null;
  return typeof v === 'string' ? Number(v) : v;
}

function mapLevel(row: LevelRow): AttributionLevel {
  return {
    id:           row.id,
    entityId:     row.entity_id,
    name:         row.name,
    parentId:     row.parent_id,
    levelOrder:   row.level_order,
    rbacRole:     row.rbac_role,
    metadata:     row.metadata ?? {},
    active:       row.active,
    createdAt:    toIsoString(row.created_at),
    updatedAt:    toIsoString(row.updated_at),
  };
}

function mapThreshold(row: ThresholdRow): AttributionThreshold {
  return {
    id:                row.id,
    entityId:          row.entity_id,
    levelId:           row.level_id,
    scope:             row.scope ?? {},
    deviationBpsMax:   num(row.deviation_bps_max),
    rarocPpMin:        num(row.raroc_pp_min),
    volumeEurMax:      num(row.volume_eur_max),
    activeFrom:        toIsoDate(row.active_from),
    activeTo:          row.active_to === null ? null : toIsoDate(row.active_to),
    isActive:          row.is_active,
    createdAt:         toIsoString(row.created_at),
    updatedAt:         toIsoString(row.updated_at),
  };
}

// ---------------------------------------------------------------------------
// Loader — construye la matriz para un entity desde DB
// ---------------------------------------------------------------------------

async function loadMatrix(entityId: string): Promise<AttributionMatrix> {
  const [levels, thresholds] = await Promise.all([
    query<LevelRow>(
      `SELECT * FROM attribution_levels
       WHERE entity_id = $1 AND active = TRUE
       ORDER BY level_order ASC, name ASC`,
      [entityId],
    ),
    query<ThresholdRow>(
      `SELECT * FROM attribution_thresholds
       WHERE entity_id = $1 AND is_active = TRUE
       ORDER BY level_id ASC, active_from DESC`,
      [entityId],
    ),
  ]);
  return {
    entityId,
    levels:     levels.map(mapLevel),
    thresholds: thresholds.map(mapThreshold),
    loadedAt:   new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function requireTenancy(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): { entityId: string; userEmail: string | null; role: string | null } | null {
  if (!req.tenancy) {
    res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
    return null;
  }
  return {
    entityId:  req.tenancy.entityId,
    userEmail: req.tenancy.userEmail ?? null,
    role:      req.tenancy.role ?? null,
  };
}

function requireRole(role: string | null, allowed: string[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

function isValidQuoteBody(body: unknown): body is AttributionQuote {
  if (!body || typeof body !== 'object') return false;
  const q = body as Record<string, unknown>;
  return (
    typeof q.finalClientRateBps === 'number' &&
    typeof q.standardRateBps   === 'number' &&
    typeof q.hardFloorRateBps  === 'number' &&
    typeof q.rarocPp           === 'number' &&
    typeof q.volumeEur         === 'number' &&
    typeof q.scope             === 'object' && q.scope !== null
  );
}

const ALLOWED_DECISIONS: AttributionDecisionStatus[] = [
  'approved', 'rejected', 'escalated', 'expired', 'reverted',
];

// ---------------------------------------------------------------------------
// GET /matrix
// ---------------------------------------------------------------------------

router.get('/matrix', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const matrix = await loadMatrix(tenancy.entityId);
    res.json(matrix);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /levels — crear nivel
// ---------------------------------------------------------------------------

router.post('/levels', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    if (!requireRole(tenancy.role, ['Admin', 'Risk_Manager'])) {
      res.status(403).json({ code: 'forbidden', message: 'Admin or Risk_Manager required' });
      return;
    }

    const body = req.body ?? {};
    const name       = typeof body.name       === 'string' ? body.name.trim() : '';
    const parentId   = body.parentId === null || typeof body.parentId === 'string' ? body.parentId : null;
    const levelOrder = Number.isInteger(body.levelOrder) && body.levelOrder >= 1 ? body.levelOrder : null;
    const rbacRole   = typeof body.rbacRole   === 'string' ? body.rbacRole.trim() : '';
    const metadata   = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

    if (!name || levelOrder === null || !rbacRole) {
      res.status(400).json({
        code: 'validation_error',
        message: 'name, levelOrder (>=1) and rbacRole are required',
      });
      return;
    }

    const row = await queryOne<LevelRow>(
      `INSERT INTO attribution_levels
         (entity_id, name, parent_id, level_order, rbac_role, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenancy.entityId, name, parentId, levelOrder, rbacRole, JSON.stringify(metadata)],
    );
    if (!row) {
      res.status(500).json({ code: 'insert_failed', message: 'Could not create level' });
      return;
    }
    res.status(201).json(mapLevel(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// PATCH /levels/:id — actualizar nivel (incluyendo soft-delete via active=false)
// ---------------------------------------------------------------------------

router.patch('/levels/:id', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    if (!requireRole(tenancy.role, ['Admin', 'Risk_Manager'])) {
      res.status(403).json({ code: 'forbidden', message: 'Admin or Risk_Manager required' });
      return;
    }

    const id = req.params.id;
    const body = req.body ?? {};
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (typeof body.name === 'string') {
      updates.push(`name = $${idx++}`);
      params.push(body.name.trim());
    }
    if (typeof body.parentId === 'string' || body.parentId === null) {
      updates.push(`parent_id = $${idx++}`);
      params.push(body.parentId);
    }
    if (Number.isInteger(body.levelOrder) && body.levelOrder >= 1) {
      updates.push(`level_order = $${idx++}`);
      params.push(body.levelOrder);
    }
    if (typeof body.rbacRole === 'string') {
      updates.push(`rbac_role = $${idx++}`);
      params.push(body.rbacRole.trim());
    }
    if (body.metadata && typeof body.metadata === 'object') {
      updates.push(`metadata = $${idx++}`);
      params.push(JSON.stringify(body.metadata));
    }
    if (typeof body.active === 'boolean') {
      updates.push(`active = $${idx++}`);
      params.push(body.active);
    }

    if (updates.length === 0) {
      res.status(400).json({ code: 'no_updates', message: 'No updatable fields supplied' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id, tenancy.entityId);

    const row = await queryOne<LevelRow>(
      `UPDATE attribution_levels
       SET ${updates.join(', ')}
       WHERE id = $${idx++} AND entity_id = $${idx++}
       RETURNING *`,
      params,
    );
    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Level not found' });
      return;
    }
    res.json(mapLevel(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /thresholds — crear threshold
// ---------------------------------------------------------------------------

router.post('/thresholds', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    if (!requireRole(tenancy.role, ['Admin', 'Risk_Manager'])) {
      res.status(403).json({ code: 'forbidden', message: 'Admin or Risk_Manager required' });
      return;
    }

    const body = req.body ?? {};
    const levelId = typeof body.levelId === 'string' ? body.levelId : null;
    const scope   = body.scope && typeof body.scope === 'object' ? body.scope : {};
    const deviationBpsMax = typeof body.deviationBpsMax === 'number' ? body.deviationBpsMax : null;
    const rarocPpMin      = typeof body.rarocPpMin      === 'number' ? body.rarocPpMin      : null;
    const volumeEurMax    = typeof body.volumeEurMax    === 'number' ? body.volumeEurMax    : null;
    const activeFrom = typeof body.activeFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.activeFrom)
      ? body.activeFrom
      : new Date().toISOString().slice(0, 10);
    const activeTo = typeof body.activeTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.activeTo)
      ? body.activeTo
      : null;

    if (!levelId) {
      res.status(400).json({ code: 'validation_error', message: 'levelId is required' });
      return;
    }
    if (deviationBpsMax === null && rarocPpMin === null && volumeEurMax === null) {
      res.status(400).json({
        code: 'validation_error',
        message: 'At least one of deviationBpsMax, rarocPpMin, volumeEurMax must be provided',
      });
      return;
    }

    const row = await queryOne<ThresholdRow>(
      `INSERT INTO attribution_thresholds
         (entity_id, level_id, scope, deviation_bps_max, raroc_pp_min, volume_eur_max,
          active_from, active_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tenancy.entityId, levelId, JSON.stringify(scope),
        deviationBpsMax, rarocPpMin, volumeEurMax,
        activeFrom, activeTo,
      ],
    );
    if (!row) {
      res.status(500).json({ code: 'insert_failed', message: 'Could not create threshold' });
      return;
    }
    res.status(201).json(mapThreshold(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// PATCH /thresholds/:id — soft-delete o ajustar criterios
// ---------------------------------------------------------------------------

router.patch('/thresholds/:id', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    if (!requireRole(tenancy.role, ['Admin', 'Risk_Manager'])) {
      res.status(403).json({ code: 'forbidden', message: 'Admin or Risk_Manager required' });
      return;
    }

    const id = req.params.id;
    const body = req.body ?? {};
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.scope && typeof body.scope === 'object') {
      updates.push(`scope = $${idx++}`);
      params.push(JSON.stringify(body.scope));
    }
    if (typeof body.deviationBpsMax === 'number' || body.deviationBpsMax === null) {
      updates.push(`deviation_bps_max = $${idx++}`);
      params.push(body.deviationBpsMax);
    }
    if (typeof body.rarocPpMin === 'number' || body.rarocPpMin === null) {
      updates.push(`raroc_pp_min = $${idx++}`);
      params.push(body.rarocPpMin);
    }
    if (typeof body.volumeEurMax === 'number' || body.volumeEurMax === null) {
      updates.push(`volume_eur_max = $${idx++}`);
      params.push(body.volumeEurMax);
    }
    if (typeof body.activeTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.activeTo)) {
      updates.push(`active_to = $${idx++}`);
      params.push(body.activeTo);
    }
    if (typeof body.isActive === 'boolean') {
      updates.push(`is_active = $${idx++}`);
      params.push(body.isActive);
    }

    if (updates.length === 0) {
      res.status(400).json({ code: 'no_updates', message: 'No updatable fields supplied' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id, tenancy.entityId);

    const row = await queryOne<ThresholdRow>(
      `UPDATE attribution_thresholds
       SET ${updates.join(', ')}
       WHERE id = $${idx++} AND entity_id = $${idx++}
       RETURNING *`,
      params,
    );
    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Threshold not found' });
      return;
    }
    res.json(mapThreshold(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /route — evaluación stateless
// ---------------------------------------------------------------------------

router.post('/route', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;

    const body = req.body ?? {};
    if (!isValidQuoteBody(body.quote)) {
      res.status(400).json({
        code: 'validation_error',
        message: 'quote with finalClientRateBps/standardRateBps/hardFloorRateBps/rarocPp/volumeEur/scope is required',
      });
      return;
    }

    const matrix = await loadMatrix(tenancy.entityId);
    if (matrix.levels.length === 0) {
      res.status(409).json({
        code: 'matrix_empty',
        message: 'No active attribution levels configured for this tenant',
      });
      return;
    }

    const result = routeApproval(body.quote, matrix);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /simulate — applyAdjustments + re-route + diff
// ---------------------------------------------------------------------------

router.post('/simulate', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;

    const body = req.body ?? {};
    if (!isValidQuoteBody(body.quote)) {
      res.status(400).json({ code: 'validation_error', message: 'quote required' });
      return;
    }
    const adjustments = (body.proposedAdjustments && typeof body.proposedAdjustments === 'object')
      ? body.proposedAdjustments
      : {};
    const input: SimulationInput = { quote: body.quote, proposedAdjustments: adjustments };

    const matrix = await loadMatrix(tenancy.entityId);
    if (matrix.levels.length === 0) {
      res.status(409).json({
        code: 'matrix_empty',
        message: 'No active attribution levels configured for this tenant',
      });
      return;
    }

    const result = simulate(input, matrix);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /decisions/:dealId — append decisión inmutable
// ---------------------------------------------------------------------------

interface DecisionRow {
  id: string;
  entity_id: string;
  deal_id: string;
  required_level_id: string;
  decided_by_level_id: string | null;
  decided_by_user: string | null;
  decision: AttributionDecisionStatus;
  reason: string | null;
  pricing_snapshot_hash: string;
  routing_metadata: AttributionRoutingMetadata | null;
  decided_at: string | Date;
}

function mapDecision(row: DecisionRow) {
  return {
    id:                  row.id,
    entityId:            row.entity_id,
    dealId:              row.deal_id,
    requiredLevelId:     row.required_level_id,
    decidedByLevelId:    row.decided_by_level_id,
    decidedByUser:       row.decided_by_user,
    decision:            row.decision,
    reason:              row.reason,
    pricingSnapshotHash: row.pricing_snapshot_hash,
    routingMetadata:     row.routing_metadata ?? {
      deviationBps: 0, rarocPp: 0, volumeEur: 0, scope: {},
    } as AttributionRoutingMetadata,
    decidedAt:           toIsoString(row.decided_at),
  };
}

router.post('/decisions/:dealId', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;

    const dealId = req.params.dealId;
    const body = req.body ?? {};

    const requiredLevelId = typeof body.requiredLevelId === 'string' ? body.requiredLevelId : null;
    const decidedByLevelId = typeof body.decidedByLevelId === 'string' ? body.decidedByLevelId : null;
    const decision = typeof body.decision === 'string' ? body.decision : null;
    const pricingSnapshotHash = typeof body.pricingSnapshotHash === 'string' ? body.pricingSnapshotHash : null;
    const routingMetadata = body.routingMetadata && typeof body.routingMetadata === 'object'
      ? body.routingMetadata
      : {};
    const reason = typeof body.reason === 'string' ? body.reason : null;

    if (!requiredLevelId || !decision || !pricingSnapshotHash) {
      res.status(400).json({
        code: 'validation_error',
        message: 'requiredLevelId, decision and pricingSnapshotHash are required',
      });
      return;
    }
    if (!ALLOWED_DECISIONS.includes(decision as AttributionDecisionStatus)) {
      res.status(400).json({
        code: 'validation_error',
        message: `decision must be one of ${ALLOWED_DECISIONS.join(', ')}`,
      });
      return;
    }

    try {
      const row = await queryOne<DecisionRow>(
        `INSERT INTO attribution_decisions
           (entity_id, deal_id, required_level_id, decided_by_level_id, decided_by_user,
            decision, reason, pricing_snapshot_hash, routing_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          tenancy.entityId, dealId, requiredLevelId, decidedByLevelId,
          tenancy.userEmail,
          decision, reason, pricingSnapshotHash, JSON.stringify(routingMetadata),
        ],
      );
      if (!row) {
        res.status(500).json({ code: 'insert_failed', message: 'Could not record decision' });
        return;
      }
      res.status(201).json(mapDecision(row));
    } catch (innerErr) {
      // El trigger validate_attribution_decision_hash() lanza si el hash no
      // existe en pricing_snapshots — devolvemos 422 (Unprocessable Entity).
      const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      if (/unknown pricing_snapshot_hash/i.test(msg)) {
        res.status(422).json({
          code: 'unknown_snapshot_hash',
          message: 'pricingSnapshotHash does not match any pricing_snapshots row for this entity',
        });
        return;
      }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /decisions — listado paginado para reporting
// ---------------------------------------------------------------------------

router.get('/decisions', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;

    const dealId  = typeof req.query.deal_id === 'string'  ? req.query.deal_id  : null;
    const levelId = typeof req.query.level_id === 'string' ? req.query.level_id : null;
    const userId  = typeof req.query.user === 'string'     ? req.query.user     : null;
    const limit  = Math.min(parseInt(String(req.query.limit  ?? '100'), 10) || 100, 500);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'),   10) || 0,   0);

    const wheres: string[] = ['entity_id = $1'];
    const params: unknown[] = [tenancy.entityId];
    let idx = 2;
    if (dealId)  { wheres.push(`deal_id = $${idx++}`);              params.push(dealId); }
    if (levelId) { wheres.push(`(required_level_id = $${idx} OR decided_by_level_id = $${idx})`); params.push(levelId); idx++; }
    if (userId)  { wheres.push(`decided_by_user = $${idx++}`);      params.push(userId); }

    params.push(limit, offset);
    const rows = await query<DecisionRow>(
      `SELECT * FROM attribution_decisions
       WHERE ${wheres.join(' AND ')}
       ORDER BY decided_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      items: rows.map(mapDecision),
      pagination: { limit, offset, returned: rows.length },
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
export { loadMatrix, mapLevel, mapThreshold, mapDecision };
