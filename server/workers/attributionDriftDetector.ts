/**
 * Ola 8 Bloque C — Attribution drift detector worker.
 *
 * Opt-in via `ATTRIBUTION_DRIFT_INTERVAL_MS` (≥ 60_000 recommended).
 * Cada tick:
 *   1. Lee attribution_decisions de los últimos N días por entity.
 *   2. Para cada entity, agrupa por usuario y aplica
 *      `detectSystematicDrift` del módulo puro.
 *   3. Emite logs estructurados con las señales `warning` y `breached`
 *      para que el alert-evaluator los recoja vía métrica
 *      `attribution_drift_signals_total`.
 *
 * No persiste decisiones ni dispara emails directamente — esa parte
 * queda al `alertEvaluator` existente que consume métricas
 * (mismo patrón que `escalation-sweep` ⟶ `escalation_timeouts_total`).
 *
 * Pure logic vive en `utils/attributions/attributionReporter.ts`.
 */

import { query } from '../db';
import {
  aggregateByUser,
  detectSystematicDrift,
  type ByUserEntry,
  type DriftSignal,
  type DriftThresholds,
} from '../../utils/attributions/attributionReporter';
import type { AttributionDecision } from '../../types/attributions';

interface DecisionRow {
  id: string;
  entity_id: string;
  deal_id: string;
  required_level_id: string;
  decided_by_level_id: string | null;
  decided_by_user: string | null;
  decision: AttributionDecision['decision'];
  reason: string | null;
  pricing_snapshot_hash: string;
  routing_metadata: AttributionDecision['routingMetadata'] | null;
  decided_at: string | Date;
}

interface ThresholdRow {
  level_id: string;
  deviation_bps_max: string | number | null;
}

function mapDecision(row: DecisionRow): AttributionDecision {
  return {
    id:                  row.id,
    entityId:            row.entity_id,
    dealId:              row.deal_id,
    requiredLevelId:     row.required_level_id,
    decidedByLevelId:    row.decided_by_level_id,
    decidedByUser:       row.decided_by_user,
    decision:            row.decision,
    reason:              row.reason,
    pricingSnapshotHash: row.pricing_snapshot_hash,
    routingMetadata:     row.routing_metadata ?? {
      deviationBps: 0, rarocPp: 0, volumeEur: 0, scope: {},
    },
    decidedAt:           row.decided_at instanceof Date
      ? row.decided_at.toISOString()
      : row.decided_at,
  };
}

export interface DriftSweepReport {
  entitiesScanned: number;
  signalsTotal: number;
  signalsByEntity: Record<string, DriftSignal[]>;
  errors: string[];
}

export interface DriftSweepOptions {
  /** Días hacia atrás a considerar. Default 90. */
  windowDays?: number;
  /** Override de thresholds (si null, usa los defaults del reporter). */
  driftThresholds?: DriftThresholds;
}

/**
 * Ejecuta una pasada del detector. Idempotente — los logs son la única
 * salida; no escribe en DB. Llamar varias veces seguidas no produce
 * efectos colaterales acumulables.
 */
export async function runAttributionDriftSweep(
  options: DriftSweepOptions = {},
): Promise<DriftSweepReport> {
  const windowDays = options.windowDays ?? 90;
  const report: DriftSweepReport = {
    entitiesScanned: 0,
    signalsTotal:    0,
    signalsByEntity: {},
    errors:          [],
  };

  let entityIds: string[];
  try {
    const rows = await query<{ entity_id: string }>(
      `SELECT DISTINCT entity_id FROM attribution_decisions
       WHERE decided_at >= NOW() - ($1 || ' days')::interval`,
      [String(windowDays)],
    );
    entityIds = rows.map((r) => r.entity_id);
  } catch (err) {
    report.errors.push(`fetch entity list failed: ${(err as Error).message}`);
    return report;
  }

  for (const entityId of entityIds) {
    try {
      const [decisionRows, thresholdRows] = await Promise.all([
        query<DecisionRow>(
          `SELECT * FROM attribution_decisions
           WHERE entity_id = $1
             AND decided_at >= NOW() - ($2 || ' days')::interval`,
          [entityId, String(windowDays)],
        ),
        query<ThresholdRow>(
          `SELECT level_id, deviation_bps_max FROM attribution_thresholds
           WHERE entity_id = $1 AND is_active = TRUE`,
          [entityId],
        ),
      ]);

      const decisions = decisionRows.map(mapDecision);
      const lookup: Map<string, number | null> = new Map(
        thresholdRows.map((t) => [
          t.level_id,
          t.deviation_bps_max === null ? null : Number(t.deviation_bps_max),
        ]),
      );

      const byUser: ByUserEntry[] = aggregateByUser(decisions, (levelId) => {
        const max = lookup.get(levelId);
        return max === undefined ? null : { deviationBpsMax: max };
      });

      const signals = detectSystematicDrift(byUser, options.driftThresholds);
      if (signals.length > 0) {
        report.signalsByEntity[entityId] = signals;
        report.signalsTotal += signals.length;
        for (const s of signals) {
          // Log estructurado — alertEvaluator puede recoger via métrica
          // attribution_drift_signals_total.
          console.warn('[attribution-drift]', {
            entityId,
            userId:    s.userId,
            severity:  s.severity,
            count:     s.count,
            meanBps:   s.meanDeviationBps,
            atLimit:   s.pctAtLimit,
            reasons:   s.reasons,
          });
        }
      }
      report.entitiesScanned += 1;
    } catch (err) {
      report.errors.push(`entity ${entityId}: ${(err as Error).message}`);
    }
  }
  return report;
}

// ---------------------------------------------------------------------------
// Opt-in loop
// ---------------------------------------------------------------------------

let interval: ReturnType<typeof setInterval> | null = null;

export function startAttributionDriftDetector(): void {
  const ms = Number(process.env.ATTRIBUTION_DRIFT_INTERVAL_MS ?? '0');
  if (!Number.isFinite(ms) || ms < 1_000) return;
  if (interval) return;

  interval = setInterval(async () => {
    try {
      const report = await runAttributionDriftSweep();
      if (report.signalsTotal > 0 || report.errors.length > 0) {
        console.info('[attribution-drift] sweep', {
          entitiesScanned: report.entitiesScanned,
          signalsTotal:    report.signalsTotal,
          errors:          report.errors.length,
        });
      }
    } catch (err) {
      console.error('[attribution-drift] tick failed', err);
    }
  }, ms);
}

export function stopAttributionDriftDetector(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
