// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock pg.Pool / withTransaction. We capture which transactional path each
// query takes so the test asserts UPDATE+INSERT for an `escalate` action are
// inside withTransaction (the regression we're guarding against).
const dbMock = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {
    pool: { query: vi.fn() },
    query: vi.fn(),
    queryOne: vi.fn(),
    execute: vi.fn(),
  };
  obj.txCalls = [] as Array<{ sql: string; params?: unknown[] }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj.withTransaction = vi.fn(async (fn: (tx: any) => unknown) => {
    const tx = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }) as any),
      queryOne: vi.fn(async () => null),
      execute: vi.fn(async (sql: string, params?: unknown[]) => {
        obj.txCalls.push({ sql, params });
      }),
    };
    return fn(tx);
  });
  return obj;
});
vi.mock('../../server/db', () => dbMock);

// Force the planner to emit an `escalate` action for the row we feed in.
const planMock = vi.hoisted(() => ({
  sweepEscalations: vi.fn(),
}));
vi.mock('../../utils/governance/escalationEvaluator', () => planMock);

import { runSweep } from '../../server/workers/escalationSweeper';

const ENTITY = '00000000-0000-0000-0000-00000000000a';
const escalationRow = {
  id: 'esc-1',
  entity_id: ENTITY,
  deal_id: 'deal-1',
  exception_id: null,
  level: 'office',
  due_at: '2026-04-01T00:00:00Z',
  status: 'open',
  notified_at: null,
  resolved_at: null,
  created_at: '2026-04-01T00:00:00Z',
  opened_by: 'user@bank.es',
  current_notes: null,
  escalated_from_id: null,
};

beforeEach(() => {
  dbMock.txCalls.length = 0;
  dbMock.pool.query.mockReset();
  dbMock.withTransaction.mockClear();
  planMock.sweepEscalations.mockReset();
});

describe('escalationSweeper.runSweep · escalate action atomicity', () => {
  it('wraps the UPDATE + INSERT pair for an escalate action in a single transaction', async () => {
    // Two reads happen before the planner — open escalations + active configs.
    // We don't care about their content because the planner mock decides the
    // action; just return empty rowsets so the worker proceeds.
    dbMock.pool.query.mockResolvedValueOnce({ rows: [escalationRow] });
    dbMock.pool.query.mockResolvedValueOnce({ rows: [] });

    planMock.sweepEscalations.mockReturnValue([
      {
        escalation: {
          id: escalationRow.id,
          entityId: escalationRow.entity_id,
          dealId: escalationRow.deal_id,
          exceptionId: escalationRow.exception_id,
          level: escalationRow.level,
          dueAt: escalationRow.due_at,
          status: escalationRow.status,
          notifiedAt: escalationRow.notified_at,
          resolvedAt: escalationRow.resolved_at,
          createdAt: escalationRow.created_at,
          openedBy: escalationRow.opened_by,
          currentNotes: escalationRow.current_notes,
          escalatedFromId: escalationRow.escalated_from_id,
        },
        action: { kind: 'escalate', toLevel: 'zone', newDueAt: '2026-04-08T00:00:00Z' },
      },
    ]);

    const report = await runSweep(new Date('2026-04-02T00:00:00Z'));
    expect(report.escalated).toBe(1);
    expect(report.errors).toEqual([]);

    // The whole UPDATE + INSERT pair must run inside withTransaction.
    expect(dbMock.withTransaction).toHaveBeenCalledTimes(1);
    expect(dbMock.txCalls.length).toBe(2);
    expect(dbMock.txCalls[0].sql).toMatch(/UPDATE approval_escalations SET status = 'escalated'/);
    expect(dbMock.txCalls[1].sql).toMatch(/INSERT INTO approval_escalations/);
  });

  it('rolls back when the INSERT fails — no orphaned `escalated` state', async () => {
    dbMock.pool.query.mockResolvedValueOnce({ rows: [escalationRow] });
    dbMock.pool.query.mockResolvedValueOnce({ rows: [] });

    planMock.sweepEscalations.mockReturnValue([
      {
        escalation: { id: 'esc-1', entityId: ENTITY, dealId: null, exceptionId: null,
          level: 'office', dueAt: '2026-04-01T00:00:00Z', status: 'open',
          notifiedAt: null, resolvedAt: null, createdAt: '2026-04-01T00:00:00Z',
          openedBy: null, currentNotes: null, escalatedFromId: null },
        action: { kind: 'escalate', toLevel: 'zone', newDueAt: '2026-04-08T00:00:00Z' },
      },
    ]);

    // Make the second tx execute (the INSERT) throw — withTransaction should
    // propagate, the per-action try/catch in runSweep should record an error,
    // and the report must not count it as `escalated`.
    dbMock.withTransaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        execute: vi.fn()
          .mockImplementationOnce(async () => { /* UPDATE succeeds */ })
          .mockImplementationOnce(async () => { throw new Error('FK violation'); }),
      };
      return fn(tx);
    });

    const report = await runSweep(new Date('2026-04-02T00:00:00Z'));
    expect(report.escalated).toBe(0);
    expect(report.errors.length).toBe(1);
    expect(report.errors[0]).toMatch(/FK violation/);
  });
});
