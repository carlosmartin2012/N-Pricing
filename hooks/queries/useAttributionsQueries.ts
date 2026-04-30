/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A) — React Query hooks.
 *
 * - useAttributionMatrixQuery: matriz completa del tenant (levels + thresholds).
 *   La matriz cambia poco (cuando Admin/Risk_Manager edita), por eso staleTime
 *   relativamente alto (5 min). Mutaciones de niveles/thresholds invalidan
 *   manualmente esta key.
 * - useAttributionDecisionsQuery: listado para reporting con filtros.
 * - useRecordDecisionMutation / useCreateLevel / useUpdateLevel / etc: writes.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as attributionsApi from '../../api/attributions';
import { queryKeys } from './queryKeys';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function useAttributionMatrixQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.attributions.matrix,
    queryFn: () => attributionsApi.getMatrix(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useAttributionDecisionsQuery(filters: attributionsApi.ListDecisionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.attributions.decisions({
      dealId:  filters.dealId,
      levelId: filters.levelId,
      user:    filters.user,
    }),
    queryFn: () => attributionsApi.listDecisions(filters),
    staleTime: 30 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutations — niveles
// ---------------------------------------------------------------------------

export function useCreateLevelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: attributionsApi.CreateLevelInput) => attributionsApi.createLevel(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attributions.matrix });
    },
  });
}

export function useUpdateLevelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: attributionsApi.UpdateLevelInput }) =>
      attributionsApi.updateLevel(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attributions.matrix });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations — thresholds
// ---------------------------------------------------------------------------

export function useCreateThresholdMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: attributionsApi.CreateThresholdInput) => attributionsApi.createThreshold(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attributions.matrix });
    },
  });
}

export function useUpdateThresholdMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: attributionsApi.UpdateThresholdInput }) =>
      attributionsApi.updateThreshold(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.attributions.matrix });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations — decisions (append-only)
// ---------------------------------------------------------------------------

export function useRecordDecisionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, input }: { dealId: string; input: attributionsApi.RecordDecisionInput }) =>
      attributionsApi.recordDecision(dealId, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.attributions.decisionsForDeal(vars.dealId),
      });
      // Invalida cualquier listado abierto + summary del reporting.
      qc.invalidateQueries({ queryKey: ['attributions', 'decisions'] });
      qc.invalidateQueries({ queryKey: ['attributions', 'reporting'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Reporting (Bloque C)
// ---------------------------------------------------------------------------

export function useAttributionReportingQuery(windowDays = 90) {
  return useQuery({
    queryKey: queryKeys.attributions.reportingSummary(windowDays),
    queryFn:  () => attributionsApi.getReportingSummary(windowDays),
    staleTime: 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Threshold recalibrations (Ola 10 Bloque B)
// ---------------------------------------------------------------------------

import type { ThresholdRecalibration } from '../../types/attributions';

export function useRecalibrationsQuery(status?: ThresholdRecalibration['status']) {
  return useQuery({
    queryKey: ['attributions', 'recalibrations', status ?? 'all'] as const,
    queryFn:  () => attributionsApi.listRecalibrations(status),
    staleTime: 30 * 1000,
  });
}

export function useApproveRecalibrationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      attributionsApi.approveRecalibration(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attributions', 'recalibrations'] });
      qc.invalidateQueries({ queryKey: queryKeys.attributions.matrix });
    },
  });
}

export function useRejectRecalibrationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      attributionsApi.rejectRecalibration(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attributions', 'recalibrations'] });
    },
  });
}
