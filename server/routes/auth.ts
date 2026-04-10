import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { signToken } from '../middleware/auth';
import { queryOne } from '../db';

const router = Router();

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID ?? '';

router.post('/google', async (req, res) => {
  const { credential } = req.body as { credential?: string };
  if (!credential) {
    res.status(400).json({ error: 'Missing credential' });
    return;
  }
  if (!CLIENT_ID) {
    res.status(500).json({ error: 'Google client ID not configured on server' });
    return;
  }
  try {
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(400).json({ error: 'Token has no email claim' });
      return;
    }
    const name = payload.name ?? payload.email.split('@')[0];

    // Look up user in DB to get role
    let role = 'viewer'; // default role
    try {
      const dbUser = await queryOne<{ role: string }>('SELECT role FROM users WHERE email = $1', [payload.email]);
      if (dbUser?.role) {
        role = dbUser.role;
      }
    } catch {
      // DB lookup failed — proceed with default role
    }

    const token = signToken({ email: payload.email, name, role });
    res.json({
      email: payload.email,
      name,
      picture: payload.picture ?? null,
      token,
    });
  } catch {
    res.status(401).json({ error: 'Token verification failed' });
  }
});

export default router;
