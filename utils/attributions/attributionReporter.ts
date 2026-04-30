/**
 * Ola 8 — Atribuciones jerárquicas (Bloque C).
 *
 * Reporting puro: dado un universo de AttributionDecision[], produce
 * agregaciones por dimensión (nivel, usuario, scope, periodo) + detección
 * de drift sistemático + funnel + estadísticas de time-to-decision.
 *
 * Sin I/O, sin DB. El server adapter (utils/attributions/ no es server-only)
 * y el worker `server/workers/attributionDriftDetector.ts` consumen estas
 * funciones puras + acoplan persistencia.
 *
 * Nota: el "drift" aquí es a nivel de **patrón sistemático por figura
 * comercial** (un Director que aprueba siempre al límite), no el drift de
 * methodology que vive en `utils/backtesting/driftDetector.ts` (Phase 3).
 * Los nombres son distintos por diseño — semántica diferente.
 */

import type {
  AttributionDecision,
  AttributionDecisionStatus,
  AttributionLevel,
} from '../../types/attributions';

// ---------------------------------------------------------------------------
// Aggregations
// ---------------------------------------------------------------------------

export interface VolumeStats {
  count: number;
  totalEur: number;
  meanEur: number;
  meanRarocPp: number;
  meanDeviationBps: number;
}

const EMPTY_STATS: VolumeStats = {
  count: 0,
  totalEur: 0,
  meanEur: 0,
  meanRarocPp: 0,
  meanDeviationBps: 0,
};

function statsFor(decisions: AttributionDecision[]): VolumeStats {
  if (decisions.length === 0) return EMPTY_STATS;
  const totalEur     = decisions.reduce((acc, d) => acc + (d.routingMetadata.volumeEur ?? 0), 0);
  const totalRaroc   = decisions.reduce((acc, d) => acc + (d.routingMetadata.rarocPp ?? 0), 0);
  const totalDeviation = decisions.reduce((acc, d) => acc + (d.routingMetadata.deviationBps ?? 0), 0);
  return {
    count:            decisions.length,
    totalEur,
    meanEur:          totalEur / decisions.length,
    meanRarocPp:      totalRaroc / decisions.length,
    meanDeviationBps: totalDeviation / decisions.length,
  };
}

export interface ByLevelEntry {
  levelId: string;
  level: AttributionLevel | null;
  stats: VolumeStats;
  byDecision: Record<AttributionDecisionStatus, number>;
}

const EMPTY_BY_DECISION: Record<AttributionDecisionStatus, number> = {
  approved: 0, rejected: 0, escalated: 0, expired: 0, reverted: 0,
};

/**
 * Agrega decisiones por `decidedByLevelId`. Decisiones con
 * `decidedByLevelId=null` (no resueltas todavía) se acumulan en una entrada
 * sintética con `levelId=PENDING`.
 */
export function aggregateByLevel(
  decisions: AttributionDecision[],
  levels: AttributionLevel[],
): ByLevelEntry[] {
  const byId = new Map(levels.map((l) => [l.id, l]));
  const groups = new Map<string, AttributionDecision[]>();
  for (const d of decisions) {
    const key = d.decidedByLevelId ?? 'PENDING';
    const arr = groups.get(key) ?? [];
    arr.push(d);
    groups.set(key, arr);
  }
  const out: ByLevelEntry[] = [];
  for (const [levelId, items] of groups) {
    const byDecision: Record<AttributionDecisionStatus, number> = { ...EMPTY_BY_DECISION };
    for (const item of items) byDecision[item.decision] += 1;
    out.push({
      levelId,
      level: byId.get(levelId) ?? null,
      stats: statsFor(items),
      byDecision,
    });
  }
  return out;
}

export interface ByUserEntry {
  userId: string;
  stats: VolumeStats;
  pctAtLimit: number;     // 0..1 — fracción de decisiones con deviation >= 80% del límite del nivel
  approvedRate: number;   // 0..1 — fracción de approved sobre count total
}

/**
 * Agrega por `decidedByUser`. Calcula `pctAtLimit` y `approvedRate` por
 * usuario. El "límite" se calcula como: para cada decisión, el threshold
 * del nivel decisor; si la abs(deviationBps) ≥ 0.8 × maxAllowed → al límite.
 *
 * Si no se pasa el threshold-lookup, `pctAtLimit` se calcula con
 * heurística: deviation absoluta ≥ 8 bps cuenta como "al límite".
 */
