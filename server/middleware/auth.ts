import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const DEV_SECRET_FALLBACK = 'dev-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET_FALLBACK;
const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60; // 8 hours

// Fail fast if we boot in production without an explicit secret. The previous
// behaviour silently fell back to a well-known default, which would have
// allowed anyone to mint valid tokens.
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEV_SECRET_FALLBACK) {
  throw new Error(
    '[auth] JWT_SECRET is required in production. Refusing to start with the dev fallback.',
  );
}

interface JwtPayload {
  email: string;
  name: string;
  role?: string;
  iat: number;
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { email: string; name: string; role?: string };
    }
  }
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString('utf8');
}

export function signToken(payload: { email: string; name: string; role?: string }): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_EXPIRY_SECONDS }),
  );
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expected = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    // Constant-time comparison to prevent timing attacks against the HMAC
    // signature. timingSafeEqual throws if buffers differ in length, so we
    // guard for that explicitly.
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  req.user = { email: payload.email, name: payload.name, role: payload.role };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
