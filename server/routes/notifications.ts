/**
 * Ola 10 Bloque C — Push notifications router.
 *
 * Endpoints:
 *   POST /push/subscribe    → registra Web Push subscription
 *   POST /push/unsubscribe  → elimina la suscripción (por endpoint)
 *   GET  /push/subscriptions → lista propias del usuario (Admin lista todas)
 *   POST /push/test         → STUB que loga y devuelve `{ delivered: 0 }`.
 *                             La integración real con `web-push` + VAPID
 *                             keys queda como follow-up (instalar la lib +
 *                             `VAPID_PRIVATE_KEY/PUBLIC_KEY` env vars).
 *
 * Tenancy-scoped por defense-in-depth.
 */

import { Router } from 'express';
import { query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

interface SubscriptionRow {
  id:            string;
  entity_id:     string;
  user_email:    string;
  endpoint:      string;
  keys_p256dh:   string;
  keys_auth:     string;
  user_agent:    string | null;
  created_at:    string | Date;
  last_seen_at:  string | Date;
}

function toIsoString(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : v;
}

function mapSubscription(row: SubscriptionRow) {
  return {
    id:          row.id,
    entityId:    row.entity_id,
    userEmail:   row.user_email,
    endpoint:    row.endpoint,
    keysP256dh:  row.keys_p256dh,
    keysAuth:    row.keys_auth,
    userAgent:   row.user_agent,
    createdAt:   toIsoString(row.created_at),
    lastSeenAt:  toIsoString(row.last_seen_at),
  };
}

function requireTenancy(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): { entityId: string; userEmail: string } | null {
  if (!req.tenancy) {
    res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
    return null;
  }
  const userEmail = req.tenancy.userEmail;
  if (!userEmail) {
    res.status(400).json({ code: 'user_email_missing', message: 'x-user-email or session required' });
    return null;
  }
  return { entityId: req.tenancy.entityId, userEmail };
}

// ---------------------------------------------------------------------------
// POST /push/subscribe — UPSERT por (entity_id, user_email, endpoint)
// ---------------------------------------------------------------------------

router.post('/push/subscribe', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;

    const body = req.body ?? {};
    const endpoint    = typeof body.endpoint    === 'string' ? body.endpoint    : '';
    const keysP256dh  = typeof body.keysP256dh  === 'string' ? body.keysP256dh  : '';
    const keysAuth    = typeof body.keysAuth    === 'string' ? body.keysAuth    : '';
    const userAgent   = typeof body.userAgent   === 'string' ? body.userAgent   : null;

    if (!endpoint || !keysP256dh || !keysAuth) {
      res.status(400).json({
        code: 'validation_error',
        message: 'endpoint, keysP256dh and keysAuth are required',
      });
      return;
    }

    const row = await queryOne<SubscriptionRow>(
      `INSERT INTO push_subscriptions
         (entity_id, user_email, endpoint, keys_p256dh, keys_auth, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (entity_id, user_email, endpoint)
         DO UPDATE SET
           keys_p256dh  = EXCLUDED.keys_p256dh,
           keys_auth    = EXCLUDED.keys_auth,
           user_agent   = EXCLUDED.user_agent,
           last_seen_at = NOW()
       RETURNING *`,
      [tenancy.entityId, tenancy.userEmail, endpoint, keysP256dh, keysAuth, userAgent],
    );
    if (!row) {
      res.status(500).json({ code: 'insert_failed' });
      return;
    }
    res.status(201).json(mapSubscription(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /push/unsubscribe
// ---------------------------------------------------------------------------

router.post('/push/unsubscribe', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
    if (!endpoint) {
      res.status(400).json({ code: 'validation_error', message: 'endpoint required' });
      return;
    }
    await query(
      `DELETE FROM push_subscriptions
       WHERE entity_id = $1 AND user_email = $2 AND endpoint = $3`,
      [tenancy.entityId, tenancy.userEmail, endpoint],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /push/subscriptions — propias del usuario
// ---------------------------------------------------------------------------

router.get('/push/subscriptions', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const rows = await query<SubscriptionRow>(
      `SELECT * FROM push_subscriptions
       WHERE entity_id = $1 AND user_email = $2
       ORDER BY last_seen_at DESC`,
      [tenancy.entityId, tenancy.userEmail],
    );
    res.json({ items: rows.map(mapSubscription) });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /push/test — STUB hasta que se cablee web-push + VAPID
// ---------------------------------------------------------------------------

router.post('/push/test', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const rows = await query<{ id: string }>(
      `SELECT id FROM push_subscriptions
       WHERE entity_id = $1 AND user_email = $2`,
      [tenancy.entityId, tenancy.userEmail],
    );
    // STUB: el sender real (web-push library) entregará la notif.
    // Aquí sólo logueamos para que el cliente pueda debugger el flow.
    console.info('[push-test]', {
      entityId:           tenancy.entityId,
      userEmail:          tenancy.userEmail,
      subscriptionCount:  rows.length,
      message:            req.body?.message ?? '(default)',
    });
    res.json({
      delivered: 0,
      stub: true,
      subscriptionCount: rows.length,
      message: 'Push sender not yet wired. Install web-push lib + set VAPID_PRIVATE_KEY/PUBLIC_KEY env vars.',
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
