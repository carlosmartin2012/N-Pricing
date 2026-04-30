import { Router } from 'express';
import { query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

const VALID_STATUSES = ['draft','approved','active','exhausted','expired','cancelled'];

router.get('/', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const conditions = ['entity_id = $1'];
    const params: unknown[] = [req.tenancy.entityId];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const rows = await query(
      `SELECT * FROM pricing_campaigns
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT 200`,
      params,
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    const code = String(body?.code ?? '').trim();
    const name = String(body?.name ?? '').trim();
    const segment = String(body?.segment ?? '').trim();
    const productType = String(body?.product_type ?? '').trim();
    if (!code || !name || !segment || !productType) {
      res.status(400).json({ code: 'invalid_payload', message: 'code, name, segment, product_type required' });
      return;
    }
    const row = await queryOne(
      `INSERT INTO pricing_campaigns (
         entity_id, code, name, segment, product_type, currency, channel,
         rate_delta_bps, max_volume_eur, active_from, active_to, status,
         created_by
       ) VALUES (
         $1, $2, $3, $4, $5, COALESCE($6, 'EUR'), $7,
         COALESCE($8, 0), $9, COALESCE($10, CURRENT_DATE), COALESCE($11, CURRENT_DATE + INTERVAL '90 days'),
         'draft', $12
       )
       RETURNING *`,
      [
        req.tenancy.entityId, code, name, segment, productType,
        body?.currency ?? null,
        body?.channel ?? null,
        body?.rate_delta_bps ?? null,
        body?.max_volume_eur ?? null,
        body?.active_from ?? null,
        body?.active_to ?? null,
        req.tenancy.userEmail,
      ],
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    if (!req.tenancy) {
      res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
      return;
    }
    const status = String(req.body?.status ?? '');
    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ code: 'invalid_status', message: `status must be one of ${VALID_STATUSES.join(', ')}` });
      return;
    }
    // Las transiciones a 'approved' / 'active' requieren rol con
    // autoridad. Sin guard, un Trader podía auto-aprobarse su propia
    // campaña (campaigns active aplican delta a quotes de canal).
    if (status === 'approved' || status === 'active') {
      const role = req.tenancy.role ?? null;
      if (role !== 'Admin' && role !== 'Risk_Manager') {
        res.status(403).json({
          code: 'forbidden',
          message: 'Admin or Risk_Manager required to approve/activate campaigns',
        });
        return;
      }
    }
    const setApproved = status === 'approved';
    const row = await queryOne(
      `UPDATE pricing_campaigns
       SET status = $3,
           approved_by = CASE WHEN $4::boolean THEN $5 ELSE approved_by END,
           approved_at = CASE WHEN $4::boolean THEN NOW() ELSE approved_at END,
           updated_at = NOW()
       WHERE id = $1 AND entity_id = $2
       RETURNING *`,
      [req.params.id, req.tenancy.entityId, status, setApproved, req.tenancy.userEmail],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
