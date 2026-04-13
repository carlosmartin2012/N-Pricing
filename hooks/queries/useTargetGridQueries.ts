/**
 * React Query hooks for the Target Pricing Grid (Ola 1).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import * as targetGridApi from '../../api/targetGrid';
import type { CanonicalDealTemplate, GridFilters, MethodologySnapshot } from '../../types';

// ---------------------------------------------------------------------------
// Snapshot queries
// ---------------------------------------------------------------------------

export function useSnapshotsQuery(entityId?: string) {
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.targetGrid.snapshots, entityId]
      : queryKeys.targetGrid.snapshots,
    queryFn: () => targetGridApi.listSnapshots(entityId),
  });
}

export function useSnapshotQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.targetGrid.snapshot(id),
    queryFn: () => targetGridApi.getSnapshot(id),
    enabled: id.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Grid cell queries
// ---------------------------------------------------------------------------

export function useGridCellsQuery(snapshotId: string, filters?: GridFilters) {
  return useQuery({
    queryKey: [...queryKeys.targetGrid.cells(snapshotId), filters],
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
  return useQuery({
    queryKey: entityId
      ? [...queryKeys.targetGrid.templates, entityId]
      : queryKeys.targetGrid.templates,
    queryFn: () => targetGridApi.listCanonicalTemplates(entityId),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (snapshot: Omit<MethodologySnapshot, 'id' | 'createdAt'>) =>
      targetGridApi.createSnapshot(snapshot),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.snapshots });
    },
  });
}

export function useSetCurrentSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ snapshotId, entityId }: { snapshotId: string; entityId?: string }) =>
      targetGridApi.setCurrentSnapshot(snapshotId, entityId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.snapshots });
    },
  });
}

export function useUpsertCanonicalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: CanonicalDealTemplate) =>
      targetGridApi.upsertCanonicalTemplate(template),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.templates });
    },
  });
}

export function useDeleteCanonicalTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => targetGridApi.deleteCanonicalTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.targetGrid.templates });
    },
  });
}
