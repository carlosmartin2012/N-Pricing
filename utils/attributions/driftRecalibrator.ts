/**
 * Ola 10 Bloque B — Drift threshold recalibrator (puro).
 *
 * Dado el histórico de decisiones de un tenant + la matriz vigente,
 * propone ajustes a los thresholds de attribution. La idea es que un
 * threshold sistemáticamente "tight" (mucho drift al límite + alta
 * tasa de escalation) probablemente está mal calibrado para la cartera
 * actual, y al revés un threshold "loose" (drift cero, escalation cero)
 * podría apretarse para mejorar discipline.
 *
 * Output: ThresholdRecalibration[] con status='pending'. El worker que
 * llama a este módulo persiste cada uno en DB y dispara governance
 * flow para Admin/Risk_Manager review.
 *
 * Pure: no I/O, no DB. Tests deterministas.
 */

import type {
  AttributionDecision,
  AttributionLevel,
  AttributionThreshold,
  ThresholdRecalibration,
  ThresholdRecalibrationRationale,
} from '../../types/attributions';

export interface RecalibratorOptions {
  /** Días de histórico considerados. Default 180 (≈ 2 trimestres). */
  windowDays?: number;
  /** Mínimo de decisiones por threshold para considerar señal estable.
   *  Default 30. Por debajo se omite el threshold. */
  minSampleSize?: number;
  /** Drift medio absoluto (bps) por encima del cual se propone relajar
   *  el `deviationBpsMax`. Default 8. */
  meanDriftRelaxBps?: number;
  /** Si % decisiones at limit > este, también se propone relajar.
   *  Default 0.40 (40%). */
  pctAtLimitRelax?: number;
  /** Si % decisiones escaladas > este, se propone relajar. Default 0.30. */
  escalationRateRelax?: number;
  /** Si el threshold tiene drift cero + 0% at limit + 0% escalation,
   *  proponemos apretar. Default 0.05 (5%) — relativo al valor actual. */
  tightenStepRatio?: number;
  /** Step relativo al relajar — proponemos +20% del límite actual.
   *  Default 0.20. */
  relaxStepRatio?: number;
  /** now() override para tests deterministas. */
  now?: () => Date;
}

const DEFAULTS: Required<Omit<RecalibratorOptions, 'now'>> = {
  windowDays:           180,
  minSampleSize:        30,
  meanDriftRelaxBps:    8,
  pctAtLimitRelax:      0.40,
  escalationRateRelax:  0.30,
  tightenStepRatio:     0.05,
  relaxStepRatio:       0.20,
};

interface ThresholdDecisionStats {
  count: number;
  /**
   * Media de `|deviationBps|` — magnitud de dispersión, NO bias direccional.
   * Esta es la señal correcta para "¿el threshold está demasiado tight?".
   * Una cartera con drift simétrico (+10/-10) tiene `meanAbsDeviationBps`
   * alto aunque `signedBiasBps` colapse a 0.
   */
  meanAbsDeviationBps: number;
  /**
   * Media de `deviationBps` con signo — bias direccional. Un valor
   * negativo indica que sistemáticamente el banco está dando descuentos
   * (drift hacia el cliente); positivo indica primas. NO se usa para
   * gating de relax/tighten — sólo se reporta en rationale para que el
   * Risk_Manager vea si la cartera tiene sesgo además de dispersión.
   */
  signedBiasBps: number;
  pctAtLimit: number;
  escalationRate: number;
}

/**
 * Agrupa decisiones por threshold (vía decided_by_level_id ↔
 * threshold.level_id) y calcula estadísticas.
 *
 * Nota: una decisión puede asociarse a múltiples thresholds del mismo
 * nivel (scope distintos). Aquí usamos el primero que matchea por
 * level_id; refinamientos por scope quedan como follow-up.
 */
