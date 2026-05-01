// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeError } from '../../server/middleware/errorHandler';

const ENV_KEYS = ['NODE_ENV', 'VERBOSE_ERRORS'] as const;

describe('safeError', () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    for (const k of ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it('returns the raw error when NODE_ENV=development', () => {
    process.env.NODE_ENV = 'development';
    expect(safeError(new Error('relation "deals" does not exist'))).toMatch(/relation "deals"/);
  });

  it('returns generic message when NODE_ENV is unset and VERBOSE_ERRORS is unset', () => {
    expect(safeError(new Error('SELECT * FROM users'))).toBe('Internal server error');
  });

  it('honours VERBOSE_ERRORS=true outside of production', () => {
    process.env.VERBOSE_ERRORS = 'true';
    expect(safeError(new Error('detail'))).toMatch(/detail/);
  });

  it('IGNORES VERBOSE_ERRORS=true when NODE_ENV=production (no leak)', () => {
    process.env.NODE_ENV = 'production';
    process.env.VERBOSE_ERRORS = 'true';
    // The previous behaviour returned the raw PG/SQL error in this combo.
    // Production now refuses to leak regardless of the verbose flag.
    expect(safeError(new Error('relation "deals" does not exist'))).toBe(
      'Internal server error',
    );
  });
});
