import type { Transaction } from '../types';
import type { ExposureLimit, LimitCheckResult, LimitStatus, LimitUtilizationSummary } from '../types/exposureLimits';

const APPROACHING_THRESHOLD = 0.8; // 80% utilization triggers "approaching"

function getDimensionValue(deal: Transaction, dimension: ExposureLimit['dimension']): string {
  switch (dimension) {
    case 'client': return deal.clientId;
    case 'sector': return deal.clientType;
    case 'product': return deal.productType;
    case 'currency': return deal.currency;
    case 'business_unit': return deal.businessUnit;
    case 'country': return '';
  }
}

/**
 * Check a single deal against all relevant limits.
 */
export function checkDealLimits(
  deal: Transaction,
  portfolio: Transaction[],
  limits: ExposureLimit[],
): LimitCheckResult[] {
  const booked = portfolio.filter((d) => d.status === 'Booked' || d.status === 'Approved');

  return limits
    .filter((limit) => limit.isActive)
    .filter((limit) => getDimensionValue(deal, limit.dimension) === limit.dimensionValue)
    .map((limit) => {
      const currentExposure = booked
        .filter((d) => getDimensionValue(d, limit.dimension) === limit.dimensionValue)
        .reduce((sum, d) => sum + (d.amount || 0), 0);

      const projectedExposure = currentExposure + (deal.amount || 0);
      const utilizationPct = (projectedExposure / limit.hardLimitAmount) * 100;
      const headroom = limit.hardLimitAmount - projectedExposure;

      let status: LimitStatus = 'within';
      if (projectedExposure >= limit.hardLimitAmount) status = 'breached';
      else if (projectedExposure >= limit.softLimitAmount || utilizationPct >= APPROACHING_THRESHOLD * 100) status = 'approaching';

      return {
        limit,
        currentUtilization: projectedExposure,
        utilizationPct,
        status,
        headroom,
        message: status === 'breached'
          ? `Hard limit breached: ${limit.name} (${utilizationPct.toFixed(0)}%)`
          : status === 'approaching'
          ? `Approaching limit: ${limit.name} (${utilizationPct.toFixed(0)}%)`
          : `Within limit: ${limit.name} (${utilizationPct.toFixed(0)}%)`,
      };
    });
}

/**
 * Compute utilization summary across all limits.
 */
export function computeLimitUtilization(
  portfolio: Transaction[],
  limits: ExposureLimit[],
): LimitUtilizationSummary {
  const booked = portfolio.filter((d) => d.status === 'Booked' || d.status === 'Approved');

  const results: LimitCheckResult[] = limits
    .filter((l) => l.isActive)
    .map((limit) => {
      const currentExposure = booked
        .filter((d) => getDimensionValue(d, limit.dimension) === limit.dimensionValue)
        .reduce((sum, d) => sum + (d.amount || 0), 0);

      const utilizationPct = (currentExposure / limit.hardLimitAmount) * 100;
      const headroom = limit.hardLimitAmount - currentExposure;

      let status: LimitStatus = 'within';
      if (currentExposure >= limit.hardLimitAmount) status = 'breached';
      else if (currentExposure >= limit.softLimitAmount) status = 'approaching';

      return {
        limit,
        currentUtilization: currentExposure,
        utilizationPct,
        status,
        headroom,
        message: `${limit.name}: ${utilizationPct.toFixed(0)}% utilized`,
      };
    });

  return {
    totalLimits: results.length,
    within: results.filter((r) => r.status === 'within').length,
    approaching: results.filter((r) => r.status === 'approaching').length,
    breached: results.filter((r) => r.status === 'breached').length,
    results,
  };
}
