import crypto from 'crypto';
import { canonicalJson } from '../canonicalJson';
import type { DossierSignatureVerification } from '../../types/governance';

/**
 * Committee dossier signing — tamper-evident audit trail.
 *
 * Two-step signature:
 *   1. payload_hash = sha256(canonicalJson(payload))
 *   2. signature   = HMAC-SHA256(payload_hash, secret)
 *
 * The dossier carries (payload, payload_hash, signature, signer_email).
 * Verification recomputes (1) and (2) and compares constant-time. If either
 * fails, the dossier has been tampered with — render a clear warning and
 * keep the row but mark the audit log accordingly.
 *
 * The shared HMAC secret lives in DOSSIER_SIGNING_SECRET. In production this
 * should be in a managed secret store, rotated per-tenant.
 */

const DEV_SECRET_FALLBACK = 'dev-dossier-secret-change-in-production';

function getSecret(): string {
  const fromEnv = process.env.DOSSIER_SIGNING_SECRET;
  if (process.env.NODE_ENV === 'production' && !fromEnv) {
    throw new Error('DOSSIER_SIGNING_SECRET is required in production.');
  }
  return fromEnv ?? DEV_SECRET_FALLBACK;
}

export interface SignDossierResult {
  payloadHash: string;
  signatureHex: string;
}

export function signDossier(payload: unknown, secret: string = getSecret()): SignDossierResult {
  const canonical = canonicalJson(payload);
  const payloadHash = crypto.createHash('sha256').update(canonical).digest('hex');
  const signatureHex = crypto.createHmac('sha256', secret).update(payloadHash).digest('hex');
  return { payloadHash, signatureHex };
}

export function verifyDossierSignature(
  payload: unknown,
  storedHash: string,
  storedSignatureHex: string,
  secret: string = getSecret(),
): DossierSignatureVerification {
  const recomputed = signDossier(payload, secret);
  const payloadHashMatches = constantTimeEqual(recomputed.payloadHash, storedHash);
  const signatureMatches = payloadHashMatches
    ? constantTimeEqual(recomputed.signatureHex, storedSignatureHex)
    : false;
  return {
    payloadHashMatches,
    signatureMatches,
    verifiedAt: new Date().toISOString(),
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
