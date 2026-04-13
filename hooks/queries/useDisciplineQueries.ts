/**
 * React Query hooks for Pricing Discipline (Ola 2).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import * as disciplineApi from '../../api/pricingDiscipline';
import type {
  DisciplineFilters,
  VarianceFilters,
  PageOpts,
  ToleranceBand,
  PricingException,
  Cohort,
  DateRange,
} from '../../types';

// ---------------------------------------------------------------------------
// KPI queries
// ---------------------------------------------------------------------------

export function useDisciplineKpisQuery(filters?: DisciplineFilters) {
  return useQuery({
    queryKey: [...queryKeys.discipline.kpis(filters?.entityId), filters],
    queryFn: () => disciplineApi.getDisciplineKpis(filters),
  });
}

// ---------------------------------------------------------------------------
// Variance queries
// ---------------------------------------------------------------------------

export function useVariancesQuery(filters?: VarianceFilters, page?: PageOpts) {
  return useQuery({
    queryKey: [...queryKeys.discipline.variances, filters, page],
    queryFn: () => disciplineApi.listVariances(filters, page),
  });
}

// ---------------------------------------------------------------------------
// Cohort breakdown
// ---------------------------------------------------------------------------

export function useCohortBreakdownQuery(cohort: Cohort, range: DateRange) {
  return useQuery({
    queryKey: [...queryKeys.discipline.cohortBreakdown(cohort.product, cohort.segment), range],
    queryFn: () => disciplineApi.getCohortBreakdown(cohort, range),
    enabled: cohort.product.length > 0 && cohort.segment.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Originator scorecards
// ---------------------------------------------------------------------------

export function useOriginatorScorecardQuery(originatorId: string, range: DateRange) {
  return useQuery({
    queryKey: [...queryKeys.discipline.scorecards(originatorId), range],
    queryFn: () => disciplineApi.getOriginatorScorecard(originatorId, range),
    enabled: originatorId.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Tolerance bands
// ---------------------------------------------------------------------------

export function useToleranceBandsQuery(entityId?: string) {
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.discipline.bands, entityId]
      : queryKeys.discipline.bands,
    queryFn: () => disciplineApi.listToleranceBands(entityId),
  });
}

export function useUpsertToleranceBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (band: ToleranceBand) => disciplineApi.upsertToleranceBand(band),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.bands });
    },
  });
}

export function useDeleteToleranceBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disciplineApi.deleteToleranceBand(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.bands });
    },
  });
}

// ---------------------------------------------------------------------------
// Pricing exceptions
// ---------------------------------------------------------------------------

export function useExceptionsQuery(dealId?: string) {
  return useQuery({
    queryKey: dealId
      ? [...queryKeys.discipline.exceptions, dealId]
      : queryKeys.discipline.exceptions,
    queryFn: () => disciplineApi.listExceptions(dealId),
  });
}

export function useCreateException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (exception: Omit<PricingException, 'id' | 'createdAt'>) =>
      disciplineApi.createException(exception),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.exceptions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.variances });
    },
  });
}

export function useResolveException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, approvedBy }: { id: string; status: 'approved' | 'rejected'; approvedBy: string }) =>
      disciplineApi.resolveException(id, status, approvedBy),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.exceptions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.variances });
      void queryClient.invalidateQueries({ queryKey: ['discipline', 'kpis'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Recompute mutations
// ---------------------------------------------------------------------------

export function useRecomputeVariance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dealId: string) => disciplineApi.recomputeVariance(dealId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.variances });
      void queryClient.invalidateQueries({ queryKey: ['discipline', 'kpis'] });
    },
  });
}
