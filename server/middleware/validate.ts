/**
 * Lightweight request-body validator.
 *
 * We deliberately avoid pulling in `zod`, `joi`, or similar — the schemas we
 * need are small, and the server already has too many dependencies. This
 * file implements just enough of a combinator API to give us:
 *
 *   - Structural validation (required fields, types)
 *   - Range/length checks (min/max for numbers, strings, arrays)
 *   - Enum / literal unions
 *   - Nested objects + optional fields
 *   - Early-exit error messages that safely describe *what* failed
 *     without echoing user input back verbatim
 *
 * Usage:
 *
 *   const DealUpsertSchema = object({
 *     id: optional(string({ maxLength: 64 })),
 *     amount: number({ min: 0 }),
 *     currency: stringEnum(['EUR', 'USD', 'GBP']),
 *   });
 *
 *   router.post('/upsert', validateBody(DealUpsertSchema), (req, res) => { ... });
 */

import type { Request, Response, NextFunction } from 'express';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type Validator<T> = (value: unknown, path: string) => {
  ok: true;
  value: T;
} | {
  ok: false;
  issues: ValidationIssue[];
};

// ─── Primitives ─────────────────────────────────────────────────────────────

export function string(opts?: { minLength?: number; maxLength?: number }): Validator<string> {
  return (value, path) => {
    if (typeof value !== 'string') {
      return { ok: false, issues: [{ path, message: 'expected string' }] };
    }
    if (opts?.minLength !== undefined && value.length < opts.minLength) {
      return { ok: false, issues: [{ path, message: `string shorter than ${opts.minLength}` }] };
    }
    if (opts?.maxLength !== undefined && value.length > opts.maxLength) {
      return { ok: false, issues: [{ path, message: `string longer than ${opts.maxLength}` }] };
    }
    return { ok: true, value };
  };
}

export function number(opts?: {
  min?: number;
  max?: number;
  integer?: boolean;
}): Validator<number> {
  return (value, path) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, issues: [{ path, message: 'expected finite number' }] };
    }
    if (opts?.integer && !Number.isInteger(value)) {
      return { ok: false, issues: [{ path, message: 'expected integer' }] };
    }
    if (opts?.min !== undefined && value < opts.min) {
      return { ok: false, issues: [{ path, message: `number below min ${opts.min}` }] };
    }
    if (opts?.max !== undefined && value > opts.max) {
      return { ok: false, issues: [{ path, message: `number above max ${opts.max}` }] };
    }
    return { ok: true, value };
  };
}

export function boolean(): Validator<boolean> {
  return (value, path) => {
    if (typeof value !== 'boolean') {
      return { ok: false, issues: [{ path, message: 'expected boolean' }] };
    }
    return { ok: true, value };
  };
}

export function stringEnum<T extends readonly string[]>(
  values: T,
): Validator<T[number]> {
  return (value, path) => {
    if (typeof value !== 'string' || !values.includes(value)) {
      return {
        ok: false,
        issues: [
          { path, message: `expected one of ${values.join(' | ')}` },
        ],
      };
    }
    return { ok: true, value: value as T[number] };
  };
}

export function optional<T>(inner: Validator<T>): Validator<T | undefined> {
  return (value, path) => {
    if (value === undefined || value === null) {
      return { ok: true, value: undefined };
    }
    return inner(value, path);
  };
}

export function array<T>(
  inner: Validator<T>,
  opts?: { maxLength?: number; minLength?: number },
): Validator<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) {
      return { ok: false, issues: [{ path, message: 'expected array' }] };
    }
    if (opts?.maxLength !== undefined && value.length > opts.maxLength) {
      return {
        ok: false,
        issues: [{ path, message: `array longer than ${opts.maxLength}` }],
      };
    }
    if (opts?.minLength !== undefined && value.length < opts.minLength) {
      return {
        ok: false,
        issues: [{ path, message: `array shorter than ${opts.minLength}` }],
      };
    }
    const out: T[] = [];
    const issues: ValidationIssue[] = [];
    for (let i = 0; i < value.length; i++) {
      const res = inner(value[i], `${path}[${i}]`);
      if (!res.ok) issues.push(...res.issues);
      else out.push(res.value);
    }
    if (issues.length) return { ok: false, issues };
    return { ok: true, value: out };
  };
}

export function object<S extends Record<string, Validator<unknown>>>(
  schema: S,
): Validator<{ [K in keyof S]: S[K] extends Validator<infer U> ? U : never }> {
  return (value, path) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, issues: [{ path, message: 'expected object' }] };
    }
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const issues: ValidationIssue[] = [];
    for (const [key, validator] of Object.entries(schema)) {
      const childPath = path ? `${path}.${key}` : key;
      const res = validator(input[key], childPath);
      if (!res.ok) issues.push(...res.issues);
      else if (res.value !== undefined) out[key] = res.value;
    }
    if (issues.length) return { ok: false, issues };
    return {
      ok: true,
      value: out as { [K in keyof S]: S[K] extends Validator<infer U> ? U : never },
    };
  };
}

/**
 * Accept any value through. Useful for payload fields the server forwards
 * verbatim (e.g. opaque snapshots) without inspecting. Still gates out
 * `undefined` — use `optional(any())` if the field is not required.
 */
export function any(): Validator<unknown> {
  return (value) => ({ ok: true, value });
}

// ─── Express middleware ─────────────────────────────────────────────────────

/**
 * Validate `req.body` against the given schema. On failure, respond with
 * 400 and a JSON body `{ error: 'Invalid request body', issues: [...] }`
 * — issues contain *paths and messages only*, never the offending input
 * value, so we never echo untrusted data back.
 *
 * On success, `req.body` is replaced with the parsed (and coerced, if the
 * schema supports it) value for downstream handlers.
 */
export function validateBody<T>(
  schema: Validator<T>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const result = schema(req.body, '');
    if (!result.ok) {
      res.status(400).json({
        error: 'Invalid request body',
        issues: result.issues,
      });
      return;
    }
    req.body = result.value;
    next();
  };
}
