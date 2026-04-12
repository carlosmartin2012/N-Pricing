import type { Transaction, FTPResult } from '../../types';

/**
 * Portfolio Review Agent — spec §M11
 *
 * Analyzes a portfolio snapshot to detect:
 *   1. Underpricing clusters (groups of deals with below-hurdle RAROC)
 *   2. Repricing candidates (variable-rate deals near repricing window)
 *   3. Renegotiation candidates (deals with material headroom under hurdle)
 *
 * Output is structured and human-readable, suitable for committee dossiers
 * or grounding a Gemini narrative.
 */

export interface PortfolioDeal {
  deal: Transaction;
  result: FTPResult;
}

export interface ClusterDimension {
  /** Dimension key (e.g. 'productType', 'businessUnit') */
  key: string;
  /** Dimension value (e.g. 'LOAN_MORT', 'Corporate') */
  value: string;
}

export interface UnderpricingCluster {
  /** Cluster identifier (stable, derived from dimensions) */
  id: string;
  /** Dimensions that define this cluster */
  dimensions: ClusterDimension[];
  /** Number of deals in the cluster */
  dealCount: number;
  /** Total EAD in the cluster (€) */
  totalAmount: number;
  /** Average RAROC (%) */
  avgRaroc: number;
  /** Average margin target (%) */
  avgMargin: number;
  /** Hurdle rate for the cluster (% — usually max targetROE) */
  hurdleRate: number;
  /** Average delta vs hurdle (pp) */
  avgDelta: number;
  /** Severity: HIGH if avgDelta < -5, MEDIUM if < -2, LOW otherwise */
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Sample deal IDs for drilldown */
  sampleDealIds: string[];
}

export interface RepricingCandidate {
  dealId: string;
  productType: string;
  amount: number;
  currentMargin: number;
  suggestedMargin: number;
  expectedRarocUplift: number;
  repricingFreq: string;
  rationale: string;
}

export interface RenegotiationCandidate {
  dealId: string;
  productType: string;
  clientId: string;
  amount: number;
  currentRaroc: number;
  targetRaroc: number;
  marginHeadroomBps: number;
  reason: string;
}

export interface PortfolioReviewResult {
  asOfDate: string;
  dealsAnalyzed: number;
  totalPortfolioAmount: number;
  averagePortfolioRaroc: number;
  underpricingClusters: UnderpricingCluster[];
  repricingCandidates: RepricingCandidate[];
  renegotiationCandidates: RenegotiationCandidate[];
  summary: {
    underpricedDealCount: number;
    underpricedAmount: number;
    underpricedAmountPct: number;
    clustersDetected: number;
  };
}

/**
 * Cluster deals by up to 3 dimensions (productType, businessUnit, clientType)
 * and compute underpricing statistics per cluster.
 */
function buildClusterKey(deal: Transaction): string {
  return `${deal.productType}|${deal.businessUnit}|${deal.clientType}`;
}

function clusterDimensions(deal: Transaction): ClusterDimension[] {
  return [
    { key: 'productType', value: deal.productType },
    { key: 'businessUnit', value: deal.businessUnit },
    { key: 'clientType', value: deal.clientType },
  ];
}

/**
 * Detect underpricing clusters in the portfolio.
 * A cluster is "underpriced" if its average RAROC is below the hurdle rate
 * by more than the threshold.
 */
