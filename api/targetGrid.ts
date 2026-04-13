/**
 * API layer for Target Pricing Grid (Ola 1).
 *
 * Provides CRUD operations for methodology snapshots, target grid cells,
 * and canonical deal templates. Follows the same patterns as api/deals.ts.
 */

import type {
  MethodologySnapshot,
  TargetGridCell,
  CanonicalDealTemplate,
  GridFilters,
  GridDiff,
} from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';

const log = createLogger('api/targetGrid');

// ---------------------------------------------------------------------------
// Mappers: snake_case DB ↔ camelCase TS
// ---------------------------------------------------------------------------

export function mapSnapshotFromDB(row: Record<string, unknown>): MethodologySnapshot {
  return {
    id: String(row.id ?? ''),
    version: String(row.version ?? ''),
    approvedAt: String(row.approved_at ?? ''),
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    governanceRequestId: row.governance_request_id ? String(row.governance_request_id) : undefined,
    methodologyHash: String(row.methodology_hash ?? ''),
    notes: row.notes ? String(row.notes) : undefined,
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    isCurrent: Boolean(row.is_current),
    createdAt: String(row.created_at ?? ''),
  };
}

export function mapSnapshotToDB(s: Partial<MethodologySnapshot>): Record<string, unknown> {
  return {
    ...(s.id != null && { id: s.id }),
    ...(s.version != null && { version: s.version }),
    ...(s.approvedAt != null && { approved_at: s.approvedAt }),
    ...(s.approvedBy != null && { approved_by: s.approvedBy }),
    ...(s.governanceRequestId != null && { governance_request_id: s.governanceRequestId }),
    ...(s.methodologyHash != null && { methodology_hash: s.methodologyHash }),
    ...(s.notes != null && { notes: s.notes }),
    ...(s.entityId != null && { entity_id: s.entityId }),
    ...(s.isCurrent != null && { is_current: s.isCurrent }),
  };
}

export function mapGridCellFromDB(row: Record<string, unknown>): TargetGridCell {
  return {
    id: String(row.id ?? ''),
    snapshotId: String(row.snapshot_id ?? ''),
    product: String(row.product ?? ''),
    segment: String(row.segment ?? ''),
    tenorBucket: String(row.tenor_bucket ?? '') as TargetGridCell['tenorBucket'],
    currency: String(row.currency ?? ''),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    canonicalDealInput: (row.canonical_deal_input ?? {}) as TargetGridCell['canonicalDealInput'],
    ftp: Number(row.ftp ?? 0),
    liquidityPremium: row.liquidity_premium != null ? Number(row.liquidity_premium) : null,
    capitalCharge: row.capital_charge != null ? Number(row.capital_charge) : null,
    esgAdjustment: row.esg_adjustment != null ? Number(row.esg_adjustment) : null,
    targetMargin: Number(row.target_margin ?? 0),
    targetClientRate: Number(row.target_client_rate ?? 0),
    targetRaroc: Number(row.target_raroc ?? 0),
    components: (row.components ?? {}) as TargetGridCell['components'],
    computedAt: String(row.computed_at ?? ''),
  };
}

export function mapGridCellToDB(cell: Partial<TargetGridCell>): Record<string, unknown> {
  return {
    ...(cell.id != null && { id: cell.id }),
    ...(cell.snapshotId != null && { snapshot_id: cell.snapshotId }),
    ...(cell.product != null && { product: cell.product }),
    ...(cell.segment != null && { segment: cell.segment }),
    ...(cell.tenorBucket != null && { tenor_bucket: cell.tenorBucket }),
    ...(cell.currency != null && { currency: cell.currency }),
    ...(cell.entityId != null && { entity_id: cell.entityId }),
    ...(cell.canonicalDealInput != null && { canonical_deal_input: cell.canonicalDealInput }),
    ...(cell.ftp != null && { ftp: cell.ftp }),
    ...(cell.liquidityPremium != null && { liquidity_premium: cell.liquidityPremium }),
    ...(cell.capitalCharge != null && { capital_charge: cell.capitalCharge }),
    ...(cell.esgAdjustment != null && { esg_adjustment: cell.esgAdjustment }),
    ...(cell.targetMargin != null && { target_margin: cell.targetMargin }),
    ...(cell.targetClientRate != null && { target_client_rate: cell.targetClientRate }),
    ...(cell.targetRaroc != null && { target_raroc: cell.targetRaroc }),
    ...(cell.components != null && { components: cell.components }),
  };
}