export function aggregateByUser(
  decisions: AttributionDecision[],
  thresholdLookup?: (levelId: string) => { deviationBpsMax: number | null } | null,
): ByUserEntry[] {
  const groups = new Map<string, AttributionDecision[]>();
  for (const d of decisions) {
    if (!d.decidedByUser) continue;
    const arr = groups.get(d.decidedByUser) ?? [];
    arr.push(d);
    groups.set(d.decidedByUser, arr);
  }
  const out: ByUserEntry[] = [];
  for (const [userId, items] of groups) {
    let atLimit = 0;
    let approved = 0;
    for (const d of items) {
      if (d.decision === 'approved') approved += 1;
      const dev = Math.abs(d.routingMetadata.deviationBps ?? 0);
      const max = thresholdLookup?.(d.decidedByLevelId ?? '')?.deviationBpsMax ?? null;
      const limit = max !== null ? max * 0.8 : 8;
      if (dev >= limit) atLimit += 1;
    }
    out.push({
      userId,
      stats:        statsFor(items),
      pctAtLimit:   items.length > 0 ? atLimit / items.length : 0,
      approvedRate: items.length > 0 ? approved / items.length : 0,
    });
  }
  return out.sort((a, b) => b.pctAtLimit - a.pctAtLimit);
}

// ---------------------------------------------------------------------------
// Funnel: quote → decision lifecycle
// ---------------------------------------------------------------------------

export interface DecisionFunnel {
  total: number;
  approved: number;
  rejected: number;
  escalated: number;
  expired: number;
  reverted: number;
  approvedRate: number;
  rejectedRate: number;
  expiredRate: number;
}

export function decisionFunnel(decisions: AttributionDecision[]): DecisionFunnel {
  const counts = decisions.reduce<Record<AttributionDecisionStatus, number>>(
    (acc, d) => {
      acc[d.decision] = (acc[d.decision] ?? 0) + 1;
      return acc;
    },
    { ...EMPTY_BY_DECISION },
  );
  const total = decisions.length;
  return {
    total,
    approved:     counts.approved,
    rejected:     counts.rejected,
    escalated:    counts.escalated,
    expired:      counts.expired,
    reverted:     counts.reverted,
    approvedRate: total > 0 ? counts.approved / total : 0,
    rejectedRate: total > 0 ? counts.rejected / total : 0,
    expiredRate:  total > 0 ? counts.expired  / total : 0,
  };
}

// ---------------------------------------------------------------------------
// Time-to-decision
// ---------------------------------------------------------------------------

export interface TimeToDecisionStats {
  count: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
  byLevel: Record<string, { count: number; medianMs: number; p95Ms: number }>;
}

/**
 * `decidedAt` es el timestamp de la decisión final; el "open" es la primera
 * row de la cadena para ese deal. Aquí tomamos como input pares
 * (deal → openedAt, decidedAt) ya resueltos por el caller.
 */
export function timeToDecisionStats(
  pairs: Array<{ levelId: string; openedAt: string; decidedAt: string }>,
): TimeToDecisionStats {
  if (pairs.length === 0) {
    return { count: 0, meanMs: 0, medianMs: 0, p95Ms: 0, byLevel: {} };
  }
  const durations = pairs.map((p) => Date.parse(p.decidedAt) - Date.parse(p.openedAt));
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Idx];
  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;

  // Por nivel
  const byLevel: TimeToDecisionStats['byLevel'] = {};
  const groups = new Map<string, number[]>();
  for (let i = 0; i < pairs.length; i++) {
    const arr = groups.get(pairs[i].levelId) ?? [];
    arr.push(durations[i]);
    groups.set(pairs[i].levelId, arr);
  }
  for (const [levelId, ds] of groups) {
    const s = [...ds].sort((a, b) => a - b);
    byLevel[levelId] = {
      count:    s.length,
      medianMs: s[Math.floor(s.length / 2)],
      p95Ms:    s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
    };
  }

  return { count: pairs.length, meanMs: mean, medianMs: median, p95Ms: p95, byLevel };
}

// ---------------------------------------------------------------------------
// Drift detection — patrón sistemático por figura comercial
// ---------------------------------------------------------------------------

export interface DriftSignal {
  userId: string;
  count: number;
  meanDeviationBps: number;
  pctAtLimit: number;
  severity: 'ok' | 'warning' | 'breached';
  reasons: string[];
}

export interface DriftThresholds {
  /** Min decisiones del usuario para considerar una señal estable. Default 20. */
  minSampleSize: number;
  /** Drift medio (bps) — warning si supera. Default 5. */
  meanDeviationWarnBps: number;
  /** Drift medio (bps) — breached si supera. Default 10. */
  meanDeviationBreachBps: number;
  /** % decisiones al límite — warning si supera. Default 0.30. */
  pctAtLimitWarn: number;
  /** % decisiones al límite — breached si supera. Default 0.50. */
  pctAtLimitBreach: number;
}