export function detectUnderpricingClusters(
  portfolio: PortfolioDeal[],
  underpricingThreshold: number = 2.0, // pp below hurdle
  minClusterSize: number = 3,
): UnderpricingCluster[] {
  const clusters = new Map<string, PortfolioDeal[]>();

  for (const pd of portfolio) {
    const key = buildClusterKey(pd.deal);
    const list = clusters.get(key) ?? [];
    list.push(pd);
    clusters.set(key, list);
  }

  const results: UnderpricingCluster[] = [];

  for (const [key, deals] of clusters.entries()) {
    if (deals.length === 0 || deals.length < minClusterSize) continue;

    const totalAmount = deals.reduce((s, pd) => s + pd.deal.amount, 0);
    if (totalAmount <= 0) continue;

    const rawWeightedRaroc =
      deals.reduce((s, pd) => s + pd.result.raroc * pd.deal.amount, 0) / totalAmount;
    const weightedRaroc = Number.isFinite(rawWeightedRaroc) ? rawWeightedRaroc : 0;
    const rawWeightedMargin =
      deals.reduce((s, pd) => s + pd.deal.marginTarget * pd.deal.amount, 0) / totalAmount;
    const weightedMargin = Number.isFinite(rawWeightedMargin) ? rawWeightedMargin : 0;
    const hurdleRate = Math.max(...deals.map((pd) => pd.deal.targetROE));
    const avgDelta = weightedRaroc - hurdleRate;

    if (avgDelta >= -underpricingThreshold) continue; // Not underpriced

    let severity: 'HIGH' | 'MEDIUM' | 'LOW';
    if (avgDelta < -5) severity = 'HIGH';
    else if (avgDelta < -2) severity = 'MEDIUM';
    else severity = 'LOW';

    const sampleDealIds = deals
      .filter((pd) => pd.deal.id != null)
      .slice(0, 5)
      .map((pd) => pd.deal.id!);

    results.push({
      id: key,
      dimensions: clusterDimensions(deals[0].deal),
      dealCount: deals.length,
      totalAmount,
      avgRaroc: weightedRaroc,
      avgMargin: weightedMargin,
      hurdleRate,
      avgDelta,
      severity,
      sampleDealIds,
    });
  }

  // Sort by severity then total amount (largest first)
  const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  results.sort((a, b) => {
    const s = severityOrder[a.severity] - severityOrder[b.severity];
    if (s !== 0) return s;
    return b.totalAmount - a.totalAmount;
  });

  return results;
}

/**
 * Identify deals that are candidates for repricing at their next repricing window.
 * Variable-rate deals (Daily/Monthly/Quarterly) with below-hurdle RAROC can be
 * repriced automatically; Fixed deals cannot.
 */
export function identifyRepricingCandidates(
  portfolio: PortfolioDeal[],
  underpricingThreshold: number = 2.0,
): RepricingCandidate[] {
  const candidates: RepricingCandidate[] = [];

  for (const pd of portfolio) {
    if (!pd.deal.id) continue;
    if (pd.deal.repricingFreq === 'Fixed') continue; // Cannot reprice

    const delta = pd.result.raroc - pd.deal.targetROE;
    if (delta >= -underpricingThreshold) continue;

    // Suggested margin uplift: close ~80% of the gap
    const uplift = Math.abs(delta) * 0.8 * 0.15; // rough mapping delta → margin pp
    const suggestedMargin = pd.deal.marginTarget + uplift;
    const expectedRarocUplift = Math.abs(delta) * 0.8;

    candidates.push({
      dealId: pd.deal.id,
      productType: pd.deal.productType,
      amount: pd.deal.amount,
      currentMargin: pd.deal.marginTarget,
      suggestedMargin,
      expectedRarocUplift,
      repricingFreq: pd.deal.repricingFreq,
      rationale:
        `Variable-rate ${pd.deal.repricingFreq.toLowerCase()} deal, ` +
        `${(-delta).toFixed(2)}pp below hurdle (${pd.deal.targetROE}%). ` +
        `Suggest +${(uplift * 100).toFixed(0)}bps at next repricing.`,
    });
  }

  // Sort by amount × gap (biggest impact first)
  candidates.sort((a, b) => {
    const impactA = a.amount * a.expectedRarocUplift;
    const impactB = b.amount * b.expectedRarocUplift;
    return impactB - impactA;
  });

  return candidates;
}

/**
 * Identify deals that are candidates for proactive renegotiation.
 * These are deals where:
 *   - Current RAROC is materially below hurdle
 *   - Amount is large enough to justify renegotiation cost
 *   - Deal has significant remaining duration
 */
export function identifyRenegotiationCandidates(
  portfolio: PortfolioDeal[],
  minAmount: number = 500_000,
  minRemainingMonths: number = 12,
): RenegotiationCandidate[] {
  const candidates: RenegotiationCandidate[] = [];

  for (const pd of portfolio) {
    if (!pd.deal.id) continue;
    if (pd.deal.amount < minAmount) continue;
    if (pd.deal.durationMonths < minRemainingMonths) continue;

    const gap = pd.deal.targetROE - pd.result.raroc;
    if (gap < 3) continue; // Not worth renegotiating

    // Required margin uplift to close the gap
    const marginHeadroomBps = gap * 15; // rough proxy: 1pp RAROC ≈ 15bps margin

    candidates.push({
      dealId: pd.deal.id,
      productType: pd.deal.productType,
      clientId: pd.deal.clientId,
      amount: pd.deal.amount,
      currentRaroc: pd.result.raroc,
      targetRaroc: pd.deal.targetROE,
      marginHeadroomBps,
      reason:
        `Large ${pd.deal.productType} exposure ${(pd.deal.amount / 1000).toFixed(0)}k€, ` +
        `${gap.toFixed(1)}pp below hurdle. ` +
        `${pd.deal.durationMonths}M remaining. Consider proactive renegotiation.`,
    });
  }

  candidates.sort((a, b) => b.amount * b.marginHeadroomBps - a.amount * a.marginHeadroomBps);
  return candidates;
}

