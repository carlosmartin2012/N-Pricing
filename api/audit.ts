import type { AuditEntry } from '../types';
import { apiGet, apiPost } from '../utils/apiFetch';
import { mapAuditFromDB } from './mappers';
import { buildAuditInsertPayload, type AuditWriteResult } from '../utils/supabase/auditTransport';
import { createLogger } from '../utils/logger';

const log = createLogger('api/audit');

export async function listAuditLog(): Promise<AuditEntry[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>('/audit');
    return rows.map(mapAuditFromDB);
  } catch { return []; }
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

export async function listAuditLogPaginated(filters: AuditLogFilters = {}): Promise<PaginatedAuditLog> {
  const { page = 1, pageSize = 100 } = filters;
  try {
    const result = await apiGet<{ data: Record<string, unknown>[]; total: number }>(`/audit/paginated?page=${page}&pageSize=${pageSize}`);
    return { data: result.data.map(mapAuditFromDB), total: result.total };
  } catch (err) { return { data: [], total: 0, errorMessage: String(err) }; }
}

export async function createAuditEntry(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>,
): Promise<AuditWriteResult> {
  try {
    const payload = buildAuditInsertPayload({ ...entry, timestamp: new Date().toISOString() } as AuditEntry);
    await apiPost('/audit', payload);
    return { ok: true };
  } catch (err) { return { ok: false, errorMessage: String(err) }; }
}

/**
 * Fire-and-forget audit write used for non-blocking system events
 * (bootstrap, background sync). Never throws — but failures are logged
 * via the central logger so ops can detect a broken audit pipeline
 * instead of seeing absolute silence.
 */
export async function logAudit(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>,
): Promise<void> {
  const result = await createAuditEntry(entry);
  if (!result.ok) {
    log.warn('Audit write failed', {
      action: entry.action,
      module: entry.module,
      errorMessage: result.errorMessage,
    });
  }
}
