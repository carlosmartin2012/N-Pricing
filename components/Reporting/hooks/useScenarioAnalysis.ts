import { useMemo } from 'react';
import type { Transaction, LiquidityCurvePoint } from '../../../types';
import type { PortfolioMetrics, ScenarioMetrics, LcrHistoryPoint } from '../reportingTypes';

interface UseScenarioAnalysisInput {
  scenarioDeal: Transaction;
  portfolioMetrics: PortfolioMetrics;
  liquidityCurvePoints: LiquidityCurvePoint[];
}

interface UseScenarioAnalysisResult {
  metrics: ScenarioMetrics;
  lcrHistory: LcrHistoryPoint[];
}

/**
 * Computes scenario-level metrics (LCR/NSFR impact, LP value, CLC, WLP)
 * for a single deal overlaid on the portfolio, plus a monthly LCR simulation history.
 */
export function useScenarioAnalysis({
  scenarioDeal,
  portfolioMetrics,
  liquidityCurvePoints,
}: UseScenarioAnalysisInput): UseScenarioAnalysisResult {
  const metrics = useMemo<ScenarioMetrics>(() => {
    const amount = Number(scenarioDeal.amount) || 0;
    const isAsset = scenarioDeal.category === 'Asset';
    const isLiability = scenarioDeal.category === 'Liability';
    const isOffBalance = scenarioDeal.category === 'Off-Balance';

    let dealOutflow = 0;
    if (isLiability) {
      dealOutflow = amount * ((scenarioDeal.lcrOutflowPct || 25) / 100);
    } else if (isOffBalance && scenarioDeal.isCommitted) {
      dealOutflow = amount * ((scenarioDeal.lcrOutflowPct || 10) / 100);
    }

    const finalHQLA =
      isAsset && scenarioDeal.riskWeight <= 20 ? portfolioMetrics.hqla + amount : portfolioMetrics.hqla;
    const finalOutflows = (portfolioMetrics.netOutflows || 1) + dealOutflow;
    const rawLcr = (finalHQLA / finalOutflows) * 100;
    const lcr = Number.isFinite(rawLcr) ? rawLcr : 0;

    let dealASF = 0;
    let dealRSF = 0;
    if (isLiability) dealASF = amount * (scenarioDeal.durationMonths >= 12 ? 0.95 : 0.5);
    else if (isAsset) dealRSF = amount * (scenarioDeal.durationMonths >= 12 ? 0.85 : 0.5);

    const rawNsfr = ((portfolioMetrics.asf + dealASF) / ((portfolioMetrics.rsf || 1) + dealRSF)) * 100;
    const nsfr = Number.isFinite(rawNsfr) ? rawNsfr : 0;

    const duration = scenarioDeal.durationMonths || 1;
    const hasLPCurve = liquidityCurvePoints.length > 0;
    const lastPoint = hasLPCurve ? liquidityCurvePoints[liquidityCurvePoints.length - 1] : undefined;
    const indexedPoint = hasLPCurve
      ? liquidityCurvePoints[Math.min(Math.floor(duration / 12), liquidityCurvePoints.length - 1)]
      : undefined;
    const lpValue =
      !hasLPCurve
        ? 0
        : duration <= 1
          ? (liquidityCurvePoints[0]?.termLP ?? 0)
          : duration >= 60
            ? (lastPoint?.termLP ?? 0)
            : (indexedPoint?.termLP ?? 0);

    return {
      lcr,
      nsfr,
      lpValue,
      clc: (scenarioDeal.lcrOutflowPct || 0) * 0.35,
      wlp: (amount / 1000000) * 1.2,
      impactHQLA: finalHQLA - portfolioMetrics.hqla,
      impactOutflows: dealOutflow,
    };
  }, [scenarioDeal, portfolioMetrics, liquidityCurvePoints]);

  const lcrHistory = useMemo<LcrHistoryPoint[]>(() => {
    const baseLcr = portfolioMetrics.lcr || 100;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((month, i) => {
      const seasonalAdj = Math.sin(i * 0.5) * 3; // seasonal variation
      return {
        date: month,
        lcr: baseLcr + seasonalAdj,
        simulated: metrics.lcr + seasonalAdj,
      };
    });
  }, [portfolioMetrics.lcr, metrics.lcr]);

  return { metrics, lcrHistory };
}
