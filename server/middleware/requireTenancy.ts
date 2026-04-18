import type { Request, RequestHandler } from 'express';

/**
 * Tenancy scope for a request. `entityId` is `null` in legacy / off mode
 * (`TENANCY_ENFORCE=off`) and a validated UUID when the tenancy middleware
 * populated `req.tenancy`. Handlers use this to conditionally build
 * entity-scoped WHERE clauses: under strict mode queries filter by entity,
 * under legacy mode they keep the pre-tenancy behaviour so rollout does not
 * regress existing deployments.
 */
export interface TenancyScope {
  entityId: string | null;
  userEmail: string | null;
  role: string | null;
  isStrict: boolean;
}

export function tenancyScope(req: Request): TenancyScope {
  if (req.tenancy) {
    return {
      entityId: req.tenancy.entityId,
      userEmail: req.tenancy.userEmail,
      role: req.tenancy.role,
      isStrict: true,
    };
  }
  return { entityId: null, userEmail: null, role: null, isStrict: false };
}

/**
 * Builds the SQL fragment that pins a query to the current entity when the
 * tenancy middleware is active. Returns an empty fragment (and no params)
 * when running in legacy mode. Callers splice the clause into their SQL and
 * prepend the params to the existing parameter list.
 *
 *   const scope = entityScopedClause(req, 1);
 *   const sql = `SELECT * FROM deals ${scope.where} ORDER BY created_at DESC`;
 *   const params = [...scope.params, ...otherParams];
 */
export function entityScopedClause(
  req: Request,
  startIndex: number,
  column = 'entity_id',
): { where: string; and: string; params: unknown[] } {
  const scope = tenancyScope(req);
  if (!scope.entityId) {
    return { where: '', and: '', params: [] };
  }
  return {
    where: `WHERE ${column} = $${startIndex}`,
    and: `AND ${column} = $${startIndex}`,
    params: [scope.entityId],
  };
}

/**
 * Hard guard — use on routes that should NEVER fall through to legacy
 * behaviour, regardless of `TENANCY_ENFORCE`. Returns 500 when a handler
 * reaches this point without `req.tenancy` populated, because that means
 * the router was mounted without `tenancyMiddleware()` — a coding
 * regression, not an operational state. Safe to stack on top of the normal
 * middleware chain as belt-and-suspenders.
 */
export function requireTenancy(): RequestHandler {
  return (req, res, next) => {
    if (!req.tenancy) {
      res.status(500).json({
        code: 'tenancy_guard_missing',
        message: 'requireTenancy() reached without req.tenancy populated — mount tenancyMiddleware() on this router',
        requestId: req.requestId,
      });
      return;
    }
    next();
  };
}
