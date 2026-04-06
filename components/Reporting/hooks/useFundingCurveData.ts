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
      const wholesaleShifted = (p.wholesaleSpread + collateralSpread + curveShift) * currencyFactor;
      const lpShifted = (p.termLP + collateralSpread + curveShift) * currencyFactor;

      return {
        tenor: p.tenor,
        wholesale: p.wholesaleSpread * currencyFactor,
        lp: p.termLP * currencyFactor,
        simWholesale: wholesaleShifted,
        simLP: lpShifted,
        basis: lpShifted - wholesaleShifted,
      };
    });
  }, [selectedCurrency, collateralType, curveShift, liquidityCurvePoints]);
}
