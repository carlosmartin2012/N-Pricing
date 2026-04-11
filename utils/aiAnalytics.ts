import type { Transaction, FTPResult } from '../types';

// ─── Pricing Suggestions ──────────────────────────────────────────

export interface PricingSuggestion {
  metric: string;
  value: number;
  formattedValue: string;
  context: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyze similar historical deals and suggest pricing benchmarks.
 * "Similar" = same product type + same category + same currency.
 */
export function getSimilarDealSuggestions(
  currentDeal: Transaction,
  historicalDeals: Transaction[],
  // Reserved for future margin-vs-RAROC tuning — kept in the signature so
  // call-sites don't need to change when we start consuming it.
  _historicalResults: Map<string, FTPResult>,
): PricingSuggestion[] {
  const similar = historicalDeals.filter(
    (d) =>
      d.id !== currentDeal.id &&
      d.productType === currentDeal.productType &&
      d.category === currentDeal.category &&
      d.currency === currentDeal.currency &&
      d.status !== 'Draft' && d.status !== 'Rejected'
  );

  if (similar.length < 3) return [];

  const suggestions: PricingSuggestion[] = [];

  // Margin target suggestion
  const margins = similar.map((d) => d.marginTarget).filter((m) => m > 0);
  if (margins.length >= 3) {
    const avgMargin = margins.reduce((a, b) => a + b, 0) / margins.length;
    const stdDev = Math.sqrt(margins.reduce((s, m) => s + (m - avgMargin) ** 2, 0) / margins.length);
    suggestions.push({
      metric: 'Margin Target',
      value: avgMargin,
      formattedValue: `${(avgMargin * 100).toFixed(2)}%`,
      context: `Based on ${margins.length} similar ${currentDeal.productType} deals (σ: ${(stdDev * 100).toFixed(2)}%)`,
      confidence: stdDev < avgMargin * 0.2 ? 'high' : stdDev < avgMargin * 0.5 ? 'medium' : 'low',
    });
  }

  // Amount range suggestion
  const amounts = similar.map((d) => d.amount);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  suggestions.push({
    metric: 'Typical Amount Range',
    value: avgAmount,
    formattedValue: `${formatCurrency(minAmount)} — ${formatCurrency(maxAmount)}`,
    context: `Average: ${formatCurrency(avgAmount)} across ${amounts.length} deals`,
    confidence: 'medium',
  });

  // Duration suggestion
  const durations = similar.map((d) => d.durationMonths);
  const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  suggestions.push({
    metric: 'Typical Duration',
    value: avgDuration,
    formattedValue: `${avgDuration} months`,
    context: `Range: ${Math.min(...durations)}–${Math.max(...durations)} months`,
    confidence: 'medium',
  });

  return suggestions;
}

// ─── Anomaly Detection ────────────────────────────────────────────

export interface AnomalyAlert {
  id: string;
  type: 'curve_shift' | 'spread_outlier' | 'volume_spike' | 'risk_concentration';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  expectedRange: [number, number];
  detectedAt: string;
}

/**
 * Detect anomalies in the current portfolio.
 * Uses simple statistical thresholds (mean ± 2σ).
 */
export function detectPortfolioAnomalies(deals: Transaction[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const now = new Date().toISOString();

  if (deals.length < 5) return alerts;

  // 1. Check for spread outliers
  const margins = deals
    .filter((d) => d.marginTarget > 0)
    .map((d) => d.marginTarget);
  if (margins.length >= 5) {
    const mean = margins.reduce((a, b) => a + b, 0) / margins.length;
    const stdDev = Math.sqrt(margins.reduce((s, m) => s + (m - mean) ** 2, 0) / margins.length);
    const outliers = deals.filter(
      (d) => d.marginTarget > 0 && Math.abs(d.marginTarget - mean) > 2 * stdDev
    );
    if (outliers.length > 0) {
      alerts.push({
        id: `anomaly-spread-${Date.now()}`,
        type: 'spread_outlier',
        severity: outliers.length > 3 ? 'warning' : 'info',
        title: 'Margin Spread Outliers Detected',
        description: `${outliers.length} deal(s) have margins outside ±2σ of the portfolio mean (${(mean * 100).toFixed(2)}%)`,
        metric: 'margin_target',
        currentValue: outliers[0].marginTarget,
        expectedRange: [mean - 2 * stdDev, mean + 2 * stdDev],
        detectedAt: now,
      });
    }
  }

  // 2. Check for risk concentration by product type
  const productCounts = new Map<string, number>();
  for (const d of deals) {
    productCounts.set(d.productType, (productCounts.get(d.productType) ?? 0) + 1);
  }
  for (const [product, count] of productCounts) {
    const pct = count / deals.length;
    if (pct > 0.6 && deals.length >= 10) {
      alerts.push({
        id: `anomaly-concentration-${product}`,
        type: 'risk_concentration',
        severity: pct > 0.8 ? 'critical' : 'warning',
        title: `High Concentration: ${product}`,
        description: `${(pct * 100).toFixed(0)}% of deals (${count}/${deals.length}) are ${product}`,
        metric: 'product_concentration',
        currentValue: pct,
        expectedRange: [0, 0.5],
        detectedAt: now,
      });
    }
  }

  // 3. Check for large single-deal exposure
  const totalExposure = deals.reduce((s, d) => s + d.amount, 0);
  for (const deal of deals) {
    const pct = deal.amount / totalExposure;
    if (pct > 0.25 && deals.length >= 5) {
      alerts.push({
        id: `anomaly-exposure-${deal.id}`,
        type: 'volume_spike',
        severity: pct > 0.4 ? 'critical' : 'warning',
        title: `Large Single Exposure: ${deal.id}`,
        description: `Deal represents ${(pct * 100).toFixed(1)}% of total portfolio exposure (${formatCurrency(deal.amount)})`,
        metric: 'single_deal_exposure',
        currentValue: pct,
        expectedRange: [0, 0.25],
        detectedAt: now,
      });
    }
  }

  return alerts;
}

// ─── Risk Auto-Classification ─────────────────────────────────────

export type RiskTier = 'Low' | 'Medium' | 'High' | 'Critical';

export interface RiskClassification {
  dealId: string;
  tier: RiskTier;
  score: number; // 0-100
  factors: string[];
}

/**
 * Auto-classify deals by risk tier based on features.
 */
export function classifyDealRisk(deal: Transaction): RiskClassification {
  let score = 0;
  const factors: string[] = [];

  // Amount risk
  if (deal.amount > 50_000_000) { score += 30; factors.push('Very large exposure (>50M)'); }
  else if (deal.amount > 10_000_000) { score += 15; factors.push('Large exposure (>10M)'); }

  // Duration risk
  if (deal.durationMonths > 120) { score += 20; factors.push('Very long tenor (>10Y)'); }
  else if (deal.durationMonths > 60) { score += 10; factors.push('Long tenor (>5Y)'); }

  // Risk weight
  if (deal.riskWeight > 100) { score += 25; factors.push('High risk weight (>100%)'); }
  else if (deal.riskWeight > 50) { score += 10; factors.push('Elevated risk weight (>50%)'); }

  // ESG risk
  if (deal.transitionRisk === 'Brown') { score += 15; factors.push('Brown ESG classification'); }
  if (deal.physicalRisk === 'High') { score += 10; factors.push('High physical risk'); }

  // Client type risk
  if (deal.clientType === 'Institution') { score += 10; factors.push('Institutional counterparty'); }

  const tier: RiskTier =
    score >= 60 ? 'Critical' :
    score >= 40 ? 'High' :
    score >= 20 ? 'Medium' : 'Low';

  return {
    dealId: deal.id ?? 'new',
    tier,
    score: Math.min(score, 100),
    factors,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toFixed(0);
}
