import { useMemo } from 'react';
import type { LiquidityCurvePoint } from '../../../types';
import type { FundingCollateralType, FundingCurveDatum } from '../reportingTypes';

interface UseFundingCurveDataInput {
  liquidityCurvePoints: LiquidityCurvePoint[];
  selectedCurrency: string;
  collateralType: FundingCollateralType;
  curveShift: number;
}

/**
 * Transforms raw liquidity curve points into chart-ready funding curve data,
 * applying currency factor, collateral spread, and parallel curve shift.
 */
export function useFundingCurveData({
  liquidityCurvePoints,
  selectedCurrency,
  collateralType,
  curveShift,
}: UseFundingCurveDataInput): FundingCurveDatum[] {
  return useMemo<FundingCurveDatum[]>(() => {
    const currencyFactor = selectedCurrency === 'EUR' ? 0.8 : 1.0;
    const collateralSpread = collateralType === 'Unsecured' ? 15 : 0;

    return liquidityCurvePoints.map((p) => {
      const ws = Number.isFinite(p.wholesaleSpread) ? p.wholesaleSpread : 0;
      const lp = Number.isFinite(p.termLP) ? p.termLP : 0;
      const wholesaleShifted = (ws + collateralSpread + curveShift) * currencyFactor;
      const lpShifted = (lp + collateralSpread + curveShift) * currencyFactor;

      return {
        tenor: p.tenor,
        wholesale: ws * currencyFactor,
        lp: lp * currencyFactor,
        simWholesale: wholesaleShifted,
        simLP: lpShifted,
        basis: lpShifted - wholesaleShifted,
      };
    });
  }, [selectedCurrency, collateralType, curveShift, liquidityCurvePoints]);
}
