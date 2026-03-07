import { Transaction, GeneralRule, BusinessUnit, ProductDefinition, FtpRateCard, YieldCurvePoint } from '../types';
import { TENOR_MONTHS } from './pricingConstants';

export interface MatchResult {
  rule: GeneralRule | null;
  methodology: string;
  reason: string;
  baseReference: string | null;
  liquidityReference: string | null;
  strategicSpreadBps: number;
}

/** Evaluate a tenor condition string (e.g. "<12M", ">36M", "Any") against deal months */
function evaluateTenorCondition(tenorStr: string, months: number): boolean {
  if (!tenorStr || tenorStr === 'Any') return true;
  const clean = tenorStr.replace(/\s/g, '');
  const ltMatch = clean.match(/^[<≤](\d+)([MY]?)$/);
  if (ltMatch) {
    const val = parseInt(ltMatch[1]);
    const unit = ltMatch[2] || 'M';
    const targetMonths = unit === 'Y' ? val * 12 : val;
    return months < targetMonths;
  }
  const gtMatch = clean.match(/^[>≥](\d+)([MY]?)$/);
  if (gtMatch) {
    const val = parseInt(gtMatch[1]);
    const unit = gtMatch[2] || 'M';
    const targetMonths = unit === 'Y' ? val * 12 : val;
    return months > targetMonths;
  }
  const rangeMatch = clean.match(/^(\d+)-(\d+)([MY]?)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1]);
    const hi = parseInt(rangeMatch[2]);
    const unit = rangeMatch[3] || 'M';
    const loM = unit === 'Y' ? lo * 12 : lo;
    const hiM = unit === 'Y' ? hi * 12 : hi;
    return months >= loM && months <= hiM;
  }
  return true;
}

/**
 * Match a deal to the most specific pricing rule.
 * Scoring: +10 for BU match, +10 for product match, +5 for segment, +5 for tenor.
 */
export function matchDealToRule(
  deal: Transaction,
  rules: GeneralRule[],
  businessUnits: BusinessUnit[],
  products: ProductDefinition[],
): MatchResult {
  const buName = businessUnits.find(bu => bu.id === deal.businessUnit)?.name || '';
  const productName = products.find(p => p.id === deal.productType)?.name || '';

  const scored = rules.map(rule => {
    let score = 0;
    let matches = true;

    if (rule.businessUnit && rule.businessUnit !== 'All' && rule.businessUnit !== 'General') {
      if (buName.toLowerCase().includes(rule.businessUnit.toLowerCase()) ||
          rule.businessUnit.toLowerCase().includes(buName.toLowerCase())) {
        score += 10;
      } else {
        matches = false;
      }
    }

    if (rule.product && rule.product !== 'Any' && rule.product !== 'All' && rule.product !== 'Unknown') {
      if (productName.toLowerCase().includes(rule.product.toLowerCase()) ||
          rule.product.toLowerCase().includes(productName.toLowerCase()) ||
          deal.productType.toLowerCase().includes(rule.product.toLowerCase())) {
        score += 10;
      } else {
        matches = false;
      }
    }

    if (rule.segment && rule.segment !== 'All') {
      if (deal.clientType?.toLowerCase() === rule.segment.toLowerCase()) {
        score += 5;
      } else {
        matches = false;
      }
    }

    if (rule.tenor && rule.tenor !== 'Any') {
      if (evaluateTenorCondition(rule.tenor, deal.durationMonths)) {
        score += 5;
      } else {
        matches = false;
      }
    }

    return { rule, score, matches };
  })
  .filter(r => r.matches)
  .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const best = scored[0].rule;
    return {
      rule: best,
      methodology: best.baseMethod || 'Matched Maturity',
      reason: `Rule #${best.id}: ${best.businessUnit}/${best.product}/${best.segment}`,
      baseReference: best.baseReference || null,
      liquidityReference: best.liquidityReference || null,
      strategicSpreadBps: best.strategicSpread || 0,
    };
  }

  return {
    rule: null,
    methodology: deal.repricingFreq === 'Fixed' ? 'Matched Maturity' : 'Moving Average',
    reason: 'Default: no matching rule',
    baseReference: null,
    liquidityReference: null,
    strategicSpreadBps: 0,
  };
}

/**
 * Interpolate a rate card's points to get rate at target maturity.
 */
export function interpolateRateCard(
  card: FtpRateCard,
  targetMonths: number,
): number {
  const points = card.points
    .map(p => ({ months: TENOR_MONTHS[p.tenor] ?? 0, rate: p.rate }))
    .sort((a, b) => a.months - b.months);

  if (points.length === 0) return 0;
  if (targetMonths <= points[0].months) return points[0].rate;
  if (targetMonths >= points[points.length - 1].months) return points[points.length - 1].rate;

  const upperIdx = points.findIndex(p => p.months >= targetMonths);
  if (upperIdx <= 0) return points[0].rate;
  const lower = points[upperIdx - 1];
  const upper = points[upperIdx];
  const denom = upper.months - lower.months;
  if (denom === 0) return upper.rate;
  const ratio = (targetMonths - lower.months) / denom;
  return lower.rate + ratio * (upper.rate - lower.rate);
}

/**
 * Lookup a rate card by ID and interpolate to target maturity.
 */
export function lookupRateCard(
  cards: FtpRateCard[],
  referenceId: string,
  targetMonths: number,
): number | null {
  const card = cards.find(c => c.id === referenceId);
  if (!card) return null;
  return interpolateRateCard(card, targetMonths);
}
