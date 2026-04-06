import type { PricingShocks } from '../../utils/pricingEngine';

export interface ShockScenarioPreset {
  label: string;
  interestRate: number;
  liquiditySpread: number;
}

export interface ShockImpactRow {
  label: string;
  base: number;
  shocked: number;
}

export const QUICK_SHOCK_SCENARIOS: ShockScenarioPreset[] = [
  { label: 'Parallel +200', interestRate: 200, liquiditySpread: 0 },
  { label: 'Parallel -200', interestRate: -200, liquiditySpread: 0 },
  { label: 'Steepener', interestRate: 100, liquiditySpread: 50 },
  { label: 'Flattener', interestRate: -50, liquiditySpread: -25 },
  { label: 'Liq. Crisis', interestRate: 50, liquiditySpread: 200 },
  { label: 'Risk-Off', interestRate: -100, liquiditySpread: 150 },
];

function readNumericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return undefined;
    }

    const parsedValue = Number(trimmedValue);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

export function parseImportedShocks(rows: Record<string, unknown>[]) {
  const firstRow = rows[0];
  if (!firstRow) {
    return undefined;
  }

  return {
    interestRate:
      readNumericValue(firstRow.InterestRateShock) ??
      readNumericValue(firstRow.interestRateShock) ??
      0,
    liquiditySpread:
      readNumericValue(firstRow.LiquiditySpreadShock) ??
      readNumericValue(firstRow.liquiditySpreadShock) ??
      0,
  } satisfies PricingShocks;
}

export function getDeltaTone(delta: number, inverse = false) {
  if (Math.abs(delta) <= 0.001) {
    return 'neutral';
  }

  if (inverse) {
    return delta > 0 ? 'negative' : 'positive';
  }

  return delta > 0 ? 'positive' : 'negative';
}

export function buildShockImpactRows(
  baseResult: {
    baseRate: number;
    liquiditySpread: number;
    strategicSpread: number;
    regulatoryCost: number;
    capitalCharge: number;
  },
  shockedResult: {
    baseRate: number;
    liquiditySpread: number;
    strategicSpread: number;
    regulatoryCost: number;
    capitalCharge: number;
  },
): ShockImpactRow[] {
  return [
    {
      label: 'Base Interest Rate',
      base: baseResult.baseRate,
      shocked: shockedResult.baseRate,
    },
    {
      label: 'Liquidity Spread',
      base: baseResult.liquiditySpread,
      shocked: shockedResult.liquiditySpread,
    },
    {
      label: 'Strategic Spread',
      base: baseResult.strategicSpread,
      shocked: shockedResult.strategicSpread,
    },
    {
      label: 'Regulatory Cost (EL)',
      base: baseResult.regulatoryCost,
      shocked: shockedResult.regulatoryCost,
    },
    {
      label: 'Capital Charge',
      base: baseResult.capitalCharge,
      shocked: shockedResult.capitalCharge,
    },
  ];
}
