/**
 * API layer — Audit Trail
 *
 * Wraps Supabase calls for the `audit_log` table with typed
 * inputs/outputs and consistent error handling.
 */

import type { AuditEntry } from '../types';
import { safeSupabaseCall } from '../utils/validation';
import { supabase } from '../utils/supabase/shared';
import { mapAuditFromDB } from './mappers';
import { buildAuditInsertPayload, type AuditWriteResult } from '../utils/supabase/auditTransport';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch the most recent 100 audit log entries. */
export async function listAuditLog(): Promise<AuditEntry[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100),
    [],
    'listAuditLog',
  );
  return (data as Record<string, unknown>[]).map(mapAuditFromDB);
}

export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
}

export interface PaginatedAuditLog {
  data: AuditEntry[];
  total: number;
  errorMessage?: string;
}

/** Fetch a paginated slice of the audit log. */
export async function listAuditLogPaginated(
  filters: AuditLogFilters = {},
): Promise<PaginatedAuditLog> {
  const { page = 1, pageSize = 100 } = filters;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await safeSupabaseCall(
    async () =>
      supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(from, to),
    null,
    'listAuditLogPaginated',
  );

  if (error || !data) {
    return { data: [], total: 0, errorMessage: error ?? undefined };
  }

  const rows = data as Record<string, unknown>[] & { count?: number };
  return {
    data: (Array.isArray(rows) ? rows : []).map(mapAuditFromDB),
    total: (rows as unknown as { count?: number }).count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Add a new audit log entry. */
export async function logAudit(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>,
): Promise<AuditWriteResult> {
  const payload = buildAuditInsertPayload({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  const { error } = await safeSupabaseCall(
    async () => supabase.from('audit_log').insert(payload),
    null,
    'logAudit',
  );

  if (error) {
    return { ok: false, errorMessage: error };
  }
  return { ok: true };
}
