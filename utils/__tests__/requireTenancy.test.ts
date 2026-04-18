import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { TenancyContext } from '../../types/phase0';
import {
  tenancyScope,
  entityScopedClause,
  requireTenancy,
} from '../../server/middleware/requireTenancy';

function mockReq(tenancy?: TenancyContext): Request {
  return { tenancy, requestId: 'req-test' } as unknown as Request;
}

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const TENANCY: TenancyContext = {
  entityId: '00000000-0000-0000-0000-000000000010',
  userEmail: 'user@example.com',
  role: 'Trader',
  requestId: 'req-1',
};

describe('tenancyScope', () => {
  it('returns null entityId when middleware did not populate req.tenancy (legacy mode)', () => {
    const scope = tenancyScope(mockReq());
    expect(scope.entityId).toBeNull();
    expect(scope.isStrict).toBe(false);
  });

  it('reflects req.tenancy when populated (strict mode)', () => {
    const scope = tenancyScope(mockReq(TENANCY));
    expect(scope.entityId).toBe(TENANCY.entityId);
    expect(scope.userEmail).toBe(TENANCY.userEmail);
    expect(scope.role).toBe(TENANCY.role);
    expect(scope.isStrict).toBe(true);
  });
});

describe('entityScopedClause', () => {
  it('is a no-op in legacy mode so existing queries keep their semantics', () => {
    const c = entityScopedClause(mockReq(), 1);
    expect(c.where).toBe('');
    expect(c.and).toBe('');
    expect(c.params).toEqual([]);
  });

  it('emits positional WHERE and AND variants in strict mode', () => {
    const c = entityScopedClause(mockReq(TENANCY), 1);
    expect(c.where).toBe('WHERE entity_id = $1');
    expect(c.and).toBe('AND entity_id = $1');
    expect(c.params).toEqual([TENANCY.entityId]);
  });

  it('respects the startIndex so callers can chain it with existing params', () => {
    const c = entityScopedClause(mockReq(TENANCY), 3);
    expect(c.where).toBe('WHERE entity_id = $3');
    expect(c.and).toBe('AND entity_id = $3');
  });

  it('allows a different column name (e.g. for joined aliases)', () => {
    const c = entityScopedClause(mockReq(TENANCY), 1, 'd.entity_id');
    expect(c.where).toBe('WHERE d.entity_id = $1');
  });
});

describe('requireTenancy middleware', () => {
  it('returns 500 when req.tenancy is missing — treats it as a coding regression, not a client error', () => {
    const mw = requireTenancy();
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'tenancy_guard_missing' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when tenancy is populated', () => {
    const mw = requireTenancy();
    const req = mockReq(TENANCY);
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
