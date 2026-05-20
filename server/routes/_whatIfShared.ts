import type { Request, Response } from 'express';

/**
 * Shared helpers for the what-if router family (sandboxes, budget, etc.).
 *
 * Kept narrow on purpose: only the helpers that are genuinely cross-domain
 * live here. Domain-specific extractors (e.g. `sandboxToDto`, `elasticityToDto`)
 * stay in their owning router.
 */

export const METHODOLOGY_AUTHOR_ROLES = new Set([
  'Admin',
  'Risk_Manager',
  'Methodologist',
  'admin',
  'risk_manager',
  'methodologist',
]);

/**
 * Resolve the tenancy scope from the request, responding 400 if absent.
 * Returns `null` after writing the response — callers must `return` on null.
 */
export function tenant(req: Request, res: Response) {
  if (!req.tenancy) {
    res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
    return null;
  }
  return req.tenancy;
}

/** Role guard for endpoints that mutate methodology/policy data. */
export function requireMethodologyAuthor(req: Request, res: Response): boolean {
  const role = req.tenancy?.role ?? req.user?.role ?? '';
  if (!METHODOLOGY_AUTHOR_ROLES.has(role)) {
    res.status(403).json({ code: 'forbidden', message: 'Admin, Risk_Manager or Methodologist role required' });
    return false;
  }
  return true;
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function asJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? '');
}

export function dateOnly(value: unknown): string {
  return isoDate(value).slice(0, 10);
}

export function userEmail(req: Request): string {
  return req.tenancy?.userEmail ?? req.user?.email ?? 'system@n-pricing.local';
}

export function userName(req: Request): string {
  return req.user?.name ?? req.tenancy?.userEmail ?? 'System';
}
