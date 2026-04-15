/**
 * In-process token bucket rate limiter.
 *
 * One bucket per (apiKeyId). Capacity = burst, refill = rpm/60 tokens per
 * second. Tokens are integers; sub-second granularity is achieved by tracking
 * the fractional debt in `lastTokens`.
 *
 * For SaaS multi-replica deployments this is best moved to Redis (or
 * Vercel Runtime Cache) — the interface is minimal so a swap is trivial.
 */

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

const STATE = new Map<string, BucketState>();

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface BucketSpec {
  capacity: number;        // burst limit
  refillPerSec: number;    // rpm/60
}

export function consume(
  bucketId: string,
  spec: BucketSpec,
  now: number = Date.now(),
  cost: number = 1,
): ConsumeResult {
  const cap = Math.max(1, spec.capacity);
  const rate = Math.max(1 / 3600, spec.refillPerSec); // never zero — at minimum 1 token/hour
  let state = STATE.get(bucketId);
  if (!state) {
    state = { tokens: cap, lastRefillMs: now };
    STATE.set(bucketId, state);
  } else {
    const elapsedSec = Math.max(0, (now - state.lastRefillMs) / 1000);
    state.tokens = Math.min(cap, state.tokens + elapsedSec * rate);
    state.lastRefillMs = now;
  }

  if (state.tokens >= cost) {
    state.tokens -= cost;
    return {
      allowed: true,
      remaining: Math.floor(state.tokens),
      retryAfterMs: 0,
    };
  }

  const deficit = cost - state.tokens;
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: Math.ceil((deficit / rate) * 1000),
  };
}

// Test helpers
export function _resetBuckets(): void { STATE.clear(); }
export function _bucketCount(): number { return STATE.size; }
