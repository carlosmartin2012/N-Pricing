import { MOCK_YIELD_CURVE } from './utils/seedData';
import type { Transaction, YieldCurvePoint } from './types';

const ACTIVE_PORTFOLIO_STATUSES = new Set(['Booked', 'Approved']);

function getActivePortfolioDeals(deals: Transaction[]) {
  return deals.filter((deal) => deal.status && ACTIVE_PORTFOLIO_STATUSES.has(deal.status));
}

function resolveCurves(yieldCurves?: YieldCurvePoint[]) {
  return yieldCurves?.length ? yieldCurves : MOCK_YIELD_CURVE;
}

export function buildMarketSummary(
  deals: Transaction[],
  yieldCurves?: YieldCurvePoint[],
) {
  const curves = resolveCurves(yieldCurves);
  const activeDeals = getActivePortfolioDeals(deals);
  const totalVolume = activeDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
  const averageMargin = activeDeals.length
    ? activeDeals.reduce((sum, deal) => sum + (deal.marginTarget || 0), 0) / activeDeals.length
    : 0;

  return `Yield Curve: ${curves
    .map((curve) => `${curve.tenor}:${curve.rate}%`)
    .slice(0, 6)
    .join(', ')}... | Portfolio: ${activeDeals.length} booked deals, $${(totalVolume / 1e6).toFixed(1)}M volume, ${averageMargin.toFixed(2)}% avg margin`;
}

export function buildAssistantMarketContext(
  deals: Transaction[],
  yieldCurves?: YieldCurvePoint[],
) {
  const curves = resolveCurves(yieldCurves);
  const activeDeals = getActivePortfolioDeals(deals);

  return `Active Yield Curve: ${curves
    .map((curve) => `${curve.tenor}:${curve.rate}%`)
    .slice(0, 7)
    .join(', ')} | Portfolio: ${activeDeals.length} active deals`;
}
