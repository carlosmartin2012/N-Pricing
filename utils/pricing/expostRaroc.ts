import type { Transaction, FTPResult } from '../../types';

/**
 * Ex-post RAROC engine — compares expected vs realized RAROC
 * per spec §M7 (Portfolio Analytics & Vintage).
 *
 * Uses portfolio snapshots and realized performance data to
 * identify systematic underpricing and attribute P&L drift.
 */

export interface RealizedPerformance {
  /** Deal identifier */
  dealId: string;
  /** Observation period end (ISO date) */
  asOfDate: string;
  /** Actually earned gross revenue over the period (€) */
  realizedRevenue: number;
  /** Actually incurred credit losses over the period (€) */
  realizedCreditLosses: number;
  /** Actual cost of funds over the period (€) */
  realizedCostOfFunds: number;
  /** Actual operational cost over the period (€) */
  realizedOperatingCost: number;
  /** Capital allocated to the deal over the period (avg €) */
  allocatedCapital: number;
  /** Risk-free rate used for capital income (% annual) */
  riskFreeRate: number;
  /** Observation period in months (for annualization) */
  observationMonths: number;
}

export interface ExpectedRaroc {
  dealId: string;
  /** RAROC expected at origination (% annual) */
  expectedRaroc: number;
  /** Expected gross revenue at origination (€ annual) */
  expectedRevenue: number;
  /** Expected credit losses at origination (€ annual) */
  expectedEcl: number;
  /** Expected cost of funds at origination (€ annual) */
  expectedCof: number;
  /** Expected operating cost at origination (€ annual) */
  expectedOpCost: number;
  /** Expected allocated capital at origination (€) */
  expectedCapital: number;
}

export interface ExPostComparisonResult {
  dealId: string;
  expected: ExpectedRaroc;
  realized: {
    annualizedRaroc: number;
    revenueAnnualized: number;
    creditLossesAnnualized: number;
    cofAnnualized: number;
    opCostAnnualized: number;
  };
  /** Delta: realized - expected (% points) */
  rarocDelta: number;
  /** True if deal is materially underpriced */
  isUnderpriced: boolean;
  /** P&L attribution breakdown */
  attribution: {
    revenueContribution: number;      // Δ (revenue)
    creditLossContribution: number;   // Δ (ecl)
    cofContribution: number;          // Δ (cof)
    opCostContribution: number;       // Δ (opcost)
    capitalContribution: number;      // Δ (capital allocation)
  };
}

/**
 * Extract expected RAROC inputs from a stored FTPResult snapshot.
 * The pricing_snapshot JSONB contains the full FTPResult; we reconstruct
 * the components needed for the comparison.
 */
export function extractExpectedFromSnapshot(
  dealId: string,
  deal: Pick<Transaction, 'amount' | 'marginTarget' | 'feeIncome' | 'operationalCostBps'>,
  snapshot: FTPResult,
): ExpectedRaroc {
  const ead = deal.amount;
  const interestSpread = deal.marginTarget / 100;
  const cofRate = snapshot.totalFTP / 100;
  const opCostRate = deal.operationalCostBps / 10000;

  const expectedRevenue = ead * interestSpread + (deal.feeIncome ?? 0);
  const expectedCof = ead * cofRate;
  const expectedOpCost = ead * opCostRate;
  const expectedEcl = ead * (snapshot.regulatoryCost / 100);
  // Capital allocation proxy: use effective capital charge times EAD / (targetROE - riskFreeRate)
  const expectedCapital = ead * (snapshot.capitalCharge > 0 ? snapshot.capitalCharge / 100 : 0) * 10;

  return {
    dealId,
    expectedRaroc: snapshot.raroc,
    expectedRevenue,
    expectedEcl,
    expectedCof,
    expectedOpCost,
    expectedCapital,
  };
}

/**
 * Compute realized RAROC from observed performance, annualized.
 */
export function calculateRealizedRaroc(performance: RealizedPerformance): {
  annualizedRaroc: number;
  revenueAnnualized: number;
  creditLossesAnnualized: number;
  cofAnnualized: number;
  opCostAnnualized: number;
} {
  const months = Math.max(1, performance.observationMonths);
  const annualFactor = 12 / months;

  const revenueAnnualized = performance.realizedRevenue * annualFactor;
  const creditLossesAnnualized = performance.realizedCreditLosses * annualFactor;
  const cofAnnualized = performance.realizedCostOfFunds * annualFactor;
  const opCostAnnualized = performance.realizedOperatingCost * annualFactor;
  const capitalIncomeAnnualized =
    performance.allocatedCapital * (performance.riskFreeRate / 100);

  const riskAdjustedReturn =
    revenueAnnualized -
    cofAnnualized -
    creditLossesAnnualized -
    opCostAnnualized +
    capitalIncomeAnnualized;

  const annualizedRaroc =
    performance.allocatedCapital > 0
      ? (riskAdjustedReturn / performance.allocatedCapital) * 100
      : 0;

  return {
    annualizedRaroc,
    revenueAnnualized,
    creditLossesAnnualized,
    cofAnnualized,
    opCostAnnualized,
  };
}

