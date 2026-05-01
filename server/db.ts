import { Pool, PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Tunable via env for prod sizing. Default 10 mirrors the historical setting;
// raise DB_POOL_SIZE (typical prod: 20–40) when concurrent users grow.
const POOL_MAX = Math.max(1, parseInt(process.env.DB_POOL_SIZE ?? '10', 10) || 10);
// Hard cap on a single statement so a runaway query (cartesian join, missing
// index) cannot starve the pool for the rest of the process. 30 s is generous
// for batch repricing; tune via env if specific routes need longer.
const STATEMENT_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? '30000', 10) || 30000,
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : {
    rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DATABASE_CA_CERT || undefined,
  },
  max: POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Applied to every fresh connection. Because pg.Pool reuses connections,
  // setting it once on `connect` is the right hook (vs. SET LOCAL per query).
  statement_timeout: STATEMENT_TIMEOUT_MS,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error', err);
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params?: unknown[]): Promise<void> {
  await query(sql, params);
}

/**
 * Transaction-scoped client. Exposes the same shape as the top-level helpers
 * but pins every call to the single PoolClient passed to `withTransaction`,
 * so `SELECT FOR UPDATE` locks and multi-statement writes stay atomic.
 */
export interface Tx {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

function wrapClient(client: PoolClient): Tx {
  return {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
      const result = await client.query(sql, params);
      return result.rows as T[];
    },
    async queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
      const result = await client.query(sql, params);
      return (result.rows[0] as T | undefined) ?? null;
    },
    async execute(sql: string, params?: unknown[]): Promise<void> {
      await client.query(sql, params);
    },
  };
}

/**
 * Runs `fn` inside a BEGIN/COMMIT transaction. On any thrown error the
 * transaction is rolled back before the error is rethrown. The client is
 * always released back to the pool. Use this whenever you need either
 * SELECT FOR UPDATE locking or multi-statement atomicity.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(wrapClient(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] ROLLBACK failed after transaction error', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Tenancy-aware transaction. Sets `app.current_entity_id`,
 * `app.current_user_email`, and `app.current_user_role` as LOCAL session
 * settings so RLS policies (`get_current_entity_id()`,
 * `get_current_user_role()`) resolve against the authenticated caller for
 * the duration of the transaction. `SET LOCAL` auto-resets on COMMIT/ROLLBACK,
 * so no leaks between pooled connections.
 *
 * When TENANCY_STRICT=on, also sets `app.tenancy_strict = 'on'` which turns
 * `get_current_entity_id()` into a raise-on-missing function (see migration
 * 20260602000001_tenancy_helpers). Until then, missing tenancy falls back to
 * the legacy Default Entity to avoid breaking existing call paths.
 *
 * Prefer this over `withTransaction` when your handler touches entity-scoped
 * data. Legacy handlers that bypass RLS will continue to work unchanged.
 */
export interface TenancyBinding {
  entityId: string;
  userEmail: string;
  role: string;
}

export async function withTenancyTransaction<T>(
  tenancy: TenancyBinding,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return withTransaction(async (tx) => {
    await tx.execute('SELECT set_config($1, $2, true)', ['app.current_entity_id', tenancy.entityId]);
    await tx.execute('SELECT set_config($1, $2, true)', ['app.current_user_email', tenancy.userEmail]);
    await tx.execute('SELECT set_config($1, $2, true)', ['app.current_user_role', tenancy.role]);
    if (process.env.TENANCY_STRICT === 'on') {
      await tx.execute('SELECT set_config($1, $2, true)', ['app.tenancy_strict', 'on']);
    }
    return fn(tx);
  });
}
