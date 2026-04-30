/**
 * Ola 10 Bloque B — Attribution threshold recalibrator worker.
 *
 * Opt-in via `ATTRIBUTION_RECALIBRATION_INTERVAL_MS` (típico: trimestral
 * vía external cron en lugar de setInterval — el worker también ofrece
 * `runRecalibrationSweep()` para llamada explícita).
 *
 * Cada tick:
 *   1. Para cada entity con thresholds activos, lee:
 *      - thresholds activos
 *      - decisiones decided_by_level_id NO null en window (default 180d)
 *   2. Propone ajustes con `proposeThresholdAdjustments`.
 *   3. Persiste cada propuesta en `attribution_threshold_recalibrations`
 *      con status='pending'. UPSERT por threshold_id (un solo pending
 *      a la vez gracias a uniq_attr_recal_pending).
 *
 * Pure logic vive en `utils/attributions/driftRecalibrator.ts`.
 */

import { query, queryOne } from '../db';
import {
  proposeThresholdAdjustments,
  type ProposedRecalibration,
} from '../../utils/attributions/driftRecalibrator';
import type {
  AttributionDecision,
  AttributionThreshold,
} from '../../types/attributions';

interface ThresholdRow {
  id: string;
  entity_id: string;
  level_id: string;
  scope: AttributionThreshold['scope'] | null;
  deviation_bps_max: string | number | null;
  raroc_pp_min:      string | number | null;
  volume_eur_max:    string | number | null;
  active_from:       string | Date;
  active_to:         string | Date | null;
  is_active:         boolean;
  created_at:        string | Date;
  updated_at:        string | Date;
}

interface DecisionRow {
  id:                       string;
  entity_id:                string;
  deal_id:                  string;
  required_level_id:        string;
  decided_by_level_id:      string | null;
  decided_by_user:          string | null;
  decision:                 AttributionDecision['decision'];
  reason:                   string | null;
  pricing_snapshot_hash:    string;
  routing_metadata:         AttributionDecision['routingMetadata'] | null;
  decided_at:               string | Date;
}

function num(v: string | number | null): number | null {
  if (v === null) return null;
  return typeof v === 'string' ? Number(v) : v;
}

function toIsoDate(v: string | Date): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v.slice(0, 10);
}

function toIsoString(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : v;
}

function mapThreshold(row: ThresholdRow): AttributionThreshold {
  return {
    id:               row.id,
    entityId:         row.entity_id,
    levelId:          row.level_id,
    scope:            row.scope ?? {},
    deviationBpsMax:  num(row.deviation_bps_max),
    rarocPpMin:       num(row.raroc_pp_min),
    volumeEurMax:     num(row.volume_eur_max),
    activeFrom:       toIsoDate(row.active_from),
    activeTo:         row.active_to === null ? null : toIsoDate(row.active_to),
    isActive:         row.is_active,
    createdAt:        toIsoString(row.created_at),
    updatedAt:        toIsoString(row.updated_at),
  };
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
    decidedAt:           toIsoString(row.decided_at),
  };
}

export interface RecalibrationSweepReport {
  entitiesScanned: number;
  proposalsEmitted: number;
  proposalsByEntity: Record<string, number>;
  errors: string[];
}

export interface RecalibrationSweepOptions {
  windowDays?: number;
  minSampleSize?: number;
}

