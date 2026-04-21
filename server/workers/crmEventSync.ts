import { pool, execute } from '../db';
import { adapterRegistry } from '../../integrations/registry';
import type { CrmPulledEvent, CrmEventKind } from '../../integrations/types';
import type { ClientEventType } from '../../types/clv';

/**
 * CRM → client_events sync worker (Phase 6).
 *
 * Opt-in via `CRM_SYNC_INTERVAL_MS`. Every tick:
 *   1. Lists every (entity, client) with an active position — same corpus
 *      the LTV worker scans.
 *   2. Calls `crmAdapter.pullCrmEvents(clientId, since)` where `since` is
 *      the MAX(event_ts) already stored for that client in client_events.
 *   3. Appends new events, mapped to ClientEventType.
 *
 * Idempotent: source=crm events are deduplicated by (external_id, client_id)
 * stored inside payload — a future migration can add a UNIQUE index on
 * (source, (payload->>'external_id'), client_id) to enforce it at the DB
 * level. For now the `event_ts > since` filter plus best-effort inserts
 * prevent duplication on steady-state runs.
 */

const KIND_TO_EVENT: Record<CrmEventKind, ClientEventType> = {
  contact:           'contact',
  churn_signal:      'churn_signal',
  claim:             'claim',
  crosssell_attempt: 'crosssell_attempt',
  crosssell_won:     'crosssell_won',
  committee_review:  'committee_review',
};

export interface CrmSyncReport {
  scanned: number;
  inserted: number;
  skipped: number;
  errors: string[];
  tookMs: number;
}

async function listPairs(): Promise<Array<{ entity_id: string; client_id: string }>> {
  const { rows } = await pool.query<{ entity_id: string; client_id: string }>(
    `SELECT DISTINCT p.entity_id, p.client_id
     FROM client_positions p
     WHERE p.status = 'Active'`,
  );
  return rows;
}

async function lastSyncedFor(entityId: string, clientId: string): Promise<string | null> {
  const { rows } = await pool.query<{ max_ts: string | null }>(
    `SELECT MAX(event_ts)::text AS max_ts
     FROM client_events
     WHERE entity_id = $1 AND client_id = $2 AND source = 'crm'`,
    [entityId, clientId],
  );
  return rows[0]?.max_ts ?? null;
}

async function insertEvent(
  entityId: string,
  clientId: string,
  evt: CrmPulledEvent,
): Promise<boolean> {
  const eventType = KIND_TO_EVENT[evt.kind];
  if (!eventType) return false;
  const payload = { ...evt.payload, external_id: evt.externalId };
  try {
    await execute(
      `INSERT INTO client_events (
         entity_id, client_id, event_type, event_ts, source,
         amount_eur, payload, created_by
       ) VALUES ($1, $2, $3, $4::timestamptz, 'crm', $5, $6::jsonb, 'worker:crmEventSync')`,
      [entityId, clientId, eventType, evt.occurredAt, evt.amountEur ?? null, JSON.stringify(payload)],
    );
    return true;
  } catch {
    return false;
  }
}

export async function runCrmSyncTick(): Promise<CrmSyncReport> {
  const started = Date.now();
  const crm = adapterRegistry.crm();
  const errors: string[] = [];
  if (!crm || typeof crm.pullCrmEvents !== 'function') {
    return { scanned: 0, inserted: 0, skipped: 0, errors: ['crm adapter missing or no pullCrmEvents'], tookMs: 0 };
  }

  const pairs = await listPairs();
  let inserted = 0;
  let skipped = 0;

  for (const { entity_id, client_id } of pairs) {
    try {
      const since = await lastSyncedFor(entity_id, client_id);
      const res = await crm.pullCrmEvents(client_id, since ?? undefined);
      if (!res.ok) {
        errors.push(`${entity_id}:${client_id} pull_failed:${res.error.code}`);
        skipped++;
        continue;
      }
      for (const evt of res.value) {
        const written = await insertEvent(entity_id, client_id, evt);
        if (written) inserted++;
        else skipped++;
      }
    } catch (err) {
      errors.push(`${entity_id}:${client_id} ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { scanned: pairs.length, inserted, skipped, errors, tookMs: Date.now() - started };
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startCrmEventSync(): void {
  const ms = Number(process.env.CRM_SYNC_INTERVAL_MS ?? '0');
  if (!Number.isFinite(ms) || ms < 60_000) return;
  if (interval) return;
  interval = setInterval(async () => {
    try {
      const report = await runCrmSyncTick();
      if (report.inserted > 0 || report.errors.length > 0) {
        console.info('[crm-sync]', report);
      }
    } catch (err) {
      console.error('[crm-sync] tick failed', err);
    }
  }, ms);
}

export function stopCrmEventSync(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