/**
 * Compare expected vs realized RAROC and produce a full attribution.
 */
export function compareExpectedVsRealized(
  expected: ExpectedRaroc,
  performance: RealizedPerformance,
  underpricingThreshold: number = 2.0, // % points
): ExPostComparisonResult {
  const realized = calculateRealizedRaroc(performance);
  const rarocDelta = realized.annualizedRaroc - expected.expectedRaroc;
  const isUnderpriced = rarocDelta < -underpricingThreshold;

  // P&L attribution: delta in each component vs expectation
  const attribution = {
    revenueContribution: realized.revenueAnnualized - expected.expectedRevenue,
    creditLossContribution: -(realized.creditLossesAnnualized - expected.expectedEcl),
    cofContribution: -(realized.cofAnnualized - expected.expectedCof),
    opCostContribution: -(realized.opCostAnnualized - expected.expectedOpCost),
    capitalContribution: performance.allocatedCapital - expected.expectedCapital,
  };

  return {
    dealId: expected.dealId,
    expected,
    realized,
    rarocDelta,
    isUnderpriced,
    attribution,
  };
}

/**
 * Detect systematic underpricing in a portfolio.
 * A deal is "systematically underpriced" if its rarocDelta is consistently
 * negative across multiple observation periods.
 */
export interface UnderpricingAlert {
  dealId: string;
  averageDelta: number;
  observationCount: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  dominantDriver: 'REVENUE' | 'CREDIT_LOSS' | 'COF' | 'OPCOST' | 'CAPITAL';
}

export function detectSystematicUnderpricing(
  comparisons: ExPostComparisonResult[],
  minObservations: number = 3,
): UnderpricingAlert[] {
  // Group by dealId
  const byDeal = new Map<string, ExPostComparisonResult[]>();
  for (const c of comparisons) {
    const list = byDeal.get(c.dealId) ?? [];
    list.push(c);
    byDeal.set(c.dealId, list);
  }

  const alerts: UnderpricingAlert[] = [];

  for (const [dealId, obs] of byDeal.entries()) {
    if (obs.length < minObservations) continue;

    const underpricedCount = obs.filter(o => o.isUnderpriced).length;
    if (underpricedCount < obs.length * 0.5) continue; // Not systematic

    const averageDelta =
      obs.reduce((s, o) => s + o.rarocDelta, 0) / obs.length;

    let severity: 'LOW' | 'MEDIUM' | 'HIGH';
    if (averageDelta < -10) severity = 'HIGH';
    else if (averageDelta < -5) severity = 'MEDIUM';
    else severity = 'LOW';

    // Dominant driver: average attribution component with largest negative impact
    const avgAttr = {
      REVENUE: obs.reduce((s, o) => s + o.attribution.revenueContribution, 0) / obs.length,
      CREDIT_LOSS: obs.reduce((s, o) => s + o.attribution.creditLossContribution, 0) / obs.length,
      COF: obs.reduce((s, o) => s + o.attribution.cofContribution, 0) / obs.length,
      OPCOST: obs.reduce((s, o) => s + o.attribution.opCostContribution, 0) / obs.length,
      CAPITAL: obs.reduce((s, o) => s + o.attribution.capitalContribution, 0) / obs.length,
    };

    const entries = Object.entries(avgAttr) as Array<['REVENUE' | 'CREDIT_LOSS' | 'COF' | 'OPCOST' | 'CAPITAL', number]>;
    if (entries.length === 0) continue;
    entries.sort((a, b) => a[1] - b[1]); // Most negative first
    const dominantDriver = entries[0][0];

    alerts.push({
      dealId,
      averageDelta,
      observationCount: obs.length,
      severity,
      dominantDriver,
    });
  }

  // Sort alerts by severity (HIGH > MEDIUM > LOW) then average delta
  const severityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  alerts.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return a.averageDelta - b.averageDelta;
  });

  return alerts;
}
