/**
 * API layer for Pricing Discipline & Gap Analytics (Ola 2).
 *
 * Provides CRUD operations for tolerance bands, deal variances,
 * pricing exceptions, KPIs, and originator scorecards.
 */

import type {
  DisciplineKpis,
  DealVariance,
  CohortBreakdown,
  OriginatorScorecard,
  ToleranceBand,
  PricingException,
  DisciplineFilters,
  VarianceFilters,
  PageOpts,
  Paged,
  Cohort,
  DateRange,
} from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';

const log = createLogger('api/pricingDiscipline');

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapCohortFromDB(raw: unknown): Cohort {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    product: String(c.product ?? ''),
    segment: String(c.segment ?? ''),
    tenorBucket: String(c.tenor_bucket ?? c.tenorBucket ?? '') as Cohort['tenorBucket'],
    currency: String(c.currency ?? ''),
    entityId: (c.entity_id ?? c.entityId) ? String(c.entity_id ?? c.entityId) : undefined,
  };
}

function mapToleranceBandFromDB(row: Record<string, unknown>): ToleranceBand {
  return {
    id: String(row.id ?? ''),
    product: row.product ? String(row.product) : undefined,
    segment: row.segment ? String(row.segment) : undefined,
    tenorBucket: row.tenor_bucket ? String(row.tenor_bucket) : undefined,
    currency: row.currency ? String(row.currency) : undefined,
    entityId: row.entity_id ? String(row.entity_id) : undefined,
    ftpBpsTolerance: Number(row.ftp_bps_tolerance ?? 0),
    rarocPpTolerance: Number(row.raroc_pp_tolerance ?? 0),
    marginBpsTolerance: row.margin_bps_tolerance != null ? Number(row.margin_bps_tolerance) : undefined,
    priority: Number(row.priority ?? 100),
    active: Boolean(row.active ?? true),
    effectiveFrom: String(row.effective_from ?? ''),
    effectiveTo: row.effective_to ? String(row.effective_to) : undefined,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapToleranceBandToDB(b: Partial<ToleranceBand>): Record<string, unknown> {
  return {
    ...(b.id !== undefined ? { id: b.id } : {}),
    ...(b.product !== undefined ? { product: b.product } : {}),
    ...(b.segment !== undefined ? { segment: b.segment } : {}),
    ...(b.tenorBucket !== undefined ? { tenor_bucket: b.tenorBucket } : {}),
    ...(b.currency !== undefined ? { currency: b.currency } : {}),
    ...(b.entityId !== undefined ? { entity_id: b.entityId } : {}),
    ...(b.ftpBpsTolerance !== undefined ? { ftp_bps_tolerance: b.ftpBpsTolerance } : {}),
    ...(b.rarocPpTolerance !== undefined ? { raroc_pp_tolerance: b.rarocPpTolerance } : {}),
    ...(b.marginBpsTolerance !== undefined ? { margin_bps_tolerance: b.marginBpsTolerance } : {}),
    ...(b.priority !== undefined ? { priority: b.priority } : {}),
    ...(b.active !== undefined ? { active: b.active } : {}),
    ...(b.effectiveFrom !== undefined ? { effective_from: b.effectiveFrom } : {}),
    ...(b.effectiveTo !== undefined ? { effective_to: b.effectiveTo } : {}),
  };
}

function mapVarianceFromDB(row: Record<string, unknown>): DealVariance {
  return {
    dealId: String(row.deal_id ?? ''),
    snapshotId: String(row.snapshot_id ?? ''),
    cohort: mapCohortFromDB(row.cohort),
    targetFtp: row.target_ftp != null ? Number(row.target_ftp) : null,
    realizedFtp: row.realized_ftp != null ? Number(row.realized_ftp) : null,
    ftpVarianceBps: row.ftp_variance_bps != null ? Number(row.ftp_variance_bps) : null,
    targetRaroc: row.target_raroc != null ? Number(row.target_raroc) : null,
    realizedRaroc: row.realized_raroc != null ? Number(row.realized_raroc) : null,
    rarocVariancePp: row.raroc_variance_pp != null ? Number(row.raroc_variance_pp) : null,
    targetMargin: row.target_margin != null ? Number(row.target_margin) : null,
    realizedMargin: row.realized_margin != null ? Number(row.realized_margin) : null,
    marginVarianceBps: row.margin_variance_bps != null ? Number(row.margin_variance_bps) : null,
    leakageEur: row.leakage_eur != null ? Number(row.leakage_eur) : null,
    outOfBand: Boolean(row.out_of_band),
    bandAppliedId: row.band_applied_id ? String(row.band_applied_id) : undefined,
    computedAt: String(row.computed_at ?? ''),
  };
}

function mapExceptionFromDB(row: Record<string, unknown>): PricingException {
  return {
    id: String(row.id ?? ''),
    dealId: String(row.deal_id ?? ''),
    reasonCode: String(row.reason_code ?? 'other') as PricingException['reasonCode'],
    reasonDetail: String(row.reason_detail ?? ''),
    requestedBy: String(row.requested_by ?? ''),
    approvedBy: row.approved_by ? String(row.approved_by) : undefined,
    status: String(row.status ?? 'pending') as PricingException['status'],
    createdAt: String(row.created_at ?? ''),
    resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined,
  };
}

function mapExceptionToDB(e: Partial<PricingException>): Record<string, unknown> {
  return {
    ...(e.id != null && { id: e.id }),
    ...(e.dealId != null && { deal_id: e.dealId }),
    ...(e.reasonCode != null && { reason_code: e.reasonCode }),
    ...(e.reasonDetail != null && { reason_detail: e.reasonDetail }),
    ...(e.requestedBy != null && { requested_by: e.requestedBy }),
    ...(e.approvedBy != null && { approved_by: e.approvedBy }),
    ...(e.status != null && { status: e.status }),
  };
}

// ---------------------------------------------------------------------------
// Helper to build query string from filters
// ---------------------------------------------------------------------------

function buildFilterQs(filters?: DisciplineFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.entityId) params.set('entity_id', filters.entityId);
  if (filters.products?.length) params.set('products', filters.products.join(','));
  if (filters.segments?.length) params.set('segments', filters.segments.join(','));
  if (filters.tenorBuckets?.length) params.set('tenor_buckets', filters.tenorBuckets.join(','));
  if (filters.currencies?.length) params.set('currencies', filters.currencies.join(','));
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.originatorId) params.set('originator_id', filters.originatorId);
  if (filters.outOfBandOnly) params.set('out_of_band_only', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export async function getDisciplineKpis(
  filters?: DisciplineFilters,
): Promise<DisciplineKpis> {
  const defaultKpis: DisciplineKpis = {
    totalDeals: 0, inBandCount: 0, inBandPct: 0, outOfBandCount: 0,
    totalLeakageEur: 0, leakageTrend: 0, avgFtpVarianceBps: 0, avgRarocVariancePp: 0,
  };
  try {
    const qs = buildFilterQs(filters);
    const data = await apiGet<DisciplineKpis>(`/discipline/kpis${qs}`);
    return data ?? defaultKpis;
  } catch (err) {
    log.error('getDisciplineKpis failed', {}, err as Error);
    return defaultKpis;
  }
}

// ---------------------------------------------------------------------------
// Variances
// ---------------------------------------------------------------------------

export async function listVariances(
  filters?: VarianceFilters,
  page?: PageOpts,
): Promise<Paged<DealVariance>> {
  const empty: Paged<DealVariance> = { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
  try {
    const params = new URLSearchParams();
    if (filters) {
      const baseQs = buildFilterQs(filters);
      new URLSearchParams(baseQs.slice(1)).forEach((v, k) => params.set(k, v));
      if (filters.sortBy) params.set('sort_by', filters.sortBy);
      if (filters.sortDir) params.set('sort_dir', filters.sortDir);
    }
    if (page) {
      params.set('page', String(page.page));
      params.set('page_size', String(page.pageSize));
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const result = await apiGet<{ data: Record<string, unknown>[]; total: number }>(
      `/discipline/variances${qs}`,
    );
    if (!result) return empty;
    return {
      data: (result.data ?? []).map(mapVarianceFromDB),
      total: result.total ?? 0,
      page: page?.page ?? 1,
      pageSize: page?.pageSize ?? 50,
      totalPages: Math.ceil((result.total ?? 0) / (page?.pageSize ?? 50)),
    };
  } catch (err) {
    log.error('listVariances failed', {}, err as Error);
    return empty;
  }
}

export async function recomputeVariance(dealId: string): Promise<void> {
  try {
    await apiPost(`/discipline/variances/${dealId}/recompute`, {});
  } catch (err) {
    log.error('recomputeVariance failed', { dealId }, err as Error);
  }
}

export async function recomputeAllVariances(snapshotId: string): Promise<string | null> {
  try {
    const result = await apiPost<Record<string, unknown>>('/discipline/variances/recompute-all', {
      snapshot_id: snapshotId,
    });
    return String(result?.job_id ?? result?.jobId ?? '') || null;
  } catch (err) {
    log.error('recomputeAllVariances failed', { snapshotId }, err as Error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cohort Breakdown
// ---------------------------------------------------------------------------

export async function getCohortBreakdown(
  cohort: Cohort,
  range: DateRange,
): Promise<CohortBreakdown | null> {
  try {
    const data = await apiPost<CohortBreakdown>('/discipline/cohort-breakdown', {
      cohort,
      date_from: range.from,
      date_to: range.to,
    });
    return data ?? null;
  } catch (err) {
    log.error('getCohortBreakdown failed', {}, err as Error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Originator Scorecards
// ---------------------------------------------------------------------------

export async function getOriginatorScorecard(
  originatorId: string,
  range: DateRange,
): Promise<OriginatorScorecard | null> {
  try {
    const data = await apiGet<OriginatorScorecard>(
      `/discipline/scorecards/${encodeURIComponent(originatorId)}?date_from=${range.from}&date_to=${range.to}`,
    );
    return data ?? null;
  } catch (err) {
    log.error('getOriginatorScorecard failed', { originatorId }, err as Error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tolerance Bands
// ---------------------------------------------------------------------------

export async function listToleranceBands(entityId?: string): Promise<ToleranceBand[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/discipline/bands${qs}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapToleranceBandFromDB);
  } catch (err) {
    log.error('listToleranceBands failed', {}, err as Error);
    return [];
  }
}

export async function upsertToleranceBand(band: ToleranceBand): Promise<ToleranceBand | null> {
  try {
    const row = await apiPost<Record<string, unknown>>(
      '/discipline/bands',
      mapToleranceBandToDB(band),
    );
    return row ? mapToleranceBandFromDB(row) : null;
  } catch (err) {
    log.error('upsertToleranceBand failed', { id: band.id }, err as Error);
    return null;
  }
}

export async function deleteToleranceBand(id: string): Promise<void> {
  try {
    await apiDelete(`/discipline/bands/${id}`);
  } catch (err) {
    log.error('deleteToleranceBand failed', { id }, err as Error);
  }
}

// ---------------------------------------------------------------------------
// Pricing Exceptions
// ---------------------------------------------------------------------------

export async function listExceptions(dealId?: string): Promise<PricingException[]> {
  try {
    const qs = dealId ? `?deal_id=${encodeURIComponent(dealId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/discipline/exceptions${qs}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapExceptionFromDB);
  } catch (err) {
    log.error('listExceptions failed', {}, err as Error);
    return [];
  }
}

export async function createException(
  exception: Omit<PricingException, 'id' | 'createdAt'>,
): Promise<PricingException | null> {
  try {
    const row = await apiPost<Record<string, unknown>>(
      '/discipline/exceptions',
      mapExceptionToDB(exception),
    );
    return row ? mapExceptionFromDB(row) : null;
  } catch (err) {
    log.error('createException failed', {}, err as Error);
    return null;
  }
}

export async function resolveException(
  id: string,
  status: 'approved' | 'rejected',
  approvedBy: string,
): Promise<void> {
  try {
    await apiPatch(`/discipline/exceptions/${id}`, {
      status,
      approved_by: approvedBy,
      resolved_at: new Date().toISOString(),
    });
  } catch (err) {
    log.error('resolveException failed', { id, status }, err as Error);
  }
}
