import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  sha256CanonicalJson,
  hashSnapshotInput,
  hashSnapshotOutput,
} from '../snapshotHash';

describe('snapshotHash', () => {
  it('sha256Hex returns a 64-char lowercase hex digest', async () => {
    const h = await sha256Hex('hello');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    // Known vector for sha256("hello"):
    expect(h).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('sha256CanonicalJson produces the same hash regardless of key order', async () => {
    const a = await sha256CanonicalJson({ a: 1, b: [2, 3], c: { d: 4 } });
    const b = await sha256CanonicalJson({ c: { d: 4 }, b: [2, 3], a: 1 });
    expect(a).toBe(b);
  });

  it('differentiates objects with different values', async () => {
    const a = await sha256CanonicalJson({ x: 1 });
    const b = await sha256CanonicalJson({ x: 2 });
    expect(a).not.toBe(b);
  });

  it('hashSnapshotInput and hashSnapshotOutput produce hex digests', async () => {
    const inputHash = await hashSnapshotInput({ deal: { amount: 100 } }, { curves: { yield: [] } });
    const outputHash = await hashSnapshotOutput({ finalClientRate: 0.04 });
    expect(inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(outputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(inputHash).not.toBe(outputHash);
  });

  it('hashSnapshotInput combines both input and context (drift in either changes the hash)', async () => {
    const base = await hashSnapshotInput({ deal: { amount: 100 } }, { curves: { yield: [] } });
    const driftInput = await hashSnapshotInput({ deal: { amount: 101 } }, { curves: { yield: [] } });
    const driftContext = await hashSnapshotInput(
      { deal: { amount: 100 } },
      { curves: { yield: [{ t: 1, r: 0.02 }] } },
    );
    expect(driftInput).not.toBe(base);
    expect(driftContext).not.toBe(base);
    expect(driftInput).not.toBe(driftContext);
  });
});
