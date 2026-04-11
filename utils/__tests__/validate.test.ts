import { describe, it, expect } from 'vitest';
import {
  any,
  array,
  boolean,
  number,
  object,
  optional,
  string,
  stringEnum,
} from '../../server/middleware/validate';

describe('validate / primitives', () => {
  it('string accepts a valid string', () => {
    const r = string()('hello', 'field');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('hello');
  });

  it('string rejects non-strings', () => {
    const r = string()(42, 'field');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe('field');
  });

  it('string enforces maxLength', () => {
    const r = string({ maxLength: 3 })('hello', 'x');
    expect(r.ok).toBe(false);
  });

  it('string enforces minLength', () => {
    const r = string({ minLength: 10 })('short', 'x');
    expect(r.ok).toBe(false);
  });

  it('number accepts finite numbers', () => {
    expect(number()(3.14, 'x').ok).toBe(true);
    expect(number()(-1, 'x').ok).toBe(true);
    expect(number()(0, 'x').ok).toBe(true);
  });

  it('number rejects NaN and Infinity', () => {
    expect(number()(NaN, 'x').ok).toBe(false);
    expect(number()(Infinity, 'x').ok).toBe(false);
    expect(number()(-Infinity, 'x').ok).toBe(false);
  });

  it('number enforces min and max', () => {
    const v = number({ min: 0, max: 100 });
    expect(v(50, 'x').ok).toBe(true);
    expect(v(-1, 'x').ok).toBe(false);
    expect(v(101, 'x').ok).toBe(false);
  });

  it('number integer option rejects fractions', () => {
    const v = number({ integer: true });
    expect(v(5, 'x').ok).toBe(true);
    expect(v(5.5, 'x').ok).toBe(false);
  });

  it('boolean accepts only booleans', () => {
    expect(boolean()(true, 'x').ok).toBe(true);
    expect(boolean()(false, 'x').ok).toBe(true);
    expect(boolean()('true', 'x').ok).toBe(false);
    expect(boolean()(1, 'x').ok).toBe(false);
  });

  it('stringEnum accepts listed values', () => {
    const v = stringEnum(['EUR', 'USD', 'GBP'] as const);
    expect(v('EUR', 'x').ok).toBe(true);
    const bad = v('XXX', 'x');
    expect(bad.ok).toBe(false);
  });

  it('optional allows undefined/null through', () => {
    const v = optional(string());
    const a = v(undefined, 'x');
    const b = v(null, 'x');
    const c = v('ok', 'x');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
    if (a.ok) expect(a.value).toBeUndefined();
  });

  it('optional still rejects wrong types when a value is provided', () => {
    const v = optional(string());
    expect(v(42, 'x').ok).toBe(false);
  });

  it('array validates each element', () => {
    const v = array(number({ min: 0 }));
    expect(v([1, 2, 3], 'x').ok).toBe(true);
    const bad = v([1, -1, 3], 'x');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues[0].path).toBe('x[1]');
  });

  it('array enforces maxLength', () => {
    const v = array(number(), { maxLength: 2 });
    expect(v([1, 2, 3], 'x').ok).toBe(false);
  });
});

describe('validate / object', () => {
  const DealSchema = object({
    id: optional(string({ maxLength: 32 })),
    amount: number({ min: 0, max: 1_000_000 }),
    currency: stringEnum(['EUR', 'USD', 'GBP'] as const),
    tags: optional(array(string({ maxLength: 16 }), { maxLength: 10 })),
  });

  it('accepts a well-formed payload', () => {
    const r = DealSchema(
      { amount: 1000, currency: 'EUR', tags: ['a', 'b'] },
      '',
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.amount).toBe(1000);
      expect(r.value.currency).toBe('EUR');
      expect(r.value.id).toBeUndefined();
    }
  });

  it('rejects missing required fields', () => {
    const r = DealSchema({ amount: 1000 }, '');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const currencyIssue = r.issues.find((i) => i.path === 'currency');
      expect(currencyIssue).toBeDefined();
    }
  });

  it('rejects wrong types', () => {
    const r = DealSchema({ amount: '1000', currency: 'EUR' }, '');
    expect(r.ok).toBe(false);
  });

  it('rejects out-of-range values', () => {
    const r = DealSchema({ amount: -1, currency: 'EUR' }, '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe('amount');
  });

  it('rejects non-object input', () => {
    expect(DealSchema('not an object', '').ok).toBe(false);
    expect(DealSchema(null, '').ok).toBe(false);
    expect(DealSchema([], '').ok).toBe(false);
  });

  it('reports nested paths on array element errors', () => {
    const r = DealSchema(
      { amount: 100, currency: 'EUR', tags: ['ok', 'way-too-long-tag-value'] },
      '',
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe('tags[1]');
  });

  it('any() allows arbitrary values', () => {
    const Schema = object({ payload: any() });
    expect(Schema({ payload: { nested: [1, 2, 3] } }, '').ok).toBe(true);
    expect(Schema({ payload: 'str' }, '').ok).toBe(true);
    expect(Schema({ payload: null }, '').ok).toBe(true);
  });

  it('strips unknown fields when used via object()', () => {
    const Schema = object({ a: number() });
    const r = Schema({ a: 1, extra: 'ignored' }, '');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.a).toBe(1);
      expect('extra' in r.value).toBe(false);
    }
  });
});
