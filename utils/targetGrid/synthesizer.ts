/**
 * Synthesizer — generates a canonical PricingInput (Transaction) from a
 * canonical deal template + dimension combination.
 *
 * The synthesized deal is used by the pricing engine to compute the target
 * rate card for each cohort.
 */

import type { Transaction } from '../../types';
import type {
  CanonicalDealTemplate,
  CanonicalTemplateValues,
  TenorBucket,
} from '../../types/targetGrid';
import { TENOR_BUCKET_MONTHS } from '../../types/targetGrid';

// ---------------------------------------------------------------------------
// Default canonical values
// ---------------------------------------------------------------------------

const DEFAULT_CANONICAL_VALUES: CanonicalTemplateValues = {
  amount: 1_000_000,
  tenorMonths: 60,
  rating: 'BBB',
  clientType: 'Corporate',
  riskWeight: 0.75,
  capitalRatio: 0.08,
  targetROE: 0.12,
  operationalCostBps: 25,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
  marginTarget: 0,
};

// ---------------------------------------------------------------------------
// Dimension combination
// ---------------------------------------------------------------------------

export interface DimensionCombo {
  product: string;
  segment: string;
  tenorBucket: TenorBucket;
  currency: string;
  entityId?: string;
}

// ---------------------------------------------------------------------------
// Synthesize deal
// ---------------------------------------------------------------------------

/**
 * Synthesizes a canonical Transaction from a template + dimension combo.
 * The result can be passed directly to `calculatePricing()`.
 */
export function synthesizeCanonicalDeal(
  combo: DimensionCombo,
  template?: CanonicalDealTemplate | null,
): Transaction {
  const values = template?.template ?? DEFAULT_CANONICAL_VALUES;
  const tenorMonths = values.tenorMonths ?? TENOR_BUCKET_MONTHS[combo.tenorBucket];

  return {
    id: `canonical-${combo.product}-${combo.segment}-${combo.tenorBucket}-${combo.currency}`,
    status: 'Draft',
    entityId: combo.entityId,

    // Client
    clientId: `canonical-${combo.segment}`,
    clientType: values.clientType ?? 'Corporate',

    // Organization
    businessUnit: 'canonical',
    fundingBusinessUnit: 'canonical',
    businessLine: 'canonical',

    // Product
    productType: combo.product,
    category: inferCategory(combo.product),
    currency: combo.currency,
    amount: values.amount ?? DEFAULT_CANONICAL_VALUES.amount,

    // Time
    startDate: new Date().toISOString().slice(0, 10),
    durationMonths: tenorMonths,
    amortization: values.amortization ?? 'Bullet',
    repricingFreq: values.repricingFreq ?? 'Fixed',

    // Economics
    marginTarget: values.marginTarget ?? 0,

    // Regulatory & Capital
    riskWeight: values.riskWeight ?? DEFAULT_CANONICAL_VALUES.riskWeight,
    capitalRatio: values.capitalRatio ?? DEFAULT_CANONICAL_VALUES.capitalRatio,
    targetROE: values.targetROE ?? DEFAULT_CANONICAL_VALUES.targetROE,
    operationalCostBps: values.operationalCostBps ?? DEFAULT_CANONICAL_VALUES.operationalCostBps,

    // ESG
    transitionRisk: values.transitionRisk ?? 'Neutral',
    physicalRisk: values.physicalRisk ?? 'Low',
    greenFormat: values.greenFormat,
    dnshCompliant: values.dnshCompliant as boolean | undefined,
    isfEligible: values.isfEligible as boolean | undefined,

    // Collateral
    collateralType: values.collateralType,
    haircutPct: values.haircutPct,

    // LTV
    ...(values.ltv != null && { ltvPct: values.ltv }),
  };
}

/**
 * Infer product category from product type string.
 * Uses simple heuristics — extend as product catalog grows.
 */
function inferCategory(productType: string): Transaction['category'] {
  const lower = productType.toLowerCase();
  if (lower.includes('deposit') || lower.includes('saving') || lower.includes('account')) {
    return 'Liability';
  }
  if (lower.includes('guarantee') || lower.includes('letter') || lower.includes('off')) {
    return 'Off-Balance';
  }
  return 'Asset';
}

// ---------------------------------------------------------------------------
// Generate all dimension combinations
// ---------------------------------------------------------------------------

export interface DimensionConfig {
  products: string[];
  segments: string[];
  tenorBuckets: TenorBucket[];
  currencies: string[];
  entityId?: string;
}

/**
 * Generates all dimension combinations from the config.
 * Optionally filters out invalid combos via the `isValid` predicate.
 */
export function generateDimensionCombos(
  config: DimensionConfig,
  isValid?: (combo: DimensionCombo) => boolean,
): DimensionCombo[] {
  const combos: DimensionCombo[] = [];

  for (const product of config.products) {
    for (const segment of config.segments) {
      for (const tenorBucket of config.tenorBuckets) {
        for (const currency of config.currencies) {
          const combo: DimensionCombo = {
            product,
            segment,
            tenorBucket,
            currency,
            entityId: config.entityId,
          };
          if (!isValid || isValid(combo)) {
            combos.push(combo);
          }
        }
      }
    }
  }

  return combos;
}
