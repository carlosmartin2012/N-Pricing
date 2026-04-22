/**
 * React Query hooks for the Target Pricing Grid (Ola 1).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import * as targetGridApi from '../../api/targetGrid';
import { useData } from '../../contexts/DataContext';
import type { CanonicalDealTemplate, GridFilters, MethodologySnapshot } from '../../types';

// ---------------------------------------------------------------------------
// Snapshot queries
// ---------------------------------------------------------------------------

export function useSnapshotsQuery(entityId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.targetGrid.snapshots, dataMode, entityId]
      : [...queryKeys.targetGrid.snapshots, dataMode],
    queryFn: () => targetGridApi.listSnapshots(entityId),
  });
}

export function useSnapshotQuery(id: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.targetGrid.snapshot(id), dataMode],
    queryFn: () => targetGridApi.getSnapshot(id),
    enabled: id.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Grid cell queries
// ---------------------------------------------------------------------------

export function useGridCellsQuery(snapshotId: string, filters?: GridFilters) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: [...queryKeys.targetGrid.cells(snapshotId), dataMode, filters],
    queryFn: () => targetGridApi.getGridCells(snapshotId, filters),
    enabled: snapshotId.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Diff queries
// ---------------------------------------------------------------------------

export function useSnapshotDiffQuery(fromId: string, toId: string) {
  return useQuery({
    queryKey: queryKeys.targetGrid.diff(fromId, toId),
    queryFn: () => targetGridApi.diffSnapshots(fromId, toId),
    enabled: fromId.length > 0 && toId.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Template queries
// ---------------------------------------------------------------------------

export function useCanonicalTemplatesQuery(entityId?: string) {
  const { dataMode } = useData();
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.targetGrid.templates, dataMode, entityId]
      : [...queryKeys.targetGrid.templates, dataMode],
    queryFn: () => targetGridApi.listCanonicalTemplates(entityId),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateSnapshot() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (snapshot: Omit<MethodologySnapshot, 'id' | 'createdAt'>) => {
      if (dataMode !== 'live') throw new Error('Target Grid mutations are disabled in demo mode');
      return targetGridApi.createSnapshot(snapshot);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.snapshots });
    },
  });
}

export function useSetCurrentSnapshot() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ snapshotId, entityId }: { snapshotId: string; entityId?: string }) => {
      if (dataMode !== 'live') throw new Error('Target Grid mutations are disabled in demo mode');
      return targetGridApi.setCurrentSnapshot(snapshotId, entityId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.snapshots });
      void queryClient.invalidateQueries({ queryKey: ['targetGrid', 'cells'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.discipline.variances });
      void queryClient.invalidateQueries({ queryKey: ['discipline', 'kpis'] });
    },
  });
}

export function useUpsertCanonicalTemplate() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: CanonicalDealTemplate) => {
      if (dataMode !== 'live') throw new Error('Target Grid mutations are disabled in demo mode');
      return targetGridApi.upsertCanonicalTemplate(template);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.templates });
    },
  });
}

export function useDeleteCanonicalTemplate() {
  const { dataMode } = useData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (dataMode !== 'live') throw new Error('Target Grid mutations are disabled in demo mode');
      return targetGridApi.deleteCanonicalTemplate(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.templates });
    },
  });
}
