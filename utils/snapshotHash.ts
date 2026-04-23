/**
 * SHA-256 hashing helpers for pricing snapshots.
 *
 * Works in:
 *   - Node.js 18+ (uses node:crypto createHash — synchronous, no globals needed)
 *   - Browsers / Deno: falls back to globalThis.crypto.subtle if available
 */

import { canonicalJson } from './canonicalJson';

/**
 * Compute sha256 of the canonical JSON representation of `value`.
 * Returns a 64-char lowercase hex string.
 */
export async function sha256CanonicalJson(value: unknown): Promise<string> {
  const canonical = canonicalJson(value);
  return sha256Hex(canonical);
}

export async function sha256Hex(input: string): Promise<string> {
  // Node.js path — synchronous and always available in Node 18+
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }
  // Browser / Deno path — use Web Crypto subtle
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Convenience: hash pricing snapshot input + context (what the engine consumes)
 * together so drift in either field yields a different hash.
 */
export async function hashSnapshotInput(
  input: unknown,
  context: unknown,
): Promise<string> {
  return sha256CanonicalJson({ input, context });
}

export async function hashSnapshotOutput(output: unknown): Promise<string> {
  return sha256CanonicalJson(output);
}

// ─── Chain verification (Ola 6 Bloque C) ────────────────────────────────────

/**
 * One link of the snapshot hash chain. The persistence layer is expected to
 * expose these three fields from `pricing_snapshots` directly.
 */
export interface SnapshotChainLink {
  id: string;
  outputHash: string;
  prevOutputHash: string | null;
}

export interface ChainBreak {
  snapshotId: string;
  expectedPrev: string;
  actualPrev: string | null;
}

export interface ChainVerificationResult {
  valid: boolean;
  checked: number;
  brokenAt?: ChainBreak;
}

/**
 * Walks an ordered sequence of snapshot chain links (oldest → newest) and
 * verifies that each non-first link's `prevOutputHash` matches the previous
 * link's `outputHash`.
 *
 * The first link is always accepted: when the caller passes a partial range
 * (e.g. last 30 days) its `prevOutputHash` legitimately references a hash
 * outside the range — or is NULL for the tenant genesis row. Detecting
 * whether index 0 should have been the genesis is a higher-level concern
 * that requires knowing the full tenant history, which this pure helper
 * deliberately does not assume.
 *
 * A NULL `prevOutputHash` mid-sequence IS flagged as a break: it would mean
 * a second "genesis" appeared after the first, which is how a fork from a
 * DB-level mutation manifests.
 *
 * Returns at the first break encountered — the caller can re-invoke on the
 * tail of the sequence to find subsequent breaks if needed.
 */
export function verifySnapshotChain(
  links: readonly SnapshotChainLink[],
): ChainVerificationResult {
  if (links.length <= 1) {
    return { valid: true, checked: links.length };
  }
  for (let i = 1; i < links.length; i++) {
    const prev = links[i - 1];
    const cur = links[i];
    if (cur.prevOutputHash !== prev.outputHash) {
      return {
        valid: false,
        checked: i,
        brokenAt: {
          snapshotId: cur.id,
          expectedPrev: prev.outputHash,
          actualPrev: cur.prevOutputHash,
        },
      };
    }
  }
  return { valid: true, checked: links.length };
}
