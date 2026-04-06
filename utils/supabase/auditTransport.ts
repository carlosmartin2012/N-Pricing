import type { AuditEntry } from '../../types';
import { mapAuditToDB } from './mappers';
import { log } from './shared';

export type AuditWriteEntry = Omit<AuditEntry, 'id'>;

interface AuditTransportConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface AuditWriteResult {
  ok: boolean;
  errorMessage?: string;
}

export function buildAuditInsertPayload(entry: AuditWriteEntry) {
  return mapAuditToDB(entry);
}

export function resolveAuditTransportConfig(
  overrides: AuditTransportConfig = {},
) {
  const supabaseUrl = overrides.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = overrides.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}

export async function sendAuditEntryKeepalive(
  entry: AuditWriteEntry,
  overrides: AuditTransportConfig = {},
): Promise<AuditWriteResult> {
  const config = resolveAuditTransportConfig(overrides);
  if (!config) {
    return {
      ok: false,
      errorMessage: 'Supabase audit endpoint is not configured.',
    };
  }

  try {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/audit_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabaseAnonKey,
        'Authorization': `Bearer ${config.supabaseAnonKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(buildAuditInsertPayload(entry)),
      keepalive: true,
    });

    if (!response.ok) {
      const errorMessage = `Audit keepalive failed (${response.status}).`;
      log.warn('Audit keepalive request failed', {
        action: entry.action,
        status: response.status,
      });
      return {
        ok: false,
        errorMessage,
      };
    }

    return { ok: true };
  } catch (error) {
    log.warn('Audit keepalive transport failed', {
      action: entry.action,
      error: String(error),
    });
    return {
      ok: false,
      errorMessage: String(error),
    };
  }
}