export async function runRecalibrationSweep(
  options: RecalibrationSweepOptions = {},
): Promise<RecalibrationSweepReport> {
  const windowDays = options.windowDays ?? 180;
  const report: RecalibrationSweepReport = {
    entitiesScanned: 0,
    proposalsEmitted: 0,
    proposalsByEntity: {},
    errors: [],
  };

  let entityIds: string[];
  try {
    const rows = await query<{ entity_id: string }>(
      `SELECT DISTINCT entity_id FROM attribution_thresholds WHERE is_active = TRUE`,
    );
    entityIds = rows.map((r) => r.entity_id);
  } catch (err) {
    report.errors.push(`fetch entity list failed: ${(err as Error).message}`);
    return report;
  }

  for (const entityId of entityIds) {
    try {
      const [thresholdRows, decisionRows] = await Promise.all([
        query<ThresholdRow>(
          `SELECT * FROM attribution_thresholds
           WHERE entity_id = $1 AND is_active = TRUE`,
          [entityId],
        ),
        query<DecisionRow>(
          `SELECT * FROM attribution_decisions
           WHERE entity_id = $1
             AND decided_by_level_id IS NOT NULL
             AND decided_at >= NOW() - ($2 || ' days')::interval`,
          [entityId, String(windowDays)],
        ),
      ]);

      const proposals: ProposedRecalibration[] = proposeThresholdAdjustments({
        entityId,
        thresholds: thresholdRows.map(mapThreshold),
        decisions:  decisionRows.map(mapDecision),
        options:    { windowDays, minSampleSize: options.minSampleSize },
      });

      for (const p of proposals) {
        await persistProposal(p);
        report.proposalsEmitted += 1;
      }
      if (proposals.length > 0) {
        report.proposalsByEntity[entityId] = proposals.length;
      }
      report.entitiesScanned += 1;
    } catch (err) {
      report.errors.push(`entity ${entityId}: ${(err as Error).message}`);
    }
  }
  return report;
}

/**
 * UPSERT por threshold_id sobre el unique partial index
 * `uniq_attr_recal_pending`. Si ya hay una pending, se actualiza con
 * los nuevos valores propuestos + nueva rationale + nuevo proposed_at.
 *
 * Nota: la cláusula es `ON CONFLICT (col) WHERE ...` — el index `uniq_attr_recal_pending`
 * es un partial unique index, no una constraint nombrada, por lo que
 * `ON CONFLICT ON CONSTRAINT uniq_attr_recal_pending` no es válido en PG
 * (lanza `42P10: there is no unique or exclusion constraint matching the
 * ON CONFLICT specification`).
 */
async function persistProposal(p: ProposedRecalibration): Promise<void> {
  await queryOne(
    `INSERT INTO attribution_threshold_recalibrations
       (entity_id, threshold_id, proposed_deviation_bps_max,
        proposed_raroc_pp_min, proposed_volume_eur_max, rationale, status, proposed_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
     ON CONFLICT (threshold_id) WHERE status = 'pending'
       DO UPDATE SET
         proposed_deviation_bps_max = EXCLUDED.proposed_deviation_bps_max,
         proposed_raroc_pp_min      = EXCLUDED.proposed_raroc_pp_min,
         proposed_volume_eur_max    = EXCLUDED.proposed_volume_eur_max,
         rationale                  = EXCLUDED.rationale,
         proposed_at                = EXCLUDED.proposed_at
     RETURNING id`,
    [
      p.entityId,
      p.thresholdId,
      p.proposedDeviationBpsMax,
      p.proposedRarocPpMin,
      p.proposedVolumeEurMax,
      JSON.stringify(p.rationale),
    ],
  );
}

// ---------------------------------------------------------------------------
// Opt-in loop
// ---------------------------------------------------------------------------

let interval: ReturnType<typeof setInterval> | null = null;

export function startThresholdRecalibrator(): void {
  const ms = Number(process.env.ATTRIBUTION_RECALIBRATION_INTERVAL_MS ?? '0');
  if (!Number.isFinite(ms) || ms < 1_000) return;
  if (interval) return;
  interval = setInterval(async () => {
    try {
      const report = await runRecalibrationSweep();
      if (report.proposalsEmitted > 0 || report.errors.length > 0) {
        console.info('[attribution-recalibrator]', report);
      }
    } catch (err) {
      console.error('[attribution-recalibrator] tick failed', err);
    }
  }, ms);
}

export function stopThresholdRecalibrator(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

// Internal helpers exposed for tests
export const __recalibratorWorkerInternals = { mapThreshold, mapDecision, persistProposal };
