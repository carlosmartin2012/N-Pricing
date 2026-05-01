import type { Request, RequestHandler } from 'express';
import { consume, type ConsumeResult } from '../../utils/channels/tokenBucket';

/**
 * Lightweight per-IP rate limiter for unauthenticated endpoints (`/api/auth/*`).
 *
 * Backed by the existing in-process token bucket. For multi-replica prod
 * deployments (Vercel, K8s with > 1 pod) this should move to a shared store
 * (Redis); the bucket interface is the same so the swap is local. Capacity
 * and refill default to 10 requests / minute / IP, which is generous enough
 * for legitimate UI flows (login → me → entities) while making credential
 * stuffing impractical.
 */

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export interface AuthRateLimitOptions {
  /** Maximum burst — defaults to 10. */
  capacity?: number;
  /** Sustained refill in requests per minute — defaults to 10. */
  rpm?: number;
  /** Bucket key prefix so different routes don't share quota. */
  scope: string;
}

export function authRateLimit(opts: AuthRateLimitOptions): RequestHandler {
  const capacity = Math.max(1, opts.capacity ?? 10);
  const refillPerSec = Math.max(1 / 3600, (opts.rpm ?? 10) / 60);
  return (req, res, next) => {
    const ip = clientIp(req);
    const key = `auth:${opts.scope}:${ip}`;
    const result: ConsumeResult = consume(key, { capacity, refillPerSec });
    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000).toString());
      res.status(429).json({
        code: 'rate_limited',
        message: 'Too many authentication attempts. Try again shortly.',
      });
      return;
    }
    next();
  };
}
