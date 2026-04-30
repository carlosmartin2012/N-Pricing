/**
 * Ola 9 Bloque C — Budget reconciliation matcher (puro).
 *
 * Cruza:
 *   - Supuestos del budget (BudgetAssumption[] del adapter ALQUID)
 *   - Realizado del periodo (RealizedAggregate[] que el caller agrupa
 *     desde pricing_snapshots y deals booked).
 *
 * Output por (segment × productType × currency) coincidente:
 *   - Δrate (bps): realizedRateBps − budgetedRateBps
 *   - Δvolume (€ + %): realizedVolumeEur − budgetedVolumeEur
 *   - status: 'on_track' | 'over_budget_rate' | 'under_budget_rate' |
 *             'over_budget_volume' | 'under_budget_volume'
 *
 * Pure: sin I/O, sin DB.
 */

import type { BudgetAssumption } from '../../integrations/types';

export interface RealizedAggregate {
  period: string;
  segment: string;
  productType: string;
  currency: string;
  realizedRateBps: number;       // weighted-average por volumen
  realizedVolumeEur: number;
  realizedRarocPp: number | null;
  dealCount: number;
}

export interface BudgetVarianceItem {
  period: string;
  segment: string;
  productType: string;
  currency: string;

  budgetedRateBps: number | null;
  realizedRateBps: number | null;
  diffRateBps: number | null;          // realized − budget

  budgetedVolumeEur: number | null;
  realizedVolumeEur: number | null;
  diffVolumeEur: number | null;
  diffVolumePct: number | null;        // (realized − budget) / budget

  budgetedRarocPp: number | null;
  realizedRarocPp: number | null;
  diffRarocPp: number | null;

  dealCount: number;
  presentInBudget: boolean;
  presentInRealized: boolean;
  status: BudgetVarianceStatus;
}

export type BudgetVarianceStatus =
  | 'on_track'                      // ambas tasas y volumen dentro de tolerancia
  | 'over_budget_rate'              // realized > budget en rate (cobramos más)
  | 'under_budget_rate'             // realized < budget en rate (cobramos menos)
  | 'over_budget_volume'            // volumen mayor que budget
  | 'under_budget_volume'           // volumen menor que budget
  | 'budget_only'                   // budget pero sin actividad realizada
  | 'realized_only';                // realizado sin línea de budget

export interface BudgetVarianceOptions {
  /** bps de tolerancia para rate considerado on-track. Default 5. */
  rateToleranceBps?: number;
  /** ratio de tolerancia para volumen on-track (0..1). Default 0.10 (±10%). */
  volumeTolerancePct?: number;
}

const DEFAULT_RATE_TOLERANCE = 5;
const DEFAULT_VOLUME_TOLERANCE = 0.10;

function key(s: { segment: string; productType: string; currency: string }): string {
  return `${s.segment}|${s.productType}|${s.currency}`;
}

/**
 * Reconciliación budget vs realizado. Idempotente — mismos inputs
 * producen el mismo array (mismo orden incluido).
 */
export function reconcileBudgetVsRealized(
  assumptions: BudgetAssumption[],
  realized: RealizedAggregate[],
  options: BudgetVarianceOptions = {},
): BudgetVarianceItem[] {
  const rateTol   = options.rateToleranceBps ?? DEFAULT_RATE_TOLERANCE;
  const volumeTol = options.volumeTolerancePct ?? DEFAULT_VOLUME_TOLERANCE;

  const period = assumptions[0]?.period ?? realized[0]?.period ?? 'unknown';
  const budgetByKey   = new Map(assumptions.map((a) => [key(a), a]));
  const realizedByKey = new Map(realized.map((r) => [key(r), r]));

  const allKeys = new Set<string>([...budgetByKey.keys(), ...realizedByKey.keys()]);
  const items: BudgetVarianceItem[] = [];

  for (const k of allKeys) {
    const b = budgetByKey.get(k) ?? null;
    const r = realizedByKey.get(k) ?? null;
    const [segment, productType, currency] = k.split('|');

    const budgetedRateBps   = b?.budgetedRateBps   ?? null;
    const budgetedVolumeEur = b?.budgetedVolumeEur ?? null;
    const budgetedRarocPp   = b?.budgetedRarocPp   ?? null;
    const realizedRateBps   = r?.realizedRateBps   ?? null;
    const realizedVolumeEur = r?.realizedVolumeEur ?? null;
    const realizedRarocPp   = r?.realizedRarocPp   ?? null;

    const diffRateBps =
      budgetedRateBps !== null && realizedRateBps !== null
        ? realizedRateBps - budgetedRateBps
        : null;

    const diffVolumeEur =
      budgetedVolumeEur !== null && realizedVolumeEur !== null
        ? realizedVolumeEur - budgetedVolumeEur
        : null;

    const diffVolumePct =
      diffVolumeEur !== null && budgetedVolumeEur !== null && budgetedVolumeEur !== 0
        ? diffVolumeEur / budgetedVolumeEur
        : null;

    const diffRarocPp =
      budgetedRarocPp !== null && realizedRarocPp !== null
        ? realizedRarocPp - budgetedRarocPp
        : null;

    const presentInBudget   = b !== null;
    const presentInRealized = r !== null;
    const status = classifyStatus({
      presentInBudget,
      presentInRealized,
      diffRateBps,
      diffVolumePct,
      rateToleranceBps:   rateTol,
      volumeTolerancePct: volumeTol,
    });

    items.push({
      period,
      segment,
      productType,
      currency,
      budgetedRateBps,
      realizedRateBps,
      diffRateBps,
      budgetedVolumeEur,
      realizedVolumeEur,
      diffVolumeEur,
      diffVolumePct,
      budgetedRarocPp,
      realizedRarocPp,
      diffRarocPp,
      dealCount: r?.dealCount ?? 0,
      presentInBudget,
      presentInRealized,
      status,
    });
  }
  // Orden estable: segment → productType → currency
  return items.sort((a, b) =>
    a.segment.localeCompare(b.segment) ||
    a.productType.localeCompare(b.productType) ||
    a.currency.localeCompare(b.currency),
  );
}

