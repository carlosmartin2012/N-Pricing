import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne, execute } from '../db';
import { safeError } from '../middleware/errorHandler';
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

router.get('/', async (req, res) => {
  try {
    const { entity_id } = req.query;
    let sql = 'SELECT * FROM deals ORDER BY created_at DESC LIMIT 1000';
    const params: unknown[] = [];
    if (entity_id) {
      sql = 'SELECT * FROM deals WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1000';
      params.push(entity_id);
    }
    const rows = await query(sql, params);
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
    const [rows, countRows] = await Promise.all([
      query('SELECT * FROM deals ORDER BY created_at DESC LIMIT $1 OFFSET $2', [pageSize, offset]),
      query<{ count: string }>('SELECT COUNT(*)::int as count FROM deals'),
    ]);
    res.json({ data: rows, total: parseInt(countRows[0]?.count ?? '0', 10) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/light', async (req, res) => {
  try {
    const { entity_id } = req.query;
    let sql = 'SELECT id, status, client_id, product_type, amount, currency, entity_id, created_at FROM deals ORDER BY created_at DESC LIMIT 1000';
    const params: unknown[] = [];
    if (entity_id) {
      sql = 'SELECT id, status, client_id, product_type, amount, currency, entity_id, created_at FROM deals WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1000';
      params.push(entity_id);
    }
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/cursor', async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 50, 500);
    const cursor = req.query.cursor as string | undefined;
    const entity_id = req.query.entity_id as string | undefined;
    const params: unknown[] = [limit + 1];
    let sql = 'SELECT * FROM deals';
    const conditions: string[] = [];
    if (entity_id) conditions.push(`entity_id = $${params.length + 1}`);
    if (entity_id) params.push(entity_id);
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      const [cursorDate, cursorId] = decoded.split('|');
      conditions.push(`(created_at < $${params.length + 1} OR (created_at = $${params.length + 1} AND id < $${params.length + 2}))`);
      params.push(cursorDate, cursorId);
    }
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
    const row = await queryOne('SELECT * FROM deals WHERE id = $1', [req.params.id]);
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
        d.entity_id, d.version ?? 1, nowIso(),
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
    const results = await Promise.all(
      deals.map(async (d) => {
        const id = (d.id as string) || randomUUID();
        return queryOne('INSERT INTO deals (id, status, client_id, product_type, currency, amount, entity_id, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, updated_at=EXCLUDED.updated_at RETURNING *',
          [id, d.status, d.client_id, d.product_type, d.currency, d.amount, d.entity_id, nowIso()]);
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
    const row = await queryOne(
      `UPDATE deals SET ${setClauses} WHERE id = $1 RETURNING *`,
      [req.params.id, ...Object.values(updates)],
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/:id/lock-update', async (req, res) => {
  try {
    const { deal, expectedVersion } = req.body;
    const existing = await queryOne<{ version: number }>('SELECT version FROM deals WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ conflict: false, deal: null });
    if (existing.version !== expectedVersion) {
      const serverDeal = await queryOne('SELECT * FROM deals WHERE id = $1', [req.params.id]);
      return res.json({ conflict: true, deal: null, serverVersion: serverDeal });
    }
    const d = deal;
    const row = await queryOne(
      'UPDATE deals SET status=$2, client_id=$3, amount=$4, version=$5, updated_at=$6 WHERE id=$1 RETURNING *',
      [req.params.id, d.status, d.client_id, d.amount, (d.version ?? expectedVersion) + 1, nowIso()],
    );
    res.json({ conflict: false, deal: row });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await execute('DELETE FROM deals WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/rename', async (req, res) => {
  try {
    const { nextId } = req.body;
    const previousId = req.params.id;
    const existing = await queryOne('SELECT * FROM deals WHERE id = $1', [previousId]);
    if (!existing) return res.status(404).json({ error: 'Deal not found' });
    const inserted = await queryOne(
      'INSERT INTO deals SELECT $1 as id, status, client_id, client_type, business_unit, funding_business_unit, business_line, product_type, currency, amount, start_date, duration_months, amortization, repricing_freq, margin_target, behavioural_model_id, risk_weight, capital_ratio, target_roe, operational_cost_bps, lcr_outflow_pct, category, drawn_amount, undrawn_amount, is_committed, lcr_classification, deposit_type, behavioral_maturity_override, transition_risk, physical_risk, liquidity_spread, _liquidity_premium_details, _clc_charge_details, entity_id, version, locked_at, locked_by, approved_by, approved_at, pricing_snapshot, created_by, created_at, $2 FROM deals WHERE id = $3 RETURNING *',
      [nextId, nowIso(), previousId],
    );
    await Promise.all([
      execute('UPDATE pricing_results SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]),
      execute('UPDATE deal_versions SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]),
      execute('UPDATE deal_comments SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]),
      execute('UPDATE notifications SET deal_id=$1 WHERE deal_id=$2', [nextId, previousId]),
    ]);
    await execute('DELETE FROM deals WHERE id = $1', [previousId]);
    res.json(inserted);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/:id/versions', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM deal_versions WHERE deal_id = $1 ORDER BY version DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/versions', async (req, res) => {
  try {
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
    const rows = await query('SELECT * FROM deal_comments WHERE deal_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
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
    const rows = await query('SELECT * FROM pricing_results WHERE deal_id = $1 ORDER BY version DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/:id/pricing-results', async (req, res) => {
  try {
    const r = req.body;
    const versionRows = await query<{ next_version: number }>(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM pricing_results WHERE deal_id = $1 FOR UPDATE',
      [req.params.id],
    );
    const version = versionRows[0]?.next_version ?? 1;
    await execute(
      `INSERT INTO pricing_results (deal_id, version, base_rate, liquidity_spread, strategic_spread, option_cost, regulatory_cost, lcr_cost, nsfr_cost, operational_cost, capital_charge, esg_transition_charge, esg_physical_charge, floor_price, technical_price, target_price, total_ftp, final_client_rate, raroc, economic_profit, approval_level, matched_methodology, match_reason, formula_used, behavioral_maturity_used, incentivisation_adj, capital_income, calculated_by, deal_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
      [req.params.id, version, r.baseRate, r.liquiditySpread, r.strategicSpread, r.optionCost, r.regulatoryCost, r.lcrCost ?? 0, r.nsfrCost ?? 0, r.operationalCost, r.capitalCharge, r.esgTransitionCharge, r.esgPhysicalCharge, r.floorPrice, r.technicalPrice, r.targetPrice, r.totalFTP, r.finalClientRate, r.raroc, r.economicProfit, r.approvalLevel, r.matchedMethodology, r.matchReason, r.formulaUsed ?? null, r.behavioralMaturityUsed ?? null, r.incentivisationAdj ?? null, r.capitalIncome ?? null, r.calculatedBy, r.dealSnapshot ? JSON.stringify(r.dealSnapshot) : null],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
