// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// activeEntity reads localStorage; jsdom env is enough.
import apiFetch, { apiDelete, apiGet } from '../apiFetch';

describe('apiFetch', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns undefined for 204 No Content (empty body) instead of throwing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    // Without the fix this used to throw "Unexpected end of JSON input"
    // because res.json() ran on an empty body.
    const result = await apiDelete('/target-grid/templates/abc');
    expect(result).toBeUndefined();
  });

  it('returns undefined when content-length is 0 for any 2xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('', { status: 200, headers: { 'content-length': '0' } }),
    );
    const result = await apiFetch('/x');
    expect(result).toBeUndefined();
  });

  it('parses JSON body for normal 200 responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, value: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const result = await apiGet<{ ok: boolean; value: number }>('/x');
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('clears auth token and dispatches auth:token-expired on 401', async () => {
    localStorage.setItem('n_pricing_auth_token', 'stale-token');
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('unauth', { status: 401 }),
    );
    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener('auth:token-expired', handler);
    try {
      await expect(apiGet('/x')).rejects.toThrow(/failed \(401\)/);
      expect(localStorage.getItem('n_pricing_auth_token')).toBeNull();
      expect(events.length).toBe(1);
    } finally {
      window.removeEventListener('auth:token-expired', handler);
    }
  });

  it('propagates non-2xx as Error including status and body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('boom', { status: 500 }),
    );
    await expect(apiGet('/x')).rejects.toThrow(/500.*boom/);
  });
});
