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
import {
  sendPushToMany,
  getVapidPublicKey,
  isWebPushConfigured,
  type PushPayload,
} from '../integrations/webPushSender';

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
// GET /push/vapid-public-key — el cliente la usa para pushManager.subscribe
// ---------------------------------------------------------------------------

router.get('/push/vapid-public-key', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      res.status(503).json({
        code: 'no_vapid_config',
        message: 'Web Push not configured on this deployment (set VAPID_PUBLIC_KEY/PRIVATE_KEY env vars).',
      });
      return;
    }
    res.json({ publicKey, configured: true });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /push/test — Envío real con web-push (Ola 10 Bloque C, post-stub)
// ---------------------------------------------------------------------------

interface SubscriptionForSend {
  id:           string;
  endpoint:     string;
  keys_p256dh:  string;
  keys_auth:    string;
}

router.post('/push/test', async (req, res) => {
  try {
    const tenancy = requireTenancy(req, res);
    if (!tenancy) return;

    const rows = await query<SubscriptionForSend>(
      `SELECT id, endpoint, keys_p256dh, keys_auth FROM push_subscriptions
       WHERE entity_id = $1 AND user_email = $2`,
      [tenancy.entityId, tenancy.userEmail],
    );

    // Sin VAPID configurado, devolvemos 503 explícito para que el caller
    // muestre el error ops claro (no fail loud, no false positive).
    if (!isWebPushConfigured()) {
      res.status(503).json({
        code: 'no_vapid_config',
        message: 'VAPID keys missing. Set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY env vars (and VAPID_SUBJECT).',
        subscriptionCount: rows.length,
      });
      return;
    }

    const payload: PushPayload = {
      title: 'N-Pricing — push test',
      body:  typeof req.body?.message === 'string'
        ? req.body.message
        : 'Test notification from N-Pricing.',
      url:   '/approvals',
      tag:   `push-test-${Date.now()}`,
      data:  { kind: 'push-test' },
    };

    const report = await sendPushToMany(
      rows.map((row) => ({
        endpoint:    row.endpoint,
        keysP256dh:  row.keys_p256dh,
        keysAuth:    row.keys_auth,
      })),
      payload,
    );

    // Purga subscripciones stale (410/404) — el navegador ya las invalidó.
    if (report.staleEndpoints.length > 0) {
      await query(
        `DELETE FROM push_subscriptions
         WHERE entity_id = $1 AND user_email = $2 AND endpoint = ANY($3::text[])`,
        [tenancy.entityId, tenancy.userEmail, report.staleEndpoints],
      );
    }

    res.json({
      delivered:         report.delivered,
      total:             report.total,
      staleEndpointsPurged: report.staleEndpoints.length,
      failures:          report.failures,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
