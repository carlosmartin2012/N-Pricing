import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Assigns a request correlation id to every incoming request.
 *
 * - Reuses the inbound `x-request-id` header if the client supplied one and it
 *   passes a conservative shape check (uuid-ish, 8..128 chars, safe charset).
 * - Otherwise generates a UUIDv4 (good enough for correlation; we'd switch to
 *   UUIDv7 if Node gains native support).
 * - Always echoes the final id back in the response header so the client can
 *   reference it in bug reports and server logs line up.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

function acceptClientId(raw: string | undefined): string | null {
  if (!raw) return null;
  return SAFE_REQUEST_ID.test(raw) ? raw : null;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const inbound = typeof req.headers['x-request-id'] === 'string'
    ? (req.headers['x-request-id'] as string)
    : undefined;
  const id = acceptClientId(inbound) ?? crypto.randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
}
