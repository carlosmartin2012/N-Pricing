import { useMemo } from 'react';
import type { Transaction, BusinessUnit } from '../../../types';
import type {
  PortfolioMetrics,
  PortfolioBusinessUnitSummary,
} from '../reportingTypes';

interface UsePortfolioMetricsInput {
  deals: Transaction[];
  businessUnits: BusinessUnit[];
}

interface UsePortfolioMetricsResult {
  portfolioMetrics: PortfolioMetrics;
  portfolioByBU: PortfolioBusinessUnitSummary[];
}

/**
 * Computes portfolio-level LCR/NSFR metrics and business-unit breakdowns
 * from booked/approved deals.
 */
export function usePortfolioMetrics({
  deals,
  businessUnits,
}: UsePortfolioMetricsInput): UsePortfolioMetricsResult {
  const portfolioMetrics = useMemo<PortfolioMetrics>(() => {
    const bookedDeals = deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');
    let totalHQLA = 0;
    let totalOutflows = 0;
    let totalASF = 0;
    let totalRSF = 0;
    let totalAssetVolume = 0;
    let totalLiabilityVolume = 0;

    bookedDeals.forEach((deal) => {
      const amt = deal.amount || 0;
      const isAsset = deal.category === 'Asset';
      const isLiability = deal.category === 'Liability';
      const isOffBalance = deal.category === 'Off-Balance';

      if (isAsset) totalAssetVolume += amt;
      if (isLiability) totalLiabilityVolume += amt;

      // LCR: outflows from liabilities and committed facilities
      if (isLiability) {
        totalOutflows += amt * ((deal.lcrOutflowPct || 25) / 100);
        // ASF contribution
        if (deal.durationMonths >= 12) totalASF += amt * 0.95;
        else if (deal.depositStability === 'Stable') totalASF += amt * 0.95;
        else if (deal.depositStability === 'Semi_Stable') totalASF += amt * 0.9;
        else totalASF += amt * 0.5;
      } else if (isOffBalance && deal.isCommitted) {
        totalOutflows += amt * ((deal.lcrOutflowPct || 10) / 100);
      }

      // HQLA: high quality assets contribute to buffer
      if (isAsset && deal.riskWeight <= 20) {
        totalHQLA += amt * (1 - (deal.riskWeight / 100) * 0.15); // L1/L2 HQLA haircut
      }

      // RSF for assets
      if (isAsset) {
        if (deal.durationMonths >= 12) totalRSF += amt * (deal.riskWeight >= 50 ? 0.85 : 0.65);
        else totalRSF += amt * 0.5;
      }
    });

    // Ensure non-zero denominators
    const safeOutflows = totalOutflows || 1;
    const safeRSF = totalRSF || 1;

    return {
      hqla: totalHQLA,
      netOutflows: totalOutflows,
      asf: totalASF,
      rsf: totalRSF,
      lcr: (totalHQLA / safeOutflows) * 100,
      nsfr: (totalASF / safeRSF) * 100,
      totalAssetVolume,
      totalLiabilityVolume,
      dealCount: bookedDeals.length,
    };
  }, [deals]);

  const portfolioByBU = useMemo<PortfolioBusinessUnitSummary[]>(() => {
    const byBU: Record<string, { volume: number; count: number; avgMargin: number }> = {};
    const bookedDeals = deals.filter((d) => d.status === 'Booked' || d.status === 'Approved');
    bookedDeals.forEach((deal) => {
      const bu = deal.businessUnit || 'Unknown';
      if (!byBU[bu]) byBU[bu] = { volume: 0, count: 0, avgMargin: 0 };
      byBU[bu].volume += deal.amount || 0;
      byBU[bu].count++;
      byBU[bu].avgMargin += deal.marginTarget || 0;
    });
    return Object.entries(byBU)
      .map(([bu, v]) => ({
        bu,
        buName: businessUnits.find((b) => b.id === bu)?.name || bu,
        volume: v.volume,
        count: v.count,
        avgMargin: v.count > 0 ? v.avgMargin / v.count : 0,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [deals, businessUnits]);

  return { portfolioMetrics, portfolioByBU };
}
