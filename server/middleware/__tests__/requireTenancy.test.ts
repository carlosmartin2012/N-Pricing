import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import { tenancyScope, entityScopedClause, requireTenancy } from '../requireTenancy';
import type { TenancyContext } from '../../../types/phase0';

/**
 * Pure unit tests for the tenancy helper primitives used across every
 * entity-scoped router. These protect against the regression
 * "router forgot to filter by entity_id" that CLAUDE.md flagged as blocker
 * for TENANCY_STRICT=on.
 *
 * Integration tests (real DB + full middleware chain) live in
 * utils/__tests__/integration/tenancy.integration.test.ts — opt-in.
 */

function reqWithTenancy(entityId = '00000000-0000-0000-0000-000000000001'): Request {
  const tenancy: TenancyContext = {
    entityId,
    userEmail: 'user@example.com',
    role: 'Trader',
    requestId: 'req-test',
  };
  return { tenancy } as unknown as Request;
}
const legacyReq = (): Request => ({} as Request);

describe('tenancyScope', () => {
  it('returns null entityId in legacy mode', () => {
    const s = tenancyScope(legacyReq());
    expect(s.entityId).toBeNull();
    expect(s.isStrict).toBe(false);
  });

  it('returns populated scope when req.tenancy is present', () => {
    const s = tenancyScope(reqWithTenancy('abc'));
    expect(s.entityId).toBe('abc');
    expect(s.isStrict).toBe(true);
    expect(s.userEmail).toBe('user@example.com');
  });
});

describe('entityScopedClause', () => {
  it('returns empty fragment in legacy mode', () => {
    const c = entityScopedClause(legacyReq(), 1);
    expect(c.where).toBe('');
    expect(c.and).toBe('');
    expect(c.params).toEqual([]);
  });

  it('returns WHERE entity_id = $1 in strict mode', () => {
    const c = entityScopedClause(reqWithTenancy('ent-1'), 1);
    expect(c.where).toBe('WHERE entity_id = $1');
    expect(c.and).toBe('AND entity_id = $1');
    expect(c.params).toEqual(['ent-1']);
  });

  it('respects startIndex for SQL param position', () => {
    const c = entityScopedClause(reqWithTenancy('ent-1'), 5);
    expect(c.where).toBe('WHERE entity_id = $5');
    expect(c.and).toBe('AND entity_id = $5');
  });

  it('allows overriding the column name (for joined aliases)', () => {
    const c = entityScopedClause(reqWithTenancy('ent-1'), 1, 'r.entity_id');
    expect(c.where).toBe('WHERE r.entity_id = $1');
  });
});

describe('requireTenancy guard', () => {
  beforeEach(() => {
    process.env.TENANCY_ENFORCE = 'off';
  });
  afterEach(() => {
    delete process.env.TENANCY_ENFORCE;
  });

  it('is a no-op when enforcement is off', () => {
    const guard = requireTenancy();
    const next = vi.fn();
    const res = { status: vi.fn(() => ({ json: vi.fn() })) } as unknown as import('express').Response;
    guard(legacyReq(), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('500s when strict mode is on and req.tenancy is missing', () => {
    process.env.TENANCY_ENFORCE = 'on';
    const guard = requireTenancy();
    const next = vi.fn();
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as unknown as import('express').Response;
    guard(legacyReq(), res, next);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'tenancy_guard_missing' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when strict mode is on and req.tenancy is populated', () => {
    process.env.TENANCY_ENFORCE = 'on';
    const guard = requireTenancy();
    const next = vi.fn();
    const res = { status: vi.fn(() => ({ json: vi.fn() })) } as unknown as import('express').Response;
    guard(reqWithTenancy(), res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('re-reads env per call so flip is live', () => {
    const guard = requireTenancy();
    const next = vi.fn();
    const res = { status: vi.fn(() => ({ json: vi.fn() })) } as unknown as import('express').Response;

    process.env.TENANCY_ENFORCE = 'off';
    guard(legacyReq(), res, next);

    process.env.TENANCY_ENFORCE = 'on';
    guard(legacyReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
