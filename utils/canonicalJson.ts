/**
 * Canonical JSON serialisation for pricing snapshot hashing.
 *
 * Requirements:
 *   - Deterministic: same input → same string, regardless of insertion order.
 *   - Stable: property order is sorted alphabetically at every level.
 *   - Lossless for the fields we hash (numbers, strings, booleans, null, arrays, objects).
 *   - Runtime-agnostic: no Node-only APIs. Works in Deno (Edge Function) and Node.
 *
 * What we deliberately exclude:
 *   - `undefined` properties (dropped; JSON can't represent them anyway).
 *   - Functions and symbols (throw).
 *   - Non-finite numbers: NaN, +Inf, -Inf (throw).
 *
 * The output is valid JSON with no whitespace outside strings.
 */

export function canonicalJson(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null) return 'null';

  const type = typeof value;

  if (type === 'string') return JSON.stringify(value);
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) {
      throw new TypeError(`canonicalJson: non-finite number ${String(n)}`);
    }
    return JSON.stringify(n);
  }
  if (type === 'bigint') {
    return (value as bigint).toString();
  }
  if (type === 'function' || type === 'symbol') {
    throw new TypeError(`canonicalJson: unsupported type ${type}`);
  }

  if (Array.isArray(value)) {
    const parts = value.map((item) =>
      item === undefined ? 'null' : stringify(item),
    );
    return `[${parts.join(',')}]`;
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    const parts = keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`);
    return `{${parts.join(',')}}`;
  }

  throw new TypeError(`canonicalJson: unreachable type ${type}`);
}
