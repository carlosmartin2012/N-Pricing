import type { AuditEntry } from '../../types';
import { mapAuditToDB } from './mappers';
import { log } from './shared';

export type AuditWriteEntry = Omit<AuditEntry, 'id'>;

export interface AuditWriteResult {
  ok: boolean;
  errorMessage?: string;
}

export function buildAuditInsertPayload(entry: AuditWriteEntry) {
  return mapAuditToDB(entry);
}

export async function sendAuditEntryKeepalive(entry: AuditWriteEntry): Promise<AuditWriteResult> {
  try {
    const payload = buildAuditInsertPayload(entry);
    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!response.ok) {
      const msg = `Audit keepalive failed (${response.status})`;
      log.warn('Audit keepalive failed', { action: entry.action, status: response.status });
      return { ok: false, errorMessage: msg };
    }
    return { ok: true };
  } catch (err) {
    log.warn('Audit keepalive transport failed', { action: entry.action, error: String(err) });
    return { ok: false, errorMessage: String(err) };
  }
}
