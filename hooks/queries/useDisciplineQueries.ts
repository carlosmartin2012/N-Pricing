/**
 * React Query hooks for Pricing Discipline (Ola 2).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import * as disciplineApi from '../../api/pricingDiscipline';
import { useData } from '../../contexts/DataContext';
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
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.discipline.kpis(filters?.entityId), dataMode, filters],
    queryFn: () => disciplineApi.getDisciplineKpis(filters),
  });
}

// ---------------------------------------------------------------------------
// Variance queries
// ---------------------------------------------------------------------------

export function useVariancesQuery(filters?: VarianceFilters, page?: PageOpts) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.discipline.variances, dataMode, filters, page],
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
  const { dataMode } = useData();
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.discipline.bands, dataMode, entityId]
      : [...queryKeys.discipline.bands, dataMode],
    queryFn: () => disciplineApi.listToleranceBands(entityId),
  });
}

export function useUpsertToleranceBand() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (band: ToleranceBand) => {
      if (dataMode !== 'live') throw new Error('Discipline mutations are disabled in demo mode');
      return disciplineApi.upsertToleranceBand(band);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.bands });
    },
  });
}

export function useDeleteToleranceBand() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (dataMode !== 'live') throw new Error('Discipline mutations are disabled in demo mode');
      return disciplineApi.deleteToleranceBand(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.bands });
    },
  });
}

// ---------------------------------------------------------------------------
// Pricing exceptions
// ---------------------------------------------------------------------------

export function useExceptionsQuery(dealId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: dealId
      ? [...queryKeys.discipline.exceptions, dataMode, dealId]
      : [...queryKeys.discipline.exceptions, dataMode],
    queryFn: () => disciplineApi.listExceptions(dealId),
  });
}

export function useCreateException() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (exception: Omit<PricingException, 'id' | 'createdAt'>) => {
      if (dataMode !== 'live') throw new Error('Discipline mutations are disabled in demo mode');
      return disciplineApi.createException(exception);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.exceptions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.variances });
    },
  });
}

export function useResolveException() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, approvedBy }: { id: string; status: 'approved' | 'rejected'; approvedBy: string }) => {
      if (dataMode !== 'live') throw new Error('Discipline mutations are disabled in demo mode');
      return disciplineApi.resolveException(id, status, approvedBy);
    },
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
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      if (dataMode !== 'live') throw new Error('Discipline mutations are disabled in demo mode');
      return disciplineApi.recomputeVariance(dealId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.variances });
      void queryClient.invalidateQueries({ queryKey: ['discipline', 'kpis'] });
    },
  });
}