interface ClassifyInput {
  presentInBudget: boolean;
  presentInRealized: boolean;
  diffRateBps: number | null;
  diffVolumePct: number | null;
  rateToleranceBps: number;
  volumeTolerancePct: number;
}

function classifyStatus(c: ClassifyInput): BudgetVarianceStatus {
  if (c.presentInBudget && !c.presentInRealized) return 'budget_only';
  if (!c.presentInBudget && c.presentInRealized) return 'realized_only';

  if (c.diffRateBps !== null && Math.abs(c.diffRateBps) > c.rateToleranceBps) {
    return c.diffRateBps > 0 ? 'over_budget_rate' : 'under_budget_rate';
  }
  if (c.diffVolumePct !== null && Math.abs(c.diffVolumePct) > c.volumeTolerancePct) {
    return c.diffVolumePct > 0 ? 'over_budget_volume' : 'under_budget_volume';
  }
  return 'on_track';
}

export interface BudgetVarianceSummary {
  period: string;
  total: number;
  onTrack: number;
  overRate: number;
  underRate: number;
  overVolume: number;
  underVolume: number;
  budgetOnly: number;
  realizedOnly: number;
  totalBudgetedVolumeEur: number;
  totalRealizedVolumeEur: number;
  weightedAvgDiffRateBps: number;       // promedio ponderado por realized volume
}

export function summarizeBudgetVariance(items: BudgetVarianceItem[]): BudgetVarianceSummary {
  const period = items[0]?.period ?? 'unknown';
  const summary: BudgetVarianceSummary = {
    period,
    total:                  items.length,
    onTrack:                0,
    overRate:               0,
    underRate:              0,
    overVolume:             0,
    underVolume:            0,
    budgetOnly:             0,
    realizedOnly:           0,
    totalBudgetedVolumeEur: 0,
    totalRealizedVolumeEur: 0,
    weightedAvgDiffRateBps: 0,
  };
  let weightSum = 0;
  let weightedDiffSum = 0;
  for (const item of items) {
    switch (item.status) {
      case 'on_track':           summary.onTrack++;      break;
      case 'over_budget_rate':   summary.overRate++;     break;
      case 'under_budget_rate':  summary.underRate++;    break;
      case 'over_budget_volume': summary.overVolume++;   break;
      case 'under_budget_volume':summary.underVolume++;  break;
      case 'budget_only':        summary.budgetOnly++;   break;
      case 'realized_only':      summary.realizedOnly++; break;
    }
    summary.totalBudgetedVolumeEur += item.budgetedVolumeEur ?? 0;
    summary.totalRealizedVolumeEur += item.realizedVolumeEur ?? 0;
    if (item.diffRateBps !== null && item.realizedVolumeEur !== null && item.realizedVolumeEur > 0) {
      weightedDiffSum += item.diffRateBps * item.realizedVolumeEur;
      weightSum       += item.realizedVolumeEur;
    }
  }
  summary.weightedAvgDiffRateBps = weightSum > 0 ? weightedDiffSum / weightSum : 0;
  return summary;
}
