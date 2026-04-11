import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the `withTransaction` helper in server/db.ts. The helper has to:
 *   1. Wrap its callback in BEGIN/COMMIT on one pool client.
 *   2. Roll back and release the client if the callback throws.
 *   3. Return the callback's resolved value on success.
 *   4. Release the client even when ROLLBACK itself fails.
 *
 * Before this helper existed, server routes were running SELECT FOR UPDATE
 * and then INSERT on two separate pool clients — the FOR UPDATE lock was
 * released immediately and concurrent writers could race to assign the same
 * version number. These tests lock that behaviour in.
 */

type Stmt = { sql: string; params?: unknown[] };

interface FakeClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  release: () => void;
  _log: Stmt[];
  _released: boolean;
  _throwOnRollback?: boolean;
}

function makeClient(overrides?: {
  onQuery?: (sql: string, params?: unknown[]) => unknown[] | Error;
  throwOnRollback?: boolean;
}): FakeClient {
  const log: Stmt[] = [];
  const client: FakeClient = {
    _log: log,
    _released: false,
    _throwOnRollback: overrides?.throwOnRollback,
    async query(sql: string, params?: unknown[]) {
      log.push({ sql, params });
      if (sql === 'ROLLBACK' && overrides?.throwOnRollback) {
        throw new Error('ROLLBACK failed');
      }
      const result = overrides?.onQuery?.(sql, params);
      if (result instanceof Error) throw result;
      return { rows: result ?? [] };
    },
    release() {
      this._released = true;
    },
  };
  return client;
}

let client: FakeClient;

vi.mock('pg', () => {
  class Pool {
    on() { /* noop */ }
    async connect() { return client; }
  }
  return { Pool, default: { Pool } };
});

beforeEach(() => {
  process.env.DATABASE_URL = 'postgres://localhost/fake';
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadDb() {
  return await import('../../server/db');
}

describe('withTransaction', () => {
  it('wraps the callback in BEGIN/COMMIT and releases the client', async () => {
    client = makeClient({ onQuery: (sql) => (sql.startsWith('SELECT') ? [{ n: 1 }] : []) });
    const { withTransaction } = await loadDb();

    const result = await withTransaction(async (tx) => {
      const rows = await tx.query<{ n: number }>('SELECT $1 as n', [1]);
      return rows[0]?.n;
    });

    expect(result).toBe(1);
    const sqls = client._log.map((s) => s.sql);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[sqls.length - 1]).toBe('COMMIT');
    expect(client._released).toBe(true);
  });

  it('rolls back and rethrows when the callback throws', async () => {
    client = makeClient();
    const { withTransaction } = await loadDb();

    await expect(
      withTransaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const sqls = client._log.map((s) => s.sql);
    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('ROLLBACK');
    expect(sqls).not.toContain('COMMIT');
    expect(client._released).toBe(true);
  });

  it('still releases the client if ROLLBACK itself fails', async () => {
    client = makeClient({ throwOnRollback: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { withTransaction } = await loadDb();

    await expect(
      withTransaction(async () => {
        throw new Error('original error');
      }),
    ).rejects.toThrow('original error');

    expect(client._released).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('pins all tx calls to the same client for lock semantics', async () => {
    client = makeClient({ onQuery: () => [{ next_version: 3 }] });
    const { withTransaction } = await loadDb();

    await withTransaction(async (tx) => {
      await tx.query('SELECT MAX(version) FOR UPDATE');
      await tx.execute('INSERT INTO t (version) VALUES ($1)', [4]);
    });

    // The fake pool only ever hands out one client, so both statements must
    // have landed on the same recorded log — the lock is valid.
    const sqls = client._log.map((s) => s.sql);
    expect(sqls).toEqual([
      'BEGIN',
      'SELECT MAX(version) FOR UPDATE',
      'INSERT INTO t (version) VALUES ($1)',
      'COMMIT',
    ]);
  });
});
