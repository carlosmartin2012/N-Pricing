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
