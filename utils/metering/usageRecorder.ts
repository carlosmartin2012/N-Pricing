import type { Pool } from 'pg';
import type { UsageEventKind } from '../../types/metering';

/**
 * Thin recorder used by server routes / Edge Functions to drop a
 * usage_events row best-effort. Never throws — billing must not block
 * pricing.
 */

export interface UsageRecorderDeps {
  insert(entityId: string, kind: UsageEventKind, units: number, detail?: Record<string, unknown>): Promise<void>;
}

export function recorderFromPool(pool: Pool): UsageRecorderDeps {
  return {
    async insert(entityId, kind, units = 1, detail = {}) {
      try {
        await pool.query(
          `INSERT INTO usage_events (entity_id, event_kind, units, detail)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [entityId, kind, units, JSON.stringify(detail)],
        );
      } catch (err) {
        console.error('[metering] usage_events insert failed', { kind, units, error: String(err) });
      }
    },
  };
}

/** In-memory recorder for tests. */
export interface RecordedEvent {
  entityId: string;
  kind: UsageEventKind;
  units: number;
  detail: Record<string, unknown>;
  at: number;
}

export class InMemoryRecorder implements UsageRecorderDeps {
  events: RecordedEvent[] = [];
  async insert(entityId: string, kind: UsageEventKind, units = 1, detail: Record<string, unknown> = {}) {
    this.events.push({ entityId, kind, units, detail, at: Date.now() });
  }
}
