import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { buildPricingContext } from '../utils/pricingContext';

export function usePricingContext() {
  const data = useData();

  return useMemo(
    () =>
      buildPricingContext(
        {
          yieldCurves: data.yieldCurves,
          liquidityCurves: data.liquidityCurves,
          rules: data.rules,
          ftpRateCards: data.ftpRateCards,
          transitionGrid: data.transitionGrid,
          physicalGrid: data.physicalGrid,
          greeniumGrid: data.greeniumGrid,
          behaviouralModels: data.behaviouralModels,
        },
        {
          clients: data.clients,
          products: data.products,
          businessUnits: data.businessUnits,
        },
      ),
    [
      data.yieldCurves,
      data.liquidityCurves,
      data.rules,
      data.ftpRateCards,
      data.transitionGrid,
      data.physicalGrid,
      data.greeniumGrid,
      data.behaviouralModels,
      data.clients,
      data.products,
      data.businessUnits,
    ],
  );
}
