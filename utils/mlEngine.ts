/**
 * Machine Learning Engine Stubs
 *
 * Future capabilities:
 * 1. CPR Prediction: Predict prepayment rates from historical data
 * 2. Anomaly Detection: Flag deals with pricing outside normal ranges
 * 3. Margin Optimization: Suggest optimal margin by segment/rating
 *
 * These stubs define the interfaces and provide simple rule-based
 * implementations that can be replaced with actual ML models.
 */

import type { Transaction, FTPResult } from '../types';

// ─── CPR Prediction ────────────────────────────────────────────────────────

export interface CPRPrediction {
  predictedCPR: number;       // annualized %
  confidence: number;          // 0-1
  factors: {
    rateEnvironment: number;   // contribution from rate level
    seasonality: number;       // contribution from time of year
    vintage: number;           // contribution from loan age
  };
}

/**
 * Predict conditional prepayment rate for a mortgage/loan.
 * Stub: uses simple rule-based heuristic. Replace with trained model.
 */
export function predictCPR(
  deal: Transaction,
  currentRate: number,
  originalRate?: number,
): CPRPrediction {
  const dealRate = originalRate || currentRate;

  // Simple incentive model: higher refinancing incentive → higher CPR
  const rateIncentive = Math.max(0, dealRate - currentRate);
  const rateContribution = Math.min(20, rateIncentive * 5); // cap at 20%

  // Seasonality: spring/summer slightly higher prepayment
  const month = new Date().getMonth();
  const seasonality = (month >= 3 && month <= 8) ? 1.5 : 0;

  // Loan age: newer loans have lower prepayment
  const ageMonths = deal.durationMonths > 0 ? Math.min(deal.durationMonths, 60) : 12;
  const ageFactor = Math.min(5, ageMonths / 12);

  const predictedCPR = Math.max(0, rateContribution + seasonality + ageFactor);

  return {
    predictedCPR: Math.round(predictedCPR * 100) / 100,
    confidence: 0.3, // low confidence for rule-based
    factors: {
      rateEnvironment: rateContribution,
      seasonality,
      vintage: ageFactor,
    },
  };
}

// ─── Pricing Anomaly Detection ─────────────────────────────────────────────

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;              // 0 = normal, 1 = highly anomalous
  flags: string[];
  suggestedRange: { min: number; max: number };
}

/**
 * Detect pricing anomalies by comparing a deal's result to portfolio norms.
 * Stub: uses simple statistical bounds. Replace with isolation forest / autoencoder.
 */
export function detectPricingAnomaly(
  deal: Transaction,
  result: FTPResult,
  portfolioStats: {
    avgFTP: number;
    stdFTP: number;
    avgRAROC: number;
    stdRAROC: number;
    avgMargin: number;
    stdMargin: number;
  },
): AnomalyResult {
  const flags: string[] = [];
  let score = 0;

  // Z-score for FTP
  const ftpZ = portfolioStats.stdFTP > 0
    ? Math.abs(result.totalFTP - portfolioStats.avgFTP) / portfolioStats.stdFTP
    : 0;
  if (ftpZ > 2) {
    flags.push(`FTP ${result.totalFTP.toFixed(2)}% is ${ftpZ.toFixed(1)} std devs from mean`);
    score += Math.min(0.4, ftpZ * 0.1);
  }

  // Z-score for RAROC
  const rarocZ = portfolioStats.stdRAROC > 0
    ? Math.abs(result.raroc - portfolioStats.avgRAROC) / portfolioStats.stdRAROC
    : 0;
  if (rarocZ > 2) {
    flags.push(`RAROC ${result.raroc.toFixed(2)}% is ${rarocZ.toFixed(1)} std devs from mean`);
    score += Math.min(0.3, rarocZ * 0.1);
  }

  // Margin check
  if (deal.marginTarget < 0) {
    flags.push('Negative margin target');
    score += 0.3;
  }

  // Very large deal
  if (deal.amount > 100_000_000) {
    flags.push('Large deal (>100M) requires additional review');
    score += 0.1;
  }

  // Approval rejected but attempting to book
  if (result.approvalLevel === 'Rejected') {
    flags.push('RAROC below minimum threshold');
    score += 0.2;
  }

  return {
    isAnomaly: score > 0.5,
    score: Math.min(1, score),
    flags,
    suggestedRange: {
      min: portfolioStats.avgFTP - 2 * portfolioStats.stdFTP,
      max: portfolioStats.avgFTP + 2 * portfolioStats.stdFTP,
    },
  };
}

// ─── Margin Optimization ───────────────────────────────────────────────────

export interface MarginSuggestion {
  suggestedMargin: number;    // %
  reason: string;
  rarocAtSuggested: number;   // estimated RAROC at suggested margin
  competitivePosition: 'aggressive' | 'market' | 'conservative';
}

/**
 * Suggest optimal margin for a deal based on segment and rating.
 * Stub: uses rule-based lookup. Replace with optimization model.
 */
export function suggestOptimalMargin(
  deal: Transaction,
  result: FTPResult,
): MarginSuggestion {
  // Base margin by client type
  const baseMargins: Record<string, number> = {
    'Corporate': 1.5,
    'Retail': 2.5,
    'SME': 2.0,
    'Institution': 0.8,
    'Gov': 0.5,
  };

  let suggested = baseMargins[deal.clientType] || 2.0;

  // Adjust for deal size (larger deals = tighter margin)
  if (deal.amount > 50_000_000) suggested -= 0.3;
  if (deal.amount < 1_000_000) suggested += 0.5;

  // Adjust for ESG
  if (deal.transitionRisk === 'Green') suggested -= 0.1;
  if (deal.transitionRisk === 'Brown') suggested += 0.2;

  // Ensure RAROC viability
  const minMarginForRAROC = result.technicalPrice * 0.1; // rough estimate
  suggested = Math.max(suggested, minMarginForRAROC);

  const position = deal.marginTarget < suggested - 0.5 ? 'aggressive'
    : deal.marginTarget > suggested + 0.5 ? 'conservative'
    : 'market';

  return {
    suggestedMargin: Math.round(suggested * 100) / 100,
    reason: `Based on ${deal.clientType} segment, deal size, and ESG profile`,
    rarocAtSuggested: result.raroc + (suggested - deal.marginTarget) * 2, // rough linear estimate
    competitivePosition: position,
  };
}
