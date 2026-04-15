import {
  DEFAULT_CROSS_BONUS_CATALOGUE,
  type CrossBonusAttachment,
  type CrossBonusRule,
  type CrossBonusProductType,
} from '../pricing/crossBonuses';
import type { ClientPosition, ClientRelationship } from '../../types/customer360';

/**
 * Derives cross-bonus attachments from the customer's *existing* product
 * holdings rather than from per-deal manual flags. This is the relational
 * upgrade promised by Phase 1: if the client already has the payroll
 * domiciled, an attached HOME_INSURANCE position, etc., the cross-bonus
 * engine sees them automatically — no manual UI checkbox per deal.
 *
 * The mapping from `ClientPosition.productType` (an open string sourced from
 * the deals catalogue) to `CrossBonusProductType` (an enum) lives here. New
 * product synonyms are easy to add — just extend SYNONYMS.
 *
 * The fulfillment probability override comes from the relationship: a client
 * with a 5+ year history and an active position is far more likely to keep
 * it than a brand-new attachment promise. We bump the catalogue probability
 * up when the position is already mature.
 */

const SYNONYMS: Record<string, CrossBonusProductType> = {
  PAYROLL: 'PAYROLL',
  NOMINA: 'PAYROLL',
  SALARY_DOMICILIATION: 'PAYROLL',

  HOME_INSURANCE: 'HOME_INSURANCE',
  SEG_HOGAR: 'HOME_INSURANCE',

  LIFE_INSURANCE: 'LIFE_INSURANCE',
  SEG_VIDA: 'LIFE_INSURANCE',

  PENSION_PLAN: 'PENSION_PLAN',
  PLAN_PENS: 'PENSION_PLAN',

  CREDIT_CARD: 'CREDIT_CARD',
  TARJETA: 'CREDIT_CARD',
  CARD: 'CREDIT_CARD',

  ALARM_SERVICE: 'ALARM_SERVICE',
  ALARMA: 'ALARM_SERVICE',

  DIRECT_DEBIT: 'DIRECT_DEBIT',
  RECIBOS: 'DIRECT_DEBIT',

  MUTUAL_FUND: 'MUTUAL_FUND',
  FONDO: 'MUTUAL_FUND',
};

function normalize(productType: string): CrossBonusProductType | null {
  const key = productType.toUpperCase().trim();
  return SYNONYMS[key] ?? null;
}

function yearsBetween(startISO: string, asOfISO: string): number {
  const a = Date.parse(startISO);
  const b = Date.parse(asOfISO);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return (b - a) / (365.25 * 24 * 3600 * 1000);
}

/**
 * Computes a probability boost based on relationship maturity:
 *   - position fresh (< 1y): no boost
 *   - 1y..3y:  +0.05
 *   - 3y..5y:  +0.10
 *   - 5y+:     +0.15
 * Capped at 0.95 absolute.
 */
function probabilityBoost(position: ClientPosition, asOfDate: string): number {
  const years = yearsBetween(position.startDate, asOfDate);
  if (years >= 5) return 0.15;
  if (years >= 3) return 0.10;
  if (years >= 1) return 0.05;
  return 0;
}

interface DerivationOptions {
  catalogue?: CrossBonusRule[];
  asOfDate?: string;
  /** Restrict to specific product types (e.g. exclude services from a wholesale deal) */
  filter?: (rule: CrossBonusRule, position: ClientPosition) => boolean;
}

export function deriveAttachmentsFromRelationship(
  rel: ClientRelationship,
  opts: DerivationOptions = {},
): CrossBonusAttachment[] {
  const catalogue = opts.catalogue ?? DEFAULT_CROSS_BONUS_CATALOGUE;
  const asOf = opts.asOfDate ?? new Date().toISOString().slice(0, 10);

  const seen = new Set<string>();
  const attachments: CrossBonusAttachment[] = [];

  for (const position of rel.positions) {
    if (position.status !== 'Active') continue;
    const cbType = normalize(position.productType);
    if (!cbType) continue;
    const rule = catalogue.find((r) => r.productType === cbType);
    if (!rule) continue;
    if (opts.filter && !opts.filter(rule, position)) continue;
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);

    const boost = probabilityBoost(position, asOf);
    const overrideProbability = boost > 0
      ? Math.min(0.95, rule.fulfillmentProbability + boost)
      : undefined;

    attachments.push({
      ruleId: rule.id,
      ...(overrideProbability !== undefined ? { overrideProbability } : {}),
    });
  }

  return attachments;
}

// Exposed for tests
export const __TEST_HELPERS__ = { normalize, probabilityBoost, yearsBetween };
