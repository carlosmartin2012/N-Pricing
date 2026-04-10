/**
 * Cross-bonuses engine — bonificaciones cruzadas per spec §M5.
 *
 * Models rate discounts conditional on cross-product attachment
 * (payroll, insurance, pension plans, etc.) with fulfillment probability
 * and NPV of expected fee/premium income from attached products.
 */

export type CrossBonusProductType =
  | 'PAYROLL' // Nómina domiciliada
  | 'HOME_INSURANCE' // Seguro hogar
  | 'LIFE_INSURANCE' // Seguro vida
  | 'PENSION_PLAN' // Plan de pensiones
  | 'CREDIT_CARD' // Tarjeta con consumo mínimo
  | 'ALARM_SERVICE' // Servicio de alarma
  | 'DIRECT_DEBIT' // Recibos domiciliados
  | 'MUTUAL_FUND' // Fondo de inversión
  | 'OTHER';

/** Rule defining a cross-bonus offer */
export interface CrossBonusRule {
  id: string;
  productType: CrossBonusProductType;
  label: string;
  /** Rate discount applied to loan if bundle attached (bps) */
  rateDiscountBps: number;
  /** Expected annual margin to bank from attached product (€) */
  annualMarginEur: number;
  /** Probability client maintains attachment over loan life (0-1) */
  fulfillmentProbability: number;
  /** Whether bonification compounds with other rules */
  stackable?: boolean;
}

/** Default catalogue (Spanish retail mortgage typical values) */
export const DEFAULT_CROSS_BONUS_CATALOGUE: CrossBonusRule[] = [
  {
    id: 'NOMINA',
    productType: 'PAYROLL',
    label: 'Nómina domiciliada',
    rateDiscountBps: 25,
    annualMarginEur: 80,
    fulfillmentProbability: 0.85,
    stackable: true,
  },
  {
    id: 'SEG_HOGAR',
    productType: 'HOME_INSURANCE',
    label: 'Seguro hogar',
    rateDiscountBps: 10,
    annualMarginEur: 120,
    fulfillmentProbability: 0.75,
    stackable: true,
  },
  {
    id: 'SEG_VIDA',
    productType: 'LIFE_INSURANCE',
    label: 'Seguro vida',
    rateDiscountBps: 15,
    annualMarginEur: 200,
    fulfillmentProbability: 0.65,
    stackable: true,
  },
  {
    id: 'PLAN_PENS',
    productType: 'PENSION_PLAN',
    label: 'Plan de pensiones',
    rateDiscountBps: 10,
    annualMarginEur: 150,
    fulfillmentProbability: 0.55,
    stackable: true,
  },
  {
    id: 'TARJETA',
    productType: 'CREDIT_CARD',
    label: 'Tarjeta con consumo ≥ 3k€/año',
    rateDiscountBps: 5,
    annualMarginEur: 60,
    fulfillmentProbability: 0.7,
    stackable: true,
  },
  {
    id: 'ALARMA',
    productType: 'ALARM_SERVICE',
    label: 'Servicio alarma',
    rateDiscountBps: 5,
    annualMarginEur: 45,
    fulfillmentProbability: 0.45,
    stackable: true,
  },
];

export interface CrossBonusAttachment {
  ruleId: string;
  /** Override fulfillment probability (e.g., segment-specific calibration) */
  overrideProbability?: number;
}

export interface CrossBonusInput {
  attachments: CrossBonusAttachment[];
  loanAmount: number;
  loanDurationMonths: number;
  /** Discount rate for NPV calc (% annual, default 3%) */
  discountRate?: number;
  /** Catalogue to resolve attachments against (defaults to built-in) */
  catalogue?: CrossBonusRule[];
}

export interface CrossBonusBreakdown {
  ruleId: string;
  label: string;
  rateDiscountBps: number;
  effectiveProbability: number;
  /** Expected discount cost to bank (%, positive = cost) */
  expectedDiscountCostPct: number;
  /** NPV of fee/margin income expected from attached product (€) */
  npvMarginIncome: number;
  /** Net contribution in % of loan (positive = bank gains) */
  netContributionPct: number;
}

export interface CrossBonusResult {
  breakdown: CrossBonusBreakdown[];
  /** Sum of all rate discounts expected to apply (% — to subtract from FTP) */
  totalDiscountPct: number;
  /** Total NPV of margin income (€) from all attached products */
  totalNpvMarginIncome: number;
  /** Net adjustment in % of loan amount (positive = subsidize FTP further) */
  netBonusAdjustmentPct: number;
}

/**
 * Calculate NPV of an annuity of `annualAmount` over `durationMonths` at `rate`%.
 */
function calculateAnnuityNpv(
  annualAmount: number,
  durationMonths: number,
  rate: number,
): number {
  if (annualAmount === 0 || durationMonths <= 0) return 0;
  const years = durationMonths / 12;
  const r = rate / 100;
  if (r === 0) return annualAmount * years;
  // Annuity PV formula: A × (1 - (1+r)^-n) / r
  return (annualAmount * (1 - Math.pow(1 + r, -years))) / r;
}

/**
 * Calculate the expected cross-bonus adjustment for a deal.
 *
 * Each attached rule contributes:
 *  - Expected discount cost = rateDiscountBps × fulfillmentProbability
 *  - NPV margin income = annuity NPV of annualMarginEur × fulfillmentProbability
 *
 * Net = NPV margin income / loanAmount − totalDiscountCost
 *       (negative net = bank loses more than gains → higher FTP needed)
 */
export function calculateCrossBonusAdjustment(
  input: CrossBonusInput,
): CrossBonusResult {
  const catalogue = input.catalogue ?? DEFAULT_CROSS_BONUS_CATALOGUE;
  const discountRate = input.discountRate ?? 3;
  const breakdown: CrossBonusBreakdown[] = [];

  let totalDiscountPct = 0;
  let totalNpvMarginIncome = 0;

  for (const attachment of input.attachments) {
    const rule = catalogue.find((r) => r.id === attachment.ruleId);
    if (!rule) continue;

    const prob =
      attachment.overrideProbability ?? rule.fulfillmentProbability;
    const effectiveProbability = Math.min(1, Math.max(0, prob));

    // Expected discount in % = bps → % × probability
    const expectedDiscountCostPct =
      (rule.rateDiscountBps / 100) * effectiveProbability;

    // NPV of margin income, probability-weighted
    const npvMarginIncome =
      calculateAnnuityNpv(
        rule.annualMarginEur,
        input.loanDurationMonths,
        discountRate,
      ) * effectiveProbability;

    const netContributionPct =
      input.loanAmount > 0
        ? (npvMarginIncome / input.loanAmount) * 100 - expectedDiscountCostPct
        : -expectedDiscountCostPct;

    breakdown.push({
      ruleId: rule.id,
      label: rule.label,
      rateDiscountBps: rule.rateDiscountBps,
      effectiveProbability,
      expectedDiscountCostPct,
      npvMarginIncome,
      netContributionPct,
    });

    totalDiscountPct += expectedDiscountCostPct;
    totalNpvMarginIncome += npvMarginIncome;
  }

  const netNpvPct =
    input.loanAmount > 0
      ? (totalNpvMarginIncome / input.loanAmount) * 100
      : 0;
  const netBonusAdjustmentPct = netNpvPct - totalDiscountPct;

  return {
    breakdown,
    totalDiscountPct,
    totalNpvMarginIncome,
    netBonusAdjustmentPct,
  };
}