function statsByThreshold(
  decisions: AttributionDecision[],
  thresholds: AttributionThreshold[],
): Map<string, ThresholdDecisionStats> {
  const out = new Map<string, ThresholdDecisionStats>();
  const thresholdsByLevel = new Map<string, AttributionThreshold[]>();
  for (const t of thresholds) {
    const arr = thresholdsByLevel.get(t.levelId) ?? [];
    arr.push(t);
    thresholdsByLevel.set(t.levelId, arr);
  }

  // Bucket decisions per threshold (using level match)
  const buckets = new Map<string, AttributionDecision[]>();
  for (const d of decisions) {
    if (!d.decidedByLevelId) continue;
    const candidates = thresholdsByLevel.get(d.decidedByLevelId);
    if (!candidates || candidates.length === 0) continue;
    // Pick the most-restrictive applicable threshold (smallest deviationBpsMax)
    const target = [...candidates].sort((a, b) => {
      const va = a.deviationBpsMax ?? Number.POSITIVE_INFINITY;
      const vb = b.deviationBpsMax ?? Number.POSITIVE_INFINITY;
      return va - vb;
    })[0];
    const arr = buckets.get(target.id) ?? [];
    arr.push(d);
    buckets.set(target.id, arr);
  }

  for (const [thrId, items] of buckets) {
    const threshold = thresholds.find((t) => t.id === thrId);
    if (!threshold) continue;
    const max = threshold.deviationBpsMax;
    // Sumamos los DOS agregados:
    //   - sumAbsDev: magnitud de dispersión (para gating shouldRelax/Tighten)
    //   - sumSignedDev: bias direccional (para auditoría/rationale)
    // La versión previa sólo agregaba signed → cartera con drift simétrico
    // (+10/-10) colapsaba a meanDev=0 y `Math.abs(0)` no disparaba relax,
    // dependiendo únicamente de pctAtLimit como red de seguridad.
    let sumAbsDev = 0;
    let sumSignedDev = 0;
    let atLimit = 0;
    let escalated = 0;
    for (const d of items) {
      const dev = d.routingMetadata.deviationBps ?? 0;
      sumAbsDev    += Math.abs(dev);
      sumSignedDev += dev;
      const absDev = Math.abs(dev);
      const limit = max !== null ? max * 0.8 : 8;
      if (absDev >= limit) atLimit += 1;
      if (d.decision === 'escalated') escalated += 1;
    }
    out.set(thrId, {
      count:               items.length,
      meanAbsDeviationBps: items.length > 0 ? sumAbsDev    / items.length : 0,
      signedBiasBps:       items.length > 0 ? sumSignedDev / items.length : 0,
      pctAtLimit:          items.length > 0 ? atLimit      / items.length : 0,
      escalationRate:      items.length > 0 ? escalated    / items.length : 0,
    });
  }
  return out;
}

function decideAdjustment(
  current: AttributionThreshold,
  stats: ThresholdDecisionStats,
  opts: Required<Omit<RecalibratorOptions, 'now'>>,
): {
  proposedDeviationBpsMax: number | null;
  proposedRarocPpMin: number | null;
  proposedVolumeEurMax: number | null;
  driftSeverity: 'ok' | 'warning' | 'breached';
  shouldEmit: boolean;
  notes?: string;
} {
  // `meanAbsDeviationBps` es la señal correcta para el gating: refleja
  // dispersión real, no se cancela con drift simétrico. La versión
  // previa hacía `Math.abs(stats.meanDeviationBps)` (abs DESPUÉS de la
  // media signed), que colapsa a 0 con cartera +10/-10 bps.
  const meanAbs = stats.meanAbsDeviationBps;

  const shouldRelax =
    meanAbs >= opts.meanDriftRelaxBps ||
    stats.pctAtLimit >= opts.pctAtLimitRelax ||
    stats.escalationRate >= opts.escalationRateRelax;

  // Tighten condition: cero drift, cero at limit, cero escalation y N≥sample
  const shouldTighten =
    !shouldRelax &&
    stats.pctAtLimit < 0.05 &&
    stats.escalationRate < 0.05 &&
    meanAbs < 1;

  if (!shouldRelax && !shouldTighten) {
    return {
      proposedDeviationBpsMax: null,
      proposedRarocPpMin: null,
      proposedVolumeEurMax: null,
      driftSeverity: 'ok',
      shouldEmit: false,
    };
  }

  let driftSeverity: 'ok' | 'warning' | 'breached' = 'ok';
  if (shouldRelax) {
    if (
      stats.escalationRate >= opts.escalationRateRelax * 1.5 ||
      stats.pctAtLimit    >= opts.pctAtLimitRelax    * 1.5 ||
      meanAbs             >= opts.meanDriftRelaxBps  * 2
    ) {
      driftSeverity = 'breached';
    } else {
      driftSeverity = 'warning';
    }
  }

  let proposedDev: number | null = null;
  let proposedRaroc: number | null = null;
  let proposedVol: number | null = null;
  let notes = '';

  if (shouldRelax) {
    if (current.deviationBpsMax !== null) {
      proposedDev = +(current.deviationBpsMax * (1 + opts.relaxStepRatio)).toFixed(1);
    }
    if (current.rarocPpMin !== null) {
      // raroc tighter == lower → relajar = bajar el mínimo
      proposedRaroc = +(current.rarocPpMin * (1 - opts.relaxStepRatio)).toFixed(2);
    }
    if (current.volumeEurMax !== null) {
      proposedVol = Math.round(current.volumeEurMax * (1 + opts.relaxStepRatio));
    }
    notes = `Relax suggested: meanDrift=${meanAbs.toFixed(1)} bps, atLimit=${(stats.pctAtLimit*100).toFixed(0)}%, escalation=${(stats.escalationRate*100).toFixed(0)}%`;
  } else if (shouldTighten) {
    if (current.deviationBpsMax !== null) {
      proposedDev = +(current.deviationBpsMax * (1 - opts.tightenStepRatio)).toFixed(1);
    }
    if (current.rarocPpMin !== null) {
      proposedRaroc = +(current.rarocPpMin * (1 + opts.tightenStepRatio)).toFixed(2);
    }
    if (current.volumeEurMax !== null) {
      proposedVol = Math.round(current.volumeEurMax * (1 - opts.tightenStepRatio));
    }
    notes = 'Tighten suggested: zero drift + zero at-limit + zero escalation';
  }

  return {
    proposedDeviationBpsMax: proposedDev,
    proposedRarocPpMin:      proposedRaroc,
    proposedVolumeEurMax:    proposedVol,
    driftSeverity,
    shouldEmit: true,
    notes,
  };
}

