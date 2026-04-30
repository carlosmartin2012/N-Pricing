/**
 * Ola 9 Bloque C — Budget reconciliation React Query hooks.
 */

import { useQuery } from '@tanstack/react-query';
import * as budgetApi from '../../api/budget';
import { queryKeys } from './queryKeys';

export function useBudgetComparisonQuery(params: {
  period: string;
  rateToleranceBps?: number;
  volumeTolerancePct?: number;
}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.budget.comparison(params.period),
    queryFn:  () => budgetApi.getBudgetComparison(params),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
