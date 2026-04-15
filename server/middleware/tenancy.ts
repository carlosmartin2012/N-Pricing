import { Request, Response, NextFunction, RequestHandler } from 'express';
import { pool, queryOne } from '../db';
import type { TenancyContext, TenancyErrorCode, EntityRole } from '../../types/phase0';

/**
 * Tenancy middleware — layer 1 of multi-tenant defence.
 *
 * Responsibilities:
 *   1. Extract the claimed entity_id from the request (header `x-entity-id`,
 *      then query, then body).
 *   2. Verify the authenticated user (populated by authMiddleware as
 *      req.user.email) has a row in entity_users for that entity, and capture
 *      the role.
 *   3. Attach req.tenancy so downstream handlers have the resolved context.
 *
 * The actual RLS enforcement happens in layer 2 (server/db.ts
 * withTenancyTransaction): the session variables app.current_entity_id /
 * app.current_user_email / app.current_user_role are set inside a transaction
 * whose RLS policies filter accordingly.
 *
 * Failed checks are logged to tenancy_violations (best-effort) and return 403.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenancy?: TenancyContext;
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EntityUserRow {
  role: string;
}

function extractEntityId(req: Request): { raw: string | undefined; uuid: string | null } {
  const fromHeader = req.headers['x-entity-id'];
  const headerValue = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
  const raw =
    headerValue ??
    (typeof req.query.entity_id === 'string' ? req.query.entity_id : undefined) ??
    (typeof (req.body as Record<string, unknown>)?.entity_id === 'string'
      ? ((req.body as Record<string, string>).entity_id)
      : undefined);

  if (!raw) return { raw: undefined, uuid: null };
  return { raw, uuid: UUID_RE.test(raw) ? raw : null };
}

async function logViolation(params: {
  requestId?: string;
  userEmail?: string;
  endpoint: string;
  claimedEntity?: string;
  errorCode: TenancyErrorCode;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO tenancy_violations
         (request_id, user_email, endpoint, claimed_entity, error_code, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.requestId ?? null,
        params.userEmail ?? null,
        params.endpoint,
        params.claimedEntity && UUID_RE.test(params.claimedEntity)
          ? params.claimedEntity
          : null,
        params.errorCode,
        JSON.stringify(params.detail ?? {}),
      ],
    );
  } catch (err) {
    // Never let the logger block the request — the 403 response is authoritative.
    console.error('[tenancy] Failed to persist violation', err);
  }
}

function isValidRole(role: string | undefined): role is EntityRole {
  return role === 'Admin' || role === 'Trader' || role === 'Risk_Manager' || role === 'Auditor';
}

export function tenancyMiddleware(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const endpoint = `${req.method} ${req.path}`;
    const userEmail = req.user?.email;
    const requestId = req.requestId;

    if (!userEmail) {
      await logViolation({ requestId, endpoint, errorCode: 'tenancy_jwt_invalid' });
      res.status(401).json({ code: 'tenancy_jwt_invalid', message: 'Authentication context missing', requestId });
      return;
    }

    const { raw, uuid } = extractEntityId(req);
    if (!raw) {
      await logViolation({ requestId, userEmail, endpoint, errorCode: 'tenancy_missing_header' });
      res.status(400).json({
        code: 'tenancy_missing_header',
        message: 'Missing x-entity-id (or entity_id query/body field)',
        requestId,
      });
      return;
    }
    if (!uuid) {
      await logViolation({
        requestId,
        userEmail,
        endpoint,
        claimedEntity: raw,
        errorCode: 'tenancy_invalid_uuid',
        detail: { claimed: raw },
      });
      res.status(400).json({ code: 'tenancy_invalid_uuid', message: 'entity_id is not a UUID', requestId });
      return;
    }

    let row: EntityUserRow | null;
    try {
      row = await queryOne<EntityUserRow>(
        'SELECT role FROM entity_users WHERE user_id = $1 AND entity_id = $2 LIMIT 1',
        [userEmail, uuid],
      );
    } catch (err) {
      console.error('[tenancy] DB lookup failed', err);
      res.status(500).json({ code: 'tenancy_lookup_failed', message: 'Tenancy check failed', requestId });
      return;
    }

    if (!row) {
      await logViolation({
        requestId,
        userEmail,
        endpoint,
        claimedEntity: uuid,
        errorCode: 'tenancy_denied',
      });
      res.status(403).json({ code: 'tenancy_denied', message: 'User does not have access to this entity', requestId });
      return;
    }

    if (!isValidRole(row.role)) {
      await logViolation({
        requestId,
        userEmail,
        endpoint,
        claimedEntity: uuid,
        errorCode: 'tenancy_role_missing',
        detail: { role: row.role },
      });
      res.status(403).json({ code: 'tenancy_role_missing', message: 'Role is not recognised for this entity', requestId });
      return;
    }

    req.tenancy = {
      entityId: uuid,
      userEmail,
      role: row.role,
      requestId: requestId ?? 'missing',
    };
    next();
  };
}
