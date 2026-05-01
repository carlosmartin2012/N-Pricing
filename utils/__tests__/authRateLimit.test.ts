// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { authRateLimit } from '../../server/middleware/authRateLimit';
import { _resetBuckets } from '../channels/tokenBucket';

async function withApp<T>(
  fn: (baseUrl: string) => Promise<T>,
  capacity = 3,
  rpm = 1,
): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    // Pin a synthetic client IP so each test has a deterministic bucket key.
    Object.defineProperty(req, 'ip', { value: '203.0.113.7', configurable: true });
    next();
  });
  app.use(authRateLimit({ scope: 'test', capacity, rpm }));
  app.post('/login', (_req, res) => res.json({ ok: true }));
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    (app as unknown as (r: IncomingMessage, s: ServerResponse) => void)(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function post(url: string): Promise<{ status: number; retryAfter: string | null }> {
  const res = await fetch(url, { method: 'POST' });
  return { status: res.status, retryAfter: res.headers.get('retry-after') };
}

describe('authRateLimit', () => {
  beforeEach(() => {
    _resetBuckets();
  });

  it('lets requests through up to capacity then 429s', async () => {
    await withApp(async (url) => {
      const a = await post(`${url}/login`);
      const b = await post(`${url}/login`);
      const c = await post(`${url}/login`);
      const d = await post(`${url}/login`);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(c.status).toBe(200);
      expect(d.status).toBe(429);
      expect(d.retryAfter).not.toBeNull();
    }, 3, 1);
  });

  it('returns Retry-After in seconds when limited', async () => {
    await withApp(async (url) => {
      await post(`${url}/login`);
      await post(`${url}/login`);
      const limited = await post(`${url}/login`);
      expect(limited.status).toBe(429);
      const retry = Number(limited.retryAfter);
      expect(Number.isFinite(retry)).toBe(true);
      expect(retry).toBeGreaterThan(0);
    }, 2, 1);
  });
});
