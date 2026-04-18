import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute, withTransaction } from '../db';
import { safeError } from '../middleware/errorHandler';
import { tenancyScope, entityScopedClause } from '../middleware/requireTenancy';
import {
  any,
  array,
  number,
  object,
  optional,
  string,
  stringEnum,
  validateBody,
} from '../middleware/validate';

const router = Router();

// ─── Validation schemas ─────────────────────────────────────────────────────

// A deal has ~35 columns, most of which are passed through verbatim. We
// validate the handful of fields that gate inserts (identity, money, status)
// and leave the rest as optional passthrough to keep the schema aligned with
// the richer client-side type.
const DealUpsertSchema = object({
  id: optional(string({ maxLength: 128 })),
  status: string({ maxLength: 64 }),
  client_id: optional(string({ maxLength: 128 })),
  client_type: optional(string({ maxLength: 64 })),
  business_unit: optional(string({ maxLength: 128 })),
  funding_business_unit: optional(string({ maxLength: 128 })),
  business_line: optional(string({ maxLength: 128 })),
  product_type: optional(string({ maxLength: 64 })),
  currency: optional(string({ minLength: 3, maxLength: 3 })),
  amount: number({ min: 0, max: 1e15 }),
  start_date: optional(string({ maxLength: 32 })),
  duration_months: optional(number({ min: 0, max: 1200, integer: true })),
  amortization: optional(string({ maxLength: 64 })),
  repricing_freq: optional(string({ maxLength: 64 })),
  margin_target: optional(number({ min: -100, max: 100 })),
  behavioural_model_id: optional(string({ maxLength: 128 })),
  risk_weight: optional(number({ min: 0, max: 1500 })),
  capital_ratio: optional(number({ min: 0, max: 100 })),
  target_roe: optional(number({ min: -100, max: 100 })),
  operational_cost_bps: optional(number({ min: 0, max: 10_000 })),
  lcr_outflow_pct: optional(number({ min: 0, max: 100 })),
  category: optional(string({ maxLength: 32 })),
  drawn_amount: optional(number({ min: 0, max: 1e15 })),
  undrawn_amount: optional(number({ min: 0, max: 1e15 })),
  is_committed: optional(any()),
  lcr_classification: optional(string({ maxLength: 64 })),
  deposit_type: optional(string({ maxLength: 64 })),
  behavioral_maturity_override: optional(any()),
  transition_risk: optional(string({ maxLength: 32 })),
  physical_risk: optional(string({ maxLength: 32 })),
  liquidity_spread: optional(number({ min: -100, max: 100 })),
  liquidity_premium_details: optional(any()),
  clc_charge_details: optional(any()),
  entity_id: optional(string({ maxLength: 128 })),
  version: optional(number({ min: 0, max: 1_000_000, integer: true })),
});

// Batch upsert uses a slimmer payload — enforce the shape and a hard cap of
// 1000 deals per request to prevent memory/DB exhaustion.
const BatchDealSchema = object({
  id: optional(string({ maxLength: 128 })),
  status: string({ maxLength: 64 }),
  client_id: optional(string({ maxLength: 128 })),
  product_type: optional(string({ maxLength: 64 })),
  currency: optional(string({ minLength: 3, maxLength: 3 })),
  amount: number({ min: 0, max: 1e15 }),
  entity_id: optional(string({ maxLength: 128 })),
});
const BatchDealArraySchema = array(BatchDealSchema, { maxLength: 1000 });

// Transition payload: the server derives the rest from `newStatus`.
const ALLOWED_STATUSES = [
  'Draft',
  'Pending_Approval',
  'Approved',
  'Rejected',
  'Booked',
  'Cancelled',
] as const;
const TransitionSchema = object({
  newStatus: stringEnum(ALLOWED_STATUSES),
  userEmail: optional(string({ maxLength: 256 })),
  pricingSnapshot: optional(any()),
});

const nowIso = () => new Date().toISOString();

