import { describe, it, expect } from 'vitest';
import { canonicalJson } from '../canonicalJson';

describe('canonicalJson', () => {
  it('serialises primitives like JSON.stringify', () => {
    expect(canonicalJson('hello')).toBe('"hello"');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson(3.14)).toBe('3.14');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
    expect(canonicalJson(null)).toBe('null');
  });

  it('sorts object keys alphabetically at every level', () => {
    const input = { b: 1, a: { d: 4, c: 3 } };
    expect(canonicalJson(input)).toBe('{"a":{"c":3,"d":4},"b":1}');
  });

  it('produces the same output regardless of insertion order', () => {
    const a = { foo: 1, bar: 2, baz: { nested: true, count: 5 } };
    const b = { baz: { count: 5, nested: true }, bar: 2, foo: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('preserves array order (arrays are sequences, not sets)', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('drops undefined properties from objects', () => {
    const input = { a: 1, b: undefined, c: 3 };
    expect(canonicalJson(input)).toBe('{"a":1,"c":3}');
  });

  it('converts undefined entries inside arrays to null (JSON.stringify parity)', () => {
    expect(canonicalJson([1, undefined, 3])).toBe('[1,null,3]');
  });

  it('throws on non-finite numbers', () => {
    expect(() => canonicalJson(NaN)).toThrow(/non-finite/);
    expect(() => canonicalJson(Infinity)).toThrow(/non-finite/);
    expect(() => canonicalJson(-Infinity)).toThrow(/non-finite/);
  });

  it('throws on functions and symbols', () => {
    expect(() => canonicalJson(() => 1)).toThrow(/unsupported type/);
    expect(() => canonicalJson(Symbol('x'))).toThrow(/unsupported type/);
  });

  it('serialises bigints as decimal strings without the suffix', () => {
    expect(canonicalJson(10n)).toBe('10');
  });

  it('is deterministic for deeply nested objects', () => {
    const deep = {
      z: [{ c: 1, a: 2 }, { b: 3 }],
      a: { nested: { inner: { x: 1, a: 2 } } },
    };
    const reordered = {
      a: { nested: { inner: { a: 2, x: 1 } } },
      z: [{ a: 2, c: 1 }, { b: 3 }],
    };
    expect(canonicalJson(deep)).toBe(canonicalJson(reordered));
  });
});