/**
 * Top-level portfolio review — runs all detectors and returns a consolidated report.
 */
export function runPortfolioReview(
  portfolio: PortfolioDeal[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
): PortfolioReviewResult {
  const dealsAnalyzed = portfolio.length;
  const totalPortfolioAmount = portfolio.reduce((s, pd) => s + pd.deal.amount, 0);
  const averagePortfolioRaroc =
    totalPortfolioAmount > 0
      ? portfolio.reduce((s, pd) => s + pd.result.raroc * pd.deal.amount, 0) /
        totalPortfolioAmount
      : 0;

  const underpricingClusters = detectUnderpricingClusters(portfolio);
  const repricingCandidates = identifyRepricingCandidates(portfolio);
  const renegotiationCandidates = identifyRenegotiationCandidates(portfolio);

  // Summary stats
  const underpricedDeals = portfolio.filter(
    (pd) => pd.result.raroc < pd.deal.targetROE - 2,
  );
  const underpricedAmount = underpricedDeals.reduce((s, pd) => s + pd.deal.amount, 0);

  return {
    asOfDate,
    dealsAnalyzed,
    totalPortfolioAmount,
    averagePortfolioRaroc,
    underpricingClusters,
    repricingCandidates,
    renegotiationCandidates,
    summary: {
      underpricedDealCount: underpricedDeals.length,
      underpricedAmount,
      underpricedAmountPct:
        totalPortfolioAmount > 0 ? (underpricedAmount / totalPortfolioAmount) * 100 : 0,
      clustersDetected: underpricingClusters.length,
    },
  };
}

/**
 * Build a Gemini prompt that narrates the portfolio review result.
 * Used by the AI layer to generate a human-friendly executive summary.
 */
export function buildPortfolioReviewPrompt(
  result: PortfolioReviewResult,
  language: 'es' | 'en' = 'es',
): string {
  if (language === 'es') {
    return `Analiza este informe de revisión de cartera y genera un resumen ejecutivo en 3 bullets.
Destaca los clusters de underpricing más severos, cuantifica el impacto en € y propone 2-3 acciones concretas.

Datos:
- Fecha: ${result.asOfDate}
- Deals analizados: ${result.dealsAnalyzed}
- Importe total cartera: ${result.totalPortfolioAmount.toLocaleString()}€
- RAROC medio cartera: ${result.averagePortfolioRaroc.toFixed(2)}%
- Deals infra-preciados: ${result.summary.underpricedDealCount} (${result.summary.underpricedAmountPct.toFixed(1)}%)
- Clusters detectados: ${result.summary.clustersDetected}

Top clusters underpricing: ${JSON.stringify(result.underpricingClusters.slice(0, 5), null, 2)}

Top candidatos repricing: ${JSON.stringify(result.repricingCandidates.slice(0, 5), null, 2)}

Responde en español con formato markdown.`;
  }

  return `Analyze this portfolio review report and generate a 3-bullet executive summary.
Highlight the most severe underpricing clusters, quantify the € impact, and propose 2-3 concrete actions.

Data:
- Date: ${result.asOfDate}
- Deals analyzed: ${result.dealsAnalyzed}
- Total portfolio amount: €${result.totalPortfolioAmount.toLocaleString()}
- Average portfolio RAROC: ${result.averagePortfolioRaroc.toFixed(2)}%
- Underpriced deals: ${result.summary.underpricedDealCount} (${result.summary.underpricedAmountPct.toFixed(1)}%)
- Clusters detected: ${result.summary.clustersDetected}

Top underpricing clusters: ${JSON.stringify(result.underpricingClusters.slice(0, 5), null, 2)}

Top repricing candidates: ${JSON.stringify(result.repricingCandidates.slice(0, 5), null, 2)}

Respond in English with markdown format.`;
}