export interface ProposeInput {
  entityId: string;
  thresholds: AttributionThreshold[];
  decisions: AttributionDecision[];
  // levels disponibles solo para validación cruzada en tests; el
  // recalibrator no necesita el árbol jerárquico.
  levels?: AttributionLevel[];
  options?: RecalibratorOptions;
}

export type ProposedRecalibration = Omit<
  ThresholdRecalibration,
  'id' | 'status' | 'decidedAt' | 'decidedByUser' | 'reason'
> & {
  status: 'pending';
};

export function proposeThresholdAdjustments(input: ProposeInput): ProposedRecalibration[] {
  const opts = { ...DEFAULTS, ...(input.options ?? {}) };
  const stats = statsByThreshold(input.decisions, input.thresholds);
  const now = (input.options?.now?.() ?? new Date()).toISOString();

  const out: ProposedRecalibration[] = [];
  for (const threshold of input.thresholds) {
    if (!threshold.isActive) continue;
    const s = stats.get(threshold.id);
    if (!s) continue;
    if (s.count < opts.minSampleSize) continue;

    const decision = decideAdjustment(threshold, s, opts);
    if (!decision.shouldEmit) continue;

    const rationale: ThresholdRecalibrationRationale = {
      windowDays:           opts.windowDays,
      decisionsCount:       s.count,
      // `meanDeviationBps` (legacy field) preserva el bias direccional
      // signed para que un Risk_Manager pueda ver si la cartera tiene
      // sesgo además de dispersión. Útil para reporting, no para gating.
      meanDeviationBps:     +s.signedBiasBps.toFixed(2),
      // `meanAbsDeviationBps` es la métrica que disparó el gating —
      // explicable a auditoría sin ambigüedad ("la dispersión media fue
      // X bps, superó el threshold Y bps").
      meanAbsDeviationBps:  +s.meanAbsDeviationBps.toFixed(2),
      pctAtLimit:           +s.pctAtLimit.toFixed(4),
      escalationRate:       +s.escalationRate.toFixed(4),
      driftSeverity:        decision.driftSeverity,
      notes:                decision.notes,
    };

    out.push({
      entityId:                input.entityId,
      thresholdId:             threshold.id,
      proposedDeviationBpsMax: decision.proposedDeviationBpsMax,
      proposedRarocPpMin:      decision.proposedRarocPpMin,
      proposedVolumeEurMax:    decision.proposedVolumeEurMax,
      rationale,
      status:                  'pending',
      proposedAt:              now,
    });
  }
  return out;
}

// Internals exposed for tests
export const __recalibratorInternals = { statsByThreshold, decideAdjustment, DEFAULTS };
