import { describe, it, expect } from 'vitest';
import { signDossier, verifyDossierSignature } from '../governance/dossierSigning';

const SECRET = 'unit-test-secret';

describe('dossierSigning', () => {
  it('produces stable hash + signature for identical payload', () => {
    const payload = { dealId: 'd-1', amount: 100, items: [1, 2] };
    const a = signDossier(payload, SECRET);
    const b = signDossier(payload, SECRET);
    expect(a.payloadHash).toBe(b.payloadHash);
    expect(a.signatureHex).toBe(b.signatureHex);
    expect(a.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.signatureHex).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash does not depend on key insertion order', () => {
    const a = signDossier({ a: 1, b: 2 }, SECRET);
    const b = signDossier({ b: 2, a: 1 }, SECRET);
    expect(a.payloadHash).toBe(b.payloadHash);
  });

  it('different payloads yield different hashes and signatures', () => {
    const a = signDossier({ amount: 100 }, SECRET);
    const b = signDossier({ amount: 101 }, SECRET);
    expect(a.payloadHash).not.toBe(b.payloadHash);
    expect(a.signatureHex).not.toBe(b.signatureHex);
  });

  it('verify returns matches on intact dossier', () => {
    const payload = { foo: 'bar' };
    const { payloadHash, signatureHex } = signDossier(payload, SECRET);
    const v = verifyDossierSignature(payload, payloadHash, signatureHex, SECRET);
    expect(v.payloadHashMatches).toBe(true);
    expect(v.signatureMatches).toBe(true);
  });

  it('verify detects payload tampering', () => {
    const payload = { foo: 'bar' };
    const { payloadHash, signatureHex } = signDossier(payload, SECRET);
    const v = verifyDossierSignature({ foo: 'baz' }, payloadHash, signatureHex, SECRET);
    expect(v.payloadHashMatches).toBe(false);
    expect(v.signatureMatches).toBe(false);
  });

  it('verify detects signature tampering when payload still matches', () => {
    const payload = { foo: 'bar' };
    const { payloadHash } = signDossier(payload, SECRET);
    // Forge a signature with the wrong secret
    const fake = signDossier(payload, 'other-secret');
    const v = verifyDossierSignature(payload, payloadHash, fake.signatureHex, SECRET);
    expect(v.payloadHashMatches).toBe(true);
    expect(v.signatureMatches).toBe(false);
  });
});
