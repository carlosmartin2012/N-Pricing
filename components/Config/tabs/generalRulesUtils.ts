import type {
  FormulaBaseRateKey,
  FormulaLPType,
  FtpRateCard,
  GeneralRule,
} from '../../../types';

type ImportRow = Record<string, unknown>;

export const AVAILABLE_BASE_CURVES = [
  'USD-SOFR',
  'USD-GOVT',
  'EUR-ESTR',
  'EUR-IBOR',
  'GBP-SONIA',
  'JPY-TONA',
];

export const GENERAL_RULE_PRODUCT_OPTIONS = [
  'Commercial Loan',
  'Mortgage',
  'Term Deposit',
  'Any',
];

export const GENERAL_RULE_SEGMENT_OPTIONS = [
  'Corporate',
  'SME',
  'Retail',
  'All',
];

export const GENERAL_RULE_TENOR_OPTIONS = [
  '< 1Y',
  '> 1Y',
  'Any',
  'Fixed',
];

const DEFAULT_FORMULA_SPEC = {
  baseRateKey: 'DTM' as FormulaBaseRateKey,
  lpFormula: 'LP_DTM' as FormulaLPType,
  lpCurveType: 'unsecured' as const,
  sign: 1 as 1 | -1,
};

const readString = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const readNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const createDefaultRuleDraft = (): Partial<GeneralRule> => ({
  id: 0,
  businessUnit: 'Commercial Banking',
  product: 'Commercial Loan',
  segment: 'All',
  tenor: 'Any',
  baseMethod: 'Matched Maturity',
  baseReference: 'USD-SOFR',
  spreadMethod: 'Curve Lookup',
  liquidityReference: '',
  strategicSpread: 0,
});

export const normalizeRuleDraft = (
  draft: Partial<GeneralRule>,
  nextId: number,
): GeneralRule => ({
  id: draft.id && draft.id > 0 ? draft.id : nextId,
  businessUnit: readString(draft.businessUnit, 'All'),
  product: readString(draft.product, 'Any'),
  segment: readString(draft.segment, 'All'),
  tenor: readString(draft.tenor, 'Any'),
  baseMethod: readString(draft.baseMethod, 'Matched Maturity'),
  baseReference: readString(draft.baseReference, AVAILABLE_BASE_CURVES[0]),
  spreadMethod: readString(draft.spreadMethod, 'Curve Lookup'),
  liquidityReference: readString(draft.liquidityReference),
  strategicSpread: readNumber(draft.strategicSpread, 0),
  formulaSpec: draft.formulaSpec
    ? {
      ...DEFAULT_FORMULA_SPEC,
      ...draft.formulaSpec,
    }
    : undefined,
});

export const createImportedRules = (
  rows: ImportRow[],
  startingId: number,
): GeneralRule[] =>
  rows.map((row, index) => normalizeRuleDraft({
    id: startingId + index,
    businessUnit: readString(row.BusinessUnit ?? row.businessUnit, 'All'),
    product: readString(row.Product ?? row.product, 'Any'),
    segment: readString(row.Segment ?? row.segment, 'All'),
    tenor: readString(row.Tenor ?? row.tenor, 'Any'),
    baseMethod: readString(row.BaseMethod ?? row.baseMethod, 'Matched Maturity'),
    baseReference: readString(row.BaseReference ?? row.baseReference, AVAILABLE_BASE_CURVES[0]),
    spreadMethod: readString(row.SpreadMethod ?? row.spreadMethod, 'Curve Lookup'),
    liquidityReference: readString(row.LiquidityReference ?? row.liquidityReference),
    strategicSpread: readNumber(row.StrategicSpread ?? row.strategicSpread, 0),
  }, startingId + index));

export const matchesRuleSearch = (
  rule: GeneralRule,
  searchTerm: string,
  ftpRateCards: FtpRateCard[],
) => {
  const normalizedTerm = searchTerm.trim().toLowerCase();
  if (!normalizedTerm) return true;

  const liquidityLabel = ftpRateCards.find(card => card.id === rule.liquidityReference)?.name || '';

  return [
    rule.businessUnit,
    rule.product,
    rule.segment,
    rule.tenor,
    rule.baseMethod,
    rule.baseReference || '',
    rule.spreadMethod,
    rule.liquidityReference || '',
    liquidityLabel,
  ].some(value => value.toLowerCase().includes(normalizedTerm));
};