export const DEFAULT_ATTRIBUTION_DRIFT_THRESHOLDS: DriftThresholds = {
  minSampleSize:          20,
  meanDeviationWarnBps:   5,
  meanDeviationBreachBps: 10,
  pctAtLimitWarn:         0.30,
  pctAtLimitBreach:       0.50,
};

/**
 * Detecta usuarios con patrón sistemático de aprobación al límite. Devuelve
 * señales `warning` o `breached` (no `ok` — el caller filtra por severity).
 */
export function detectSystematicDrift(
  byUser: ByUserEntry[],
  thresholds: DriftThresholds = DEFAULT_ATTRIBUTION_DRIFT_THRESHOLDS,
): DriftSignal[] {
  const out: DriftSignal[] = [];
  for (const entry of byUser) {
    if (entry.stats.count < thresholds.minSampleSize) continue;

    const meanDev = Math.abs(entry.stats.meanDeviationBps);
    const reasons: string[] = [];
    let sev: DriftSignal['severity'] = 'ok';

    if (meanDev >= thresholds.meanDeviationBreachBps) {
      sev = 'breached';
      reasons.push(`mean drift ${meanDev.toFixed(1)} bps ≥ ${thresholds.meanDeviationBreachBps}`);
    } else if (meanDev >= thresholds.meanDeviationWarnBps) {
      sev = 'warning';
      reasons.push(`mean drift ${meanDev.toFixed(1)} bps ≥ ${thresholds.meanDeviationWarnBps}`);
    }

    if (entry.pctAtLimit >= thresholds.pctAtLimitBreach) {
      sev = 'breached';
      reasons.push(`${(entry.pctAtLimit * 100).toFixed(0)}% decisions at limit ≥ ${(thresholds.pctAtLimitBreach * 100).toFixed(0)}%`);
    } else if (entry.pctAtLimit >= thresholds.pctAtLimitWarn) {
      // Solo escala a warning si no estaba ya en breached por dev medio
      if (sev !== 'breached') sev = 'warning';
      reasons.push(`${(entry.pctAtLimit * 100).toFixed(0)}% decisions at limit ≥ ${(thresholds.pctAtLimitWarn * 100).toFixed(0)}%`);
    }

    if (sev !== 'ok') {
      out.push({
        userId:           entry.userId,
        count:            entry.stats.count,
        meanDeviationBps: entry.stats.meanDeviationBps,
        pctAtLimit:       entry.pctAtLimit,
        severity:         sev,
        reasons,
      });
    }
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'breached' ? -1 : 1));
}

// ---------------------------------------------------------------------------
// Aggregate report — lo que el endpoint devuelve consolidado
// ---------------------------------------------------------------------------

export interface AttributionReportingSummary {
  generatedAt: string;
  windowDays: number;
  totalDecisions: number;
  byLevel: ByLevelEntry[];
  byUser: ByUserEntry[];
  funnel: DecisionFunnel;
  drift: DriftSignal[];
  /** Time-to-decision opcional — requiere pares (open, decided) que el
   *  caller construye desde audit_log o columnas adicionales. Si el caller
   *  no provee, se omite (`null`). */
  timeToDecision: TimeToDecisionStats | null;
}

export interface BuildSummaryInput {
  decisions: AttributionDecision[];
  levels: AttributionLevel[];
  windowDays: number;
  thresholdLookup?: (levelId: string) => { deviationBpsMax: number | null } | null;
  decisionTimePairs?: Array<{ levelId: string; openedAt: string; decidedAt: string }>;
  driftThresholds?: DriftThresholds;
  now?: () => Date;
}

export function buildAttributionSummary(input: BuildSummaryInput): AttributionReportingSummary {
  const byLevel = aggregateByLevel(input.decisions, input.levels);
  const byUser  = aggregateByUser(input.decisions, input.thresholdLookup);
  const drift   = detectSystematicDrift(byUser, input.driftThresholds);
  const funnel  = decisionFunnel(input.decisions);
  const timeToDecision = input.decisionTimePairs
    ? timeToDecisionStats(input.decisionTimePairs)
    : null;
  const generatedAt = (input.now?.() ?? new Date()).toISOString();
  return {
    generatedAt,
    windowDays:     input.windowDays,
    totalDecisions: input.decisions.length,
    byLevel,
    byUser,
    funnel,
    drift,
    timeToDecision,
  };
}