// Bound pagination inputs to protect the DB from NaN / unbounded scans.
// A missing or malformed query param falls back to `fallback`; anything above
// `max` is clamped down. Avoids `LIMIT NaN` crashes and `LIMIT 999_999_999`
// DoS vectors.
function parsePositiveInt(raw: unknown, fallback: number, max: number): number {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

// Entity scoping rules (all deals reads/writes):
//   - In strict mode (tenancy middleware populated req.tenancy) every query
//     filters by entity_id and writes pin the row to the caller's entity.
//     The entity_id is NEVER taken from the client body — it always comes
//     from req.tenancy so a malicious client cannot forge cross-tenant writes.
//   - In legacy mode (TENANCY_ENFORCE=off) behaviour is unchanged so
//     existing deployments do not regress during rollout.

router.get('/', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    const rows = await query(
      `SELECT * FROM deals ${scope.where} ORDER BY created_at DESC LIMIT 1000`,
      scope.params,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/paginated', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 10_000);
    const pageSize = parsePositiveInt(req.query.pageSize, 50, 500);
    const offset = (page - 1) * pageSize;
    const scope = entityScopedClause(req, 1);
    const rowsSql =
      `SELECT * FROM deals ${scope.where} ORDER BY created_at DESC ` +
      `LIMIT $${scope.params.length + 1} OFFSET $${scope.params.length + 2}`;
    const countSql = `SELECT COUNT(*)::int as count FROM deals ${scope.where}`;
    const [rows, countRows] = await Promise.all([
      query(rowsSql, [...scope.params, pageSize, offset]),
      query<{ count: string }>(countSql, scope.params),
    ]);
    res.json({ data: rows, total: parseInt(countRows[0]?.count ?? '0', 10) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/light', async (req, res) => {
  try {
    const scope = entityScopedClause(req, 1);
    const rows = await query(
      `SELECT id, status, client_id, product_type, amount, currency, entity_id, created_at
       FROM deals ${scope.where} ORDER BY created_at DESC LIMIT 1000`,
      scope.params,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/cursor', async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 50, 500);
    const cursor = req.query.cursor as string | undefined;
    const scope = tenancyScope(req);
    const params: unknown[] = [limit + 1];
    const conditions: string[] = [];
    if (scope.entityId) {
      params.push(scope.entityId);
      conditions.push(`entity_id = $${params.length}`);
    }
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const [cursorDate, cursorId] = decoded.split('|');
      const dateIdx = params.length + 1;
      const idIdx = params.length + 2;
      conditions.push(`(created_at < $${dateIdx} OR (created_at = $${dateIdx} AND id < $${idIdx}))`);
      params.push(cursorDate, cursorId);
    }
    let sql = 'SELECT * FROM deals';
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY created_at DESC, id DESC LIMIT $1';
    const rows = await query(sql, params);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1] as Record<string, unknown>;
      nextCursor = Buffer.from(`${last.created_at}|${last.id}`).toString('base64');
    }
    res.json({ data: pageRows, cursor: nextCursor, hasMore });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    const row = scope.entityId
      ? await queryOne('SELECT * FROM deals WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId])
      : await queryOne('SELECT * FROM deals WHERE id = $1', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/upsert', validateBody(DealUpsertSchema), async (req, res) => {
  try {
    const d = req.body;
    const id = d.id || randomUUID();
    const scope = tenancyScope(req);
    // In strict mode entity_id is pinned to the caller's entity, ignoring
    // whatever the body claims. In legacy mode we keep body.entity_id so
    // callers that already send it can continue to work until strict rolls out.
    const effectiveEntityId = scope.entityId ?? d.entity_id ?? null;
    if (scope.entityId && d.entity_id && d.entity_id !== scope.entityId) {
      res.status(403).json({
        code: 'tenancy_forbidden_write',
        message: 'body.entity_id does not match the authenticated tenancy',
      });
      return;
    }
    // Under strict mode, reject cross-tenant overwrites: if the deal id
    // already exists in another entity, refuse instead of stealing it.
    if (scope.entityId && d.id) {
      const existing = await queryOne<{ entity_id: string }>(
        'SELECT entity_id FROM deals WHERE id = $1',
        [d.id],
      );
      if (existing && existing.entity_id !== scope.entityId) {
        res.status(409).json({
          code: 'entity_mismatch',
          message: 'Deal id exists in another entity',
        });
        return;
      }
    }
    const row = await queryOne(
      `INSERT INTO deals (
        id, status, client_id, client_type, business_unit, funding_business_unit,
        business_line, product_type, currency, amount, start_date, duration_months,
        amortization, repricing_freq, margin_target, behavioural_model_id, risk_weight,
        capital_ratio, target_roe, operational_cost_bps, lcr_outflow_pct, category,
        drawn_amount, undrawn_amount, is_committed, lcr_classification, deposit_type,
        behavioral_maturity_override, transition_risk, physical_risk, liquidity_spread,
        _liquidity_premium_details, _clc_charge_details, entity_id, version, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        client_id = EXCLUDED.client_id,
        client_type = EXCLUDED.client_type,
        business_unit = EXCLUDED.business_unit,
        funding_business_unit = EXCLUDED.funding_business_unit,
        business_line = EXCLUDED.business_line,
        product_type = EXCLUDED.product_type,
        currency = EXCLUDED.currency,
        amount = EXCLUDED.amount,
        start_date = EXCLUDED.start_date,
        duration_months = EXCLUDED.duration_months,
        amortization = EXCLUDED.amortization,
        repricing_freq = EXCLUDED.repricing_freq,
        margin_target = EXCLUDED.margin_target,
        behavioural_model_id = EXCLUDED.behavioural_model_id,
        risk_weight = EXCLUDED.risk_weight,
        capital_ratio = EXCLUDED.capital_ratio,
        target_roe = EXCLUDED.target_roe,
        operational_cost_bps = EXCLUDED.operational_cost_bps,
        lcr_outflow_pct = EXCLUDED.lcr_outflow_pct,
        category = EXCLUDED.category,
        drawn_amount = EXCLUDED.drawn_amount,
        undrawn_amount = EXCLUDED.undrawn_amount,
        is_committed = EXCLUDED.is_committed,
        lcr_classification = EXCLUDED.lcr_classification,
        deposit_type = EXCLUDED.deposit_type,
        behavioral_maturity_override = EXCLUDED.behavioral_maturity_override,
        transition_risk = EXCLUDED.transition_risk,
        physical_risk = EXCLUDED.physical_risk,
        liquidity_spread = EXCLUDED.liquidity_spread,
        _liquidity_premium_details = EXCLUDED._liquidity_premium_details,
        _clc_charge_details = EXCLUDED._clc_charge_details,
        entity_id = EXCLUDED.entity_id,
        version = EXCLUDED.version,
        updated_at = EXCLUDED.updated_at
      RETURNING *`,
      [
        id, d.status, d.client_id, d.client_type, d.business_unit, d.funding_business_unit,
        d.business_line, d.product_type, d.currency, d.amount, d.start_date, d.duration_months,
        d.amortization, d.repricing_freq, d.margin_target, d.behavioural_model_id, d.risk_weight,
        d.capital_ratio, d.target_roe, d.operational_cost_bps, d.lcr_outflow_pct ?? 0,
        d.category ?? 'Asset', d.drawn_amount ?? 0, d.undrawn_amount ?? 0,
        d.is_committed ?? false, d.lcr_classification, d.deposit_type,
        d.behavioral_maturity_override, d.transition_risk, d.physical_risk,
        d.liquidity_spread, d.liquidity_premium_details ? JSON.stringify(d.liquidity_premium_details) : null,
        d.clc_charge_details ? JSON.stringify(d.clc_charge_details) : null,
        effectiveEntityId, d.version ?? 1, nowIso(),
      ],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/batch-upsert', validateBody(BatchDealArraySchema), async (req, res) => {
  try {
    const deals = req.body as Record<string, unknown>[];
    const scope = tenancyScope(req);
    // Batch writes are all-or-nothing for tenancy: if any item tries to
    // write to a different entity than the caller, the whole batch is
    // rejected before touching the DB. Prevents partial cross-tenant leaks
    // and silent fallbacks to a default entity for hostile payloads.
    if (scope.entityId) {
      const mismatch = deals.find((d) => typeof d.entity_id === 'string' && d.entity_id !== scope.entityId);
      if (mismatch) {
        res.status(403).json({
          code: 'tenancy_forbidden_write',
          message: 'One or more deals have entity_id different from the authenticated tenancy',
        });
        return;
      }
    }
    const results = await Promise.all(
      deals.map(async (d) => {
        const id = (d.id as string) || randomUUID();
        const effectiveEntityId = scope.entityId ?? (d.entity_id as string | undefined) ?? null;
        return queryOne('INSERT INTO deals (id, status, client_id, product_type, currency, amount, entity_id, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, updated_at=EXCLUDED.updated_at RETURNING *',
          [id, d.status, d.client_id, d.product_type, d.currency, d.amount, effectiveEntityId, nowIso()]);
      })
    );
    res.json(results.filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/:id/transition', validateBody(TransitionSchema), async (req, res) => {
  try {
    const { newStatus, userEmail, pricingSnapshot } = req.body;
    const updates: Record<string, unknown> = { status: newStatus, updated_at: nowIso() };
    if (newStatus === 'Approved') {
      updates.approved_by = userEmail;
      updates.approved_at = nowIso();
    }
    if (newStatus === 'Pending_Approval' && pricingSnapshot) {
      updates.pricing_snapshot = JSON.stringify(pricingSnapshot);
      updates.locked_at = nowIso();
      updates.locked_by = userEmail;
    }
    if (newStatus === 'Booked') {
      updates.locked_at = nowIso();
      updates.locked_by = userEmail;
    }
    if (newStatus === 'Draft' || newStatus === 'Rejected') {
      updates.locked_at = null;
      updates.locked_by = null;
      updates.approved_by = null;
      updates.approved_at = null;
    }
    const keys = Object.keys(updates);
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const scope = tenancyScope(req);
    const entityClause = scope.entityId ? ` AND entity_id = $${keys.length + 2}` : '';
    const params = scope.entityId
      ? [req.params.id, ...Object.values(updates), scope.entityId]
      : [req.params.id, ...Object.values(updates)];
    const row = await queryOne(
      `UPDATE deals SET ${setClauses} WHERE id = $1${entityClause} RETURNING *`,
      params,
    );
    if (!row) {
      res.status(404).json({ code: 'not_found', message: 'Deal not found in this entity' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/:id/lock-update', async (req, res) => {
  try {
    const { deal, expectedVersion } = req.body ?? {};
    if (!deal || typeof expectedVersion !== 'number') {
      return res.status(400).json({ error: 'deal and expectedVersion are required' });
    }
    // Atomic optimistic-concurrency update: the WHERE clause enforces that the
    // row is still at `expectedVersion`. If another writer bumped it in the
    // meantime, no row is returned and we surface the current server state.
    // This replaces a TOCTOU SELECT + UPDATE pair that lived on two separate
    // pool clients and could silently clobber concurrent edits.
    const newVersion = (deal.version ?? expectedVersion) + 1;
    const scope = tenancyScope(req);
    const updated = scope.entityId
      ? await queryOne(
          'UPDATE deals SET status=$2, client_id=$3, amount=$4, version=$5, updated_at=$6 WHERE id=$1 AND version=$7 AND entity_id=$8 RETURNING *',
          [req.params.id, deal.status, deal.client_id, deal.amount, newVersion, nowIso(), expectedVersion, scope.entityId],
        )
      : await queryOne(
          'UPDATE deals SET status=$2, client_id=$3, amount=$4, version=$5, updated_at=$6 WHERE id=$1 AND version=$7 RETURNING *',
          [req.params.id, deal.status, deal.client_id, deal.amount, newVersion, nowIso(), expectedVersion],
        );
    if (updated) {
      return res.json({ conflict: false, deal: updated });
    }
    const existing = scope.entityId
      ? await queryOne('SELECT * FROM deals WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId])
      : await queryOne('SELECT * FROM deals WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ conflict: false, deal: null });
    return res.json({ conflict: true, deal: null, serverVersion: existing });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const scope = tenancyScope(req);
    if (scope.entityId) {
      await execute('DELETE FROM deals WHERE id = $1 AND entity_id = $2', [req.params.id, scope.entityId]);
    } else {
      await execute('DELETE FROM deals WHERE id = $1', [req.params.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/rename', async (req, res) => {
  try {
    const { nextId } = req.body ?? {};
    if (!nextId || typeof nextId !== 'string') {
      return res.status(400).json({ error: 'nextId is required' });
    }
    const previousId = req.params.id;
    // Wrap the full rename in a single transaction so that insert, child-table
    // reparenting and delete either all commit or all roll back. Without the
    // transaction a failure midway left orphaned rows or dangling FKs.
    const scope = tenancyScope(req);
    const inserted = await withTransaction(async (tx) => {
      const existing = scope.entityId
        ? await tx.queryOne('SELECT 1 FROM deals WHERE id = $1 AND entity_id = $2', [previousId, scope.entityId])
        : await tx.queryOne('SELECT 1 FROM deals WHERE id = $1', [previousId]);
      if (!existing) return null;
      // Reject if the target ID is already taken — regardless of entity, so
      // a rename cannot collide with another tenant's deal either.
      const collision = await tx.queryOne('SELECT 1 FROM deals WHERE id = $1', [nextId]);
      if (collision) throw new Error('Target deal id already exists');
      const insertedRow = await tx.queryOne(
        'INSERT INTO deals SELECT $1 as id, status, client_id, client_type, business_unit, funding_business_unit, business_line, product_type, currency, amount, start_date, duration_months, amortization, repricing_freq, margin_target, behavioural_model_id, risk_weight, capital_ratio, target_roe, operational_cost_bps, lcr_outflow_pct, category, drawn_amount, undrawn_amount, is_committed, lcr_classification, deposit_type, behavioral_maturity_override, transition_risk, physical_risk, liquidity_spread, _liquidity_premium_details, _clc_charge_details, entity_id, version, locked_at, locked_by, approved_by, approved_at, pricing_snapshot, created_by, created_at, $2 FROM deals WHERE id = $3 RETURNING *',
        [nextId, nowIso(), previousId],
      );
      await tx.execute('UPDATE pricing_results SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]);
      await tx.execute('UPDATE deal_versions SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]);
      await tx.execute('UPDATE deal_comments SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]);
      await tx.execute('UPDATE notifications SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]);
      await tx.execute('DELETE FROM deals WHERE id = $1', [previousId]);
      return insertedRow;
    });
    if (!inserted) return res.status(404).json({ error: 'Deal not found' });
    res.json(inserted);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// Child tables (deal_versions, deal_comments, pricing_results) do not own an
// entity_id column — they inherit tenancy from the parent deal. Every child
// read/write therefore goes through a parent-deal existence check so a
// client cannot access child rows belonging to another tenant.
async function assertDealInScope(req: import('express').Request, dealId: string): Promise<boolean> {
  const scope = tenancyScope(req);
  if (!scope.entityId) return true;
  const parent = await queryOne<{ id: string }>(
    'SELECT id FROM deals WHERE id = $1 AND entity_id = $2',
    [dealId, scope.entityId],
  );
  return parent !== null;
}

router.get('/:id/versions', async (req, res) => {
  try {
    if (!(await assertDealInScope(req, req.params.id))) {
      return res.status(404).json({ code: 'not_found', message: 'Deal not found in this entity' });
    }
    const rows = await query('SELECT * FROM deal_versions WHERE deal_id = $1 ORDER BY version DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/versions', async (req, res) => {
  try {
    if (!(await assertDealInScope(req, req.params.id))) {
      return res.status(404).json({ code: 'not_found', message: 'Deal not found in this entity' });
    }
    const { version, snapshot, pricingResult, changedBy, changeReason } = req.body;
    await execute(
      'INSERT INTO deal_versions (deal_id, version, snapshot, pricing_result, changed_by, change_reason) VALUES ($1,$2,$3,$4,$5,$6)',
      [req.params.id, version, JSON.stringify(snapshot), pricingResult ? JSON.stringify(pricingResult) : null, changedBy, changeReason ?? null],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/:id/comments', async (req, res) => {
  try {
    if (!(await assertDealInScope(req, req.params.id))) {
      return res.status(404).json({ code: 'not_found', message: 'Deal not found in this entity' });
    }
    const rows = await query('SELECT * FROM deal_comments WHERE deal_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    if (!(await assertDealInScope(req, req.params.id))) {
      return res.status(404).json({ code: 'not_found', message: 'Deal not found in this entity' });
    }
    const { userEmail, userName, action, comment } = req.body;
    await execute(
      'INSERT INTO deal_comments (deal_id, user_email, user_name, action, comment) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, userEmail, userName, action, comment],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/:id/pricing-history', async (req, res) => {
  try {
    if (!(await assertDealInScope(req, req.params.id))) {
      return res.status(404).json({ code: 'not_found', message: 'Deal not found in this entity' });
    }
    const rows = await query('SELECT * FROM pricing_results WHERE deal_id = $1 ORDER BY version DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/pricing-results', async (req, res) => {
  try {
    if (!(await assertDealInScope(req, req.params.id))) {
      return res.status(404).json({ code: 'not_found', message: 'Deal not found in this entity' });
    }
    const r = req.body ?? {};
    // The previous implementation ran `SELECT ... FOR UPDATE` and the INSERT on
    // two separate pool clients, so the row-lock was released as soon as the
    // SELECT returned. Two concurrent writers could then read the same
    // next_version and race to insert duplicates. Running both statements
    // inside one transaction pins them to the same client and enforces the
    // lock window.
    const version = await withTransaction(async (tx) => {
      const rows = await tx.query<{ next_version: number }>(
        'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM pricing_results WHERE deal_id = $1 FOR UPDATE',
        [req.params.id],
      );
      const nextVersion = Number(rows[0]?.next_version ?? 1);
      await tx.execute(
        `INSERT INTO pricing_results (deal_id, version, base_rate, liquidity_spread, strategic_spread, option_cost, regulatory_cost, lcr_cost, nsfr_cost, operational_cost, capital_charge, esg_transition_charge, esg_physical_charge, floor_price, technical_price, target_price, total_ftp, final_client_rate, raroc, economic_profit, approval_level, matched_methodology, match_reason, formula_used, behavioral_maturity_used, incentivisation_adj, capital_income, calculated_by, deal_snapshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
        [req.params.id, nextVersion, r.baseRate, r.liquiditySpread, r.strategicSpread, r.optionCost, r.regulatoryCost, r.lcrCost ?? 0, r.nsfrCost ?? 0, r.operationalCost, r.capitalCharge, r.esgTransitionCharge, r.esgPhysicalCharge, r.floorPrice, r.technicalPrice, r.targetPrice, r.totalFTP, r.finalClientRate, r.raroc, r.economicProfit, r.approvalLevel, r.matchedMethodology, r.matchReason, r.formulaUsed ?? null, r.behavioralMaturityUsed ?? null, r.incentivisationAdj ?? null, r.capitalIncome ?? null, r.calculatedBy, r.dealSnapshot ? JSON.stringify(r.dealSnapshot) : null],
      );
      return nextVersion;
    });
    res.json({ ok: true, version });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
