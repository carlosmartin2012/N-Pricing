import { describe, it, expect } from 'vitest';
import { computeDiff } from '../../server/workers/snapshotReplay';

describe('computeDiff', () => {
  it('returns empty diff when outputs are identical', () => {
    const out = {
      baseRate: 0.03,
      finalClientRate: 0.05,
      raroc: 0.15,
    };
    expect(computeDiff(out, out)).toEqual([]);
  });

  it('reports numeric drift in deltaAbs and deltaBps for known FTP fields', () => {
    const original = { finalClientRate: 0.0402, raroc: 0.152 };
    const current  = { finalClientRate: 0.0404, raroc: 0.152 };
    const diff = computeDiff(original, current);
    expect(diff).toHaveLength(1);
    const entry = diff[0];
    expect(entry.field).toBe('finalClientRate');
    expect(entry.original).toBe(0.0402);
    expect(entry.current).toBe(0.0404);
    expect(entry.deltaAbs).toBeCloseTo(0.0002, 6);
    expect(entry.deltaBps).toBeCloseTo(2, 4);
  });

  it('handles original missing → null delta', () => {
    const diff = computeDiff({ raroc: undefined as unknown as number }, { raroc: 0.1 });
    const entry = diff.find((d) => d.field === 'raroc');
    expect(entry).toBeDefined();
    expect(entry?.deltaAbs).toBeUndefined();
    expect(entry?.original).toBeUndefined();
    expect(entry?.current).toBe(0.1);
  });

  it('flags non-numeric fields when JSON differs', () => {
    const original = { matchReason: 'rule#42 matched', raroc: 0.1 };
    const current  = { matchReason: 'rule#42 (v2) matched', raroc: 0.1 };
    const diff = computeDiff(original, current);
    expect(diff.find((d) => d.field === 'matchReason')).toBeDefined();
  });

  it('does not flag NUMERIC_FIELDS when only nested unrelated fields change', () => {
    // accountingEntry is a non-numeric sub-object — change inside it should
    // surface in the catch-all branch, not the numeric branch.
    const original = {
      raroc: 0.1,
      accountingEntry: { source: 'A', dest: 'B', amountDebit: 100, amountCredit: 100 },
    };
    const current = {
      raroc: 0.1,
      accountingEntry: { source: 'A', dest: 'C', amountDebit: 100, amountCredit: 100 },
    };
    const diff = computeDiff(original, current);
    expect(diff.find((d) => d.field === 'raroc')).toBeUndefined();
    expect(diff.find((d) => d.field === 'accountingEntry')).toBeDefined();
  });

  it('detects new fields added by the current engine', () => {
    const original = { finalClientRate: 0.04 };
    const current  = { finalClientRate: 0.04, csrbbCost: 0.0007 };
    const diff = computeDiff(original, current);
    expect(diff.find((d) => d.field === 'csrbbCost')).toBeDefined();
  });
});
