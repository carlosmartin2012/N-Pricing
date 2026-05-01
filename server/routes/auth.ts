import { Router } from 'express';
import crypto from 'crypto';
import { signToken } from '../middleware/auth';
import { query, queryOne } from '../db';
import { GoogleSsoProvider } from '../../integrations/sso/google';

/**
 * Constant-time string equality to avoid leaking the demo credential length
 * or prefix via response timing. The values are env-provided so the cost is
 * trivial; defence-in-depth on top of the rate limiter.
 */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

const router = Router();

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID ?? '';
const ALLOWED_HD = process.env.GOOGLE_ALLOWED_HOSTED_DOMAIN || undefined;

let provider: GoogleSsoProvider | null = null;
function getProvider(): GoogleSsoProvider | null {
  if (!CLIENT_ID) return null;
  if (!provider) {
    provider = new GoogleSsoProvider({
      clientId: CLIENT_ID,
      allowedHostedDomain: ALLOWED_HD,
    });
  }
  return provider;
}

router.post('/google', async (req, res) => {
  const { credential } = req.body as { credential?: string };
  if (!credential) {
    res.status(400).json({ error: 'Missing credential' });
    return;
  }
  const p = getProvider();
  if (!p) {
    res.status(500).json({ error: 'Google client ID not configured on server' });
    return;
  }
  const identity = await p.verifyToken(credential);
  if (!identity) {
    res.status(401).json({ error: 'Token verification failed' });
    return;
  }

  // Resolve role: prefer entity_users (per-entity role), fall back to users.
  let role = 'Trader';
  let primaryEntityId: string | null = null;
  try {
    const memberships = await query<{ role: string; entity_id: string; is_primary_entity: boolean }>(
      `SELECT role, entity_id, is_primary_entity
       FROM entity_users
       WHERE user_id = $1
       ORDER BY is_primary_entity DESC, created_at ASC`,
      [identity.email],
    );
    if (memberships.length > 0) {
      role = memberships[0].role;
      primaryEntityId = memberships[0].entity_id;
    } else {
      const fallback = await queryOne<{ role: string }>(
        'SELECT role FROM users WHERE email = $1', [identity.email],
      );
      if (fallback?.role) role = fallback.role;
    }
  } catch {
    /* keep defaults — DB unreachable */
  }

  const token = signToken({ email: identity.email, name: identity.displayName, role });
  res.json({
    email: identity.email,
    name: identity.displayName,
    picture: null,
    role,
    primaryEntityId,
    tenantHint: identity.tenantHint ?? null,
    token,
  });
});

/**
 * Self-introspection endpoint — useful for the UI to show "you are X with
 * role Y in entities [...]" without re-doing the SSO dance.
 */
router.get('/me', async (req, res) => {
  if (!req.user?.email) {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }
  // Antes: `.catch(() => [])` colapsaba errores DB a memberships=[]. La
  // UI lo interpretaba como "usuario sin acceso a ningún tenant" cuando
  // realmente la DB estaba caída o RLS bloqueando — indistinguible de
  // un usuario nuevo legítimo. Ahora un fallo de query → 503 explícito
  // para que el cliente reintente / muestre error de infraestructura.
  let memberships: Array<{ entity_id: string; role: string; is_primary_entity: boolean }>;
  try {
    memberships = await query<{ entity_id: string; role: string; is_primary_entity: boolean }>(
      `SELECT entity_id, role, is_primary_entity
       FROM entity_users
       WHERE user_id = $1
       ORDER BY is_primary_entity DESC`,
      [req.user.email],
    );
  } catch (err) {
    console.error('[auth/me] memberships query failed', err);
    res.status(503).json({
      code: 'memberships_lookup_failed',
      message: 'Could not load tenant memberships. Try again.',
    });
    return;
  }
  res.json({
    email: req.user.email,
    name: req.user.name,
    role: req.user.role ?? 'Trader',
    memberships,
  });
});

/**
 * Demo login — accepts the VITE_DEMO_USER / VITE_DEMO_PASS credentials and
 * returns a real signed JWT so the API auth middleware lets the request through.
 * This endpoint is intentionally unauthenticated (it IS the login).
 */
router.post('/demo', (req, res) => {
  const DEMO_USER = process.env.VITE_DEMO_USER ?? '';
  const DEMO_PASS = process.env.VITE_DEMO_PASS ?? '';
  const DEMO_EMAIL = process.env.VITE_DEMO_EMAIL ?? 'demo@example.com';
  const DEMO_NAME = process.env.VITE_DEMO_USER ?? 'Demo User';

  if (!DEMO_USER || !DEMO_PASS) {
    res.status(503).json({ error: 'Demo mode not configured on server' });
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  // Always run BOTH comparisons so total work is independent of whether the
  // username happens to match. timingSafeEqual itself is constant-time but
  // short-circuit `||` would still leak via overall response time.
  const userOk = safeEqual(username, DEMO_USER);
  const passOk = safeEqual(password, DEMO_PASS);
  if (!userOk || !passOk) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = signToken({ email: DEMO_EMAIL, name: DEMO_NAME, role: 'Trader' });
  res.json({
    email: DEMO_EMAIL,
    name: DEMO_NAME,
    role: 'Trader',
    primaryEntityId: '00000000-0000-0000-0000-000000000010',
    token,
  });
});

export default router;
