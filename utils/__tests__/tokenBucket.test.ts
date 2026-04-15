import { describe, it, expect, beforeEach } from 'vitest';
import { consume, _resetBuckets, _bucketCount } from '../channels/tokenBucket';

describe('tokenBucket', () => {
  beforeEach(() => _resetBuckets());

  it('starts each bucket at full capacity', () => {
    const r = consume('k1', { capacity: 5, refillPerSec: 1 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('rejects after capacity is exhausted within a single instant', () => {
    const spec = { capacity: 3, refillPerSec: 1 };
    const t = 1_000;
    expect(consume('k1', spec, t).allowed).toBe(true);
    expect(consume('k1', spec, t).allowed).toBe(true);
    expect(consume('k1', spec, t).allowed).toBe(true);
    const denied = consume('k1', spec, t);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it('refills tokens over time', () => {
    const spec = { capacity: 2, refillPerSec: 2 }; // 2 tokens / s
    const t0 = 1_000;
    consume('k1', spec, t0);
    consume('k1', spec, t0);
    expect(consume('k1', spec, t0).allowed).toBe(false);
    expect(consume('k1', spec, t0 + 600).allowed).toBe(true); // 1.2 tokens refilled
  });

  it('caps tokens at capacity even after long idle', () => {
    const spec = { capacity: 2, refillPerSec: 5 };
    const t0 = 1_000;
    consume('k1', spec, t0);
    consume('k1', spec, t0);
    // Wait an hour
    const r = consume('k1', spec, t0 + 3600 * 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1); // capacity 2, consumed 1
  });

  it('isolates buckets per id', () => {
    consume('a', { capacity: 1, refillPerSec: 1 });
    expect(consume('b', { capacity: 1, refillPerSec: 1 }).allowed).toBe(true);
    expect(_bucketCount()).toBe(2);
  });

  it('reports retryAfter proportional to deficit', () => {
    const spec = { capacity: 2, refillPerSec: 2 }; // 2 tokens/s → 500ms per token
    const t = 1_000;
    consume('k1', spec, t);
    consume('k1', spec, t);
    const denied = consume('k1', spec, t, 1);
    expect(denied.retryAfterMs).toBe(500);
  });
});