export function mapTemplateFromDB(row: Record<string, unknown>): CanonicalDealTemplate {
  return {
    id: String(row.id ?? ''),
    product: String(row.product ?? ''),
    segment: String(row.segment ?? ''),
    tenorBucket: String(row.tenor_bucket ?? '') as CanonicalDealTemplate['tenorBucket'],
    currency: String(row.currency ?? ''),
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    template: (row.template ?? {}) as CanonicalDealTemplate['template'],
    editableByRole: (row.editable_by_role ?? ['methodologist', 'admin']) as string[],
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function mapTemplateToDB(t: Partial<CanonicalDealTemplate>): Record<string, unknown> {
  return {
    ...(t.id != null && { id: t.id }),
    ...(t.product != null && { product: t.product }),
    ...(t.segment != null && { segment: t.segment }),
    ...(t.tenorBucket != null && { tenor_bucket: t.tenorBucket }),
    ...(t.currency != null && { currency: t.currency }),
    ...(t.entityId != null && { entity_id: t.entityId }),
    ...(t.template != null && { template: t.template }),
    ...(t.editableByRole != null && { editable_by_role: t.editableByRole }),
  };
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export async function listSnapshots(entityId?: string): Promise<MethodologySnapshot[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/target-grid/snapshots${qs}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapSnapshotFromDB);
  } catch (err) {
    log.error('listSnapshots failed', {}, err as Error);
    return [];
  }
}

export async function getSnapshot(id: string): Promise<MethodologySnapshot | null> {
  try {
    const row = await apiGet<Record<string, unknown>>(`/target-grid/snapshots/${id}`);
    return row ? mapSnapshotFromDB(row) : null;
  } catch (err) {
    log.error('getSnapshot failed', { id }, err as Error);
    return null;
  }
}

export async function createSnapshot(
  snapshot: Omit<MethodologySnapshot, 'id' | 'createdAt'>,
): Promise<MethodologySnapshot | null> {
  try {
    const row = await apiPost<Record<string, unknown>>(
      '/target-grid/snapshots',
      mapSnapshotToDB(snapshot),
    );
    return row ? mapSnapshotFromDB(row) : null;
  } catch (err) {
    log.error('createSnapshot failed', {}, err as Error);
    return null;
  }
}

export async function setCurrentSnapshot(
  snapshotId: string,
  entityId?: string,
): Promise<void> {
  try {
    await apiPatch(`/target-grid/snapshots/${snapshotId}/set-current`, { entityId });
  } catch (err) {
    log.error('setCurrentSnapshot failed', { snapshotId }, err as Error);
  }
}

// ---------------------------------------------------------------------------
// Grid Cells
// ---------------------------------------------------------------------------

export async function getGridCells(
  snapshotId: string,
  filters?: GridFilters,
): Promise<TargetGridCell[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.products?.length) params.set('products', filters.products.join(','));
    if (filters?.segments?.length) params.set('segments', filters.segments.join(','));
    if (filters?.tenorBuckets?.length) params.set('tenor_buckets', filters.tenorBuckets.join(','));
    if (filters?.currencies?.length) params.set('currencies', filters.currencies.join(','));
    if (filters?.entityId) params.set('entity_id', filters.entityId);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const rows = await apiGet<Record<string, unknown>[]>(
      `/target-grid/snapshots/${snapshotId}/cells${qs}`,
    );
    if (!Array.isArray(rows)) return [];
    return rows.map(mapGridCellFromDB);
  } catch (err) {
    log.error('getGridCells failed', { snapshotId }, err as Error);
    return [];
  }
}

export async function upsertGridCells(
  cells: Omit<TargetGridCell, 'id' | 'computedAt'>[],
): Promise<void> {
  try {
    await apiPost('/target-grid/cells/batch', cells.map(mapGridCellToDB));
  } catch (err) {
    log.error('upsertGridCells failed', { count: cells.length }, err as Error);
  }
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

export async function diffSnapshots(
  fromId: string,
  toId: string,
): Promise<GridDiff[]> {
  try {
    const rows = await apiGet<GridDiff[]>(
      `/target-grid/diff?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('diffSnapshots failed', { fromId, toId }, err as Error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Canonical Templates
// ---------------------------------------------------------------------------

export async function listCanonicalTemplates(
  entityId?: string,
): Promise<CanonicalDealTemplate[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/target-grid/templates${qs}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapTemplateFromDB);
  } catch (err) {
    log.error('listCanonicalTemplates failed', {}, err as Error);
    return [];
  }
}

export async function upsertCanonicalTemplate(
  template: CanonicalDealTemplate,
): Promise<CanonicalDealTemplate | null> {
  try {
    const row = await apiPost<Record<string, unknown>>(
      '/target-grid/templates',
      mapTemplateToDB(template),
    );
    return row ? mapTemplateFromDB(row) : null;
  } catch (err) {
    log.error('upsertCanonicalTemplate failed', { id: template.id }, err as Error);
    return null;
  }
}

export async function deleteCanonicalTemplate(id: string): Promise<void> {
  try {
    await apiDelete(`/target-grid/templates/${id}`);
  } catch (err) {
    log.error('deleteCanonicalTemplate failed', { id }, err as Error);
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportGridXlsx(
  snapshotId: string,
  filters?: GridFilters,
): Promise<Blob | null> {
  try {
    const params = new URLSearchParams();
    if (filters?.products?.length) params.set('products', filters.products.join(','));
    if (filters?.segments?.length) params.set('segments', filters.segments.join(','));
    if (filters?.currencies?.length) params.set('currencies', filters.currencies.join(','));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(
      `/api/target-grid/snapshots/${snapshotId}/export/xlsx${qs}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('n_pricing_auth_token') ?? ''}` } },
    );
    if (!res.ok) throw new Error(`Export XLSX failed: ${res.status}`);
    return res.blob();
  } catch (err) {
    log.error('exportGridXlsx failed', { snapshotId }, err as Error);
    return null;
  }
}

export async function exportGridPdf(
  snapshotId: string,
  filters?: GridFilters,
): Promise<Blob | null> {
  try {
    const params = new URLSearchParams();
    if (filters?.products?.length) params.set('products', filters.products.join(','));
    if (filters?.segments?.length) params.set('segments', filters.segments.join(','));
    if (filters?.currencies?.length) params.set('currencies', filters.currencies.join(','));
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(
      `/api/target-grid/snapshots/${snapshotId}/export/pdf${qs}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('n_pricing_auth_token') ?? ''}` } },
    );
    if (!res.ok) throw new Error(`Export PDF failed: ${res.status}`);
    return res.blob();
  } catch (err) {
    log.error('exportGridPdf failed', { snapshotId }, err as Error);
    return null;
  }
}
