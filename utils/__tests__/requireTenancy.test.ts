import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('requireTenancy middleware (mode-aware belt-and-suspenders guard)', () => {
  // The guard is no-op when TENANCY_ENFORCE is off so it can be stacked on
  // every entity-scoped router without breaking the legacy rollout step.
  // Once strict mode is on, it catches the regression "router added without
  // tenancyMiddleware in front of it" — req.tenancy missing → 500 with a
  // pointer to the fix, not a silent fall-through to the legacy code path.
  const originalEnv = process.env.TENANCY_ENFORCE;

  beforeEach(() => {
    delete process.env.TENANCY_ENFORCE;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TENANCY_ENFORCE;
    } else {
      process.env.TENANCY_ENFORCE = originalEnv;
    }
  });

  it('is a no-op when TENANCY_ENFORCE is unset (legacy mode)', () => {
    const mw = requireTenancy();
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(mockReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('is a no-op when TENANCY_ENFORCE=off explicitly', () => {
    process.env.TENANCY_ENFORCE = 'off';
    const mw = requireTenancy();
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(mockReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes through when TENANCY_ENFORCE=on AND req.tenancy is populated', () => {
    process.env.TENANCY_ENFORCE = 'on';
    const mw = requireTenancy();
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(mockReq(TENANCY), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 when TENANCY_ENFORCE=on AND req.tenancy is missing — treats it as a coding regression', () => {
    process.env.TENANCY_ENFORCE = 'on';
    const mw = requireTenancy();
    const res = mockRes();
    const next = vi.fn() as NextFunction;
    mw(mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'tenancy_guard_missing',
        // The message must point a developer at the fix — mounting tenancyMiddleware.
        message: expect.stringMatching(/tenancyMiddleware/),
        requestId: 'req-test',
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('reads the env on every call (does not snapshot at construction)', () => {
    // A single guard instance must adapt to a live rollout flip without
    // requiring a server restart. This is what the env-per-call read enables.
    const mw = requireTenancy();
    const next = vi.fn() as NextFunction;

    process.env.TENANCY_ENFORCE = 'off';
    mw(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);

    process.env.TENANCY_ENFORCE = 'on';
    const res2 = mockRes();
    mw(mockReq(), res2, next);
    expect(res2.status).toHaveBeenCalledWith(500);
    expect(next).toHaveBeenCalledTimes(1); // not invoked the second time
  });
});
