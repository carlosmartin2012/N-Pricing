import { pool } from '../db';
import { sweepEscalations } from '../../utils/governance/escalationEvaluator';
import { recordWorkerTickFailure, recordWorkerTickSuccess } from './workerHealth';
import type {
  ApprovalEscalation,
  ApprovalEscalationConfig,
  EscalationLevel,
  EscalationStatus,
} from '../../types/governance';

/**
 * Runtime adapter for the approval-escalation sweeper.
 * Pure evaluation lives in `utils/governance/escalationEvaluator.ts` —
 * here we plug Postgres reads/writes and the opt-in setInterval loop.
 *
 * The sweeper is idempotent: notify stamps `notified_at` without changing
 * status, so two overlapping ticks do not re-notify. Escalate transitions
 * the old row to `escalated` + inserts a fresh `open` row at the next
 * level (linked via `escalated_from_id`).
 */

interface EscalationRow {
  id: string;
  entity_id: string;
  deal_id: string | null;
  exception_id: string | null;
  level: EscalationLevel;
  due_at: string;
  status: EscalationStatus;
  notified_at: string | null;
  resolved_at: string | null;
  created_at: string;
  opened_by: string | null;
  current_notes: string | null;
  escalated_from_id: string | null;
}

interface ConfigRow {
  id: string;
  entity_id: string;
  level: EscalationLevel;
  timeout_hours: string | number;
  notify_before_hours: string | number;
  channel_type: ApprovalEscalationConfig['channelType'];
  channel_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapRow(r: EscalationRow): ApprovalEscalation {
  return {
    id: r.id, entityId: r.entity_id, dealId: r.deal_id, exceptionId: r.exception_id,
    level: r.level, dueAt: r.due_at, status: r.status,
    notifiedAt: r.notified_at, resolvedAt: r.resolved_at, createdAt: r.created_at,
    openedBy: r.opened_by, currentNotes: r.current_notes, escalatedFromId: r.escalated_from_id,
  };
}

function mapConfig(r: ConfigRow): ApprovalEscalationConfig {
  return {
    id: r.id, entityId: r.entity_id, level: r.level,
    timeoutHours: Number(r.timeout_hours),
    notifyBeforeHours: Number(r.notify_before_hours),
    channelType: r.channel_type, channelConfig: r.channel_config,
    isActive: r.is_active, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export interface SweepReport {
  notified: number;
  escalated: number;
  expired: number;
  untouched: number;
  errors: string[];
}

async function loadOpenEscalations(): Promise<ApprovalEscalation[]> {
  const result = await pool.query<EscalationRow>(
    "SELECT * FROM approval_escalations WHERE status = 'open' LIMIT 5000",
  );
  return result.rows.map(mapRow);
}

async function loadAllConfigs(): Promise<
  Record<string, Partial<Record<EscalationLevel, ApprovalEscalationConfig>>>
> {
  const result = await pool.query<ConfigRow>(
    'SELECT * FROM approval_escalation_configs WHERE is_active = TRUE',
  );
  const byEntity: Record<string, Partial<Record<EscalationLevel, ApprovalEscalationConfig>>> = {};
  for (const r of result.rows) {
    const cfg = mapConfig(r);
    byEntity[cfg.entityId] = byEntity[cfg.entityId] ?? {};
    byEntity[cfg.entityId]![cfg.level] = cfg;
  }
  return byEntity;
}

export async function runSweep(now: Date = new Date()): Promise<SweepReport> {
  const report: SweepReport = { notified: 0, escalated: 0, expired: 0, untouched: 0, errors: [] };

  const [escalations, configsByEntity] = await Promise.all([
    loadOpenEscalations(),
    loadAllConfigs(),
  ]);

  const plans = sweepEscalations(escalations, configsByEntity, now);

  for (const { escalation, action } of plans) {
    try {
      if (action.kind === 'notify') {
        await pool.query(
          'UPDATE approval_escalations SET notified_at = $2 WHERE id = $1',
          [escalation.id, now.toISOString()],
        );
        report.notified += 1;
      } else if (action.kind === 'escalate') {
        await pool.query(
          "UPDATE approval_escalations SET status = 'escalated', resolved_at = $2 WHERE id = $1",
          [escalation.id, now.toISOString()],
        );
        await pool.query(
          `INSERT INTO approval_escalations
             (entity_id, deal_id, exception_id, level, due_at, status, opened_by, current_notes, escalated_from_id)
           VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $8)`,
          [
            escalation.entityId,
            escalation.dealId,
            escalation.exceptionId,
            action.toLevel,
            action.newDueAt,
            escalation.openedBy,
            escalation.currentNotes,
            escalation.id,
          ],
        );
        report.escalated += 1;
      } else if (action.kind === 'expire') {
        await pool.query(
          "UPDATE approval_escalations SET status = 'expired', resolved_at = $2 WHERE id = $1",
          [escalation.id, now.toISOString()],
        );
        report.expired += 1;
      } else {
        report.untouched += 1;
      }
    } catch (err) {
      report.errors.push(`${escalation.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Opt-in loop — enable with ESCALATION_SWEEP_INTERVAL_MS (≥ 60000 recommended)
// ---------------------------------------------------------------------------

let interval: ReturnType<typeof setInterval> | null = null;

export function startEscalationSweeper(): void {
  const ms = Number(process.env.ESCALATION_SWEEP_INTERVAL_MS ?? '0');
  if (!Number.isFinite(ms) || ms < 1_000) return;
  if (interval) return;

  interval = setInterval(async () => {
    try {
      const report = await runSweep();
      if (report.escalated + report.notified + report.expired > 0 || report.errors.length > 0) {
        console.info('[escalation-sweep]', report);
      }
      recordWorkerTickSuccess('escalation-sweep');
    } catch (err) {
      recordWorkerTickFailure('escalation-sweep', err);
    }
  }, ms);
}

export function stopEscalationSweeper(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
