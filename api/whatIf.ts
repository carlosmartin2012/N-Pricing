/**
 * API layer for Methodology What-If & Optimization (Ola 3).
 *
 * Provides operations for sandbox methodologies, impact reports,
 * elasticity models, backtesting runs, and market benchmarks.
 */

import type {
  SandboxMethodology,
  ImpactReport,
  ElasticityModel,
  BacktestRun,
  BacktestResult,
  MarketBenchmark,
  BenchmarkComparison,
  BudgetTarget,
  BudgetConsistency,
} from '../types';
import type { GridFilters } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';

const log = createLogger('api/whatIf');

// ---------------------------------------------------------------------------
// Sandbox Methodologies
// ---------------------------------------------------------------------------

export async function listSandboxes(entityId?: string): Promise<SandboxMethodology[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<SandboxMethodology[]>(`/what-if/sandboxes${qs}`);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('listSandboxes failed', {}, err as Error);
    return [];
  }
}

export async function getSandbox(id: string): Promise<SandboxMethodology | null> {
  try {
    return await apiGet<SandboxMethodology>(`/what-if/sandboxes/${id}`);
  } catch (err) {
    log.error('getSandbox failed', { id }, err as Error);
    return null;
  }
}

export async function createSandbox(
  sandbox: Omit<SandboxMethodology, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<SandboxMethodology | null> {
  try {
    return await apiPost<SandboxMethodology>('/what-if/sandboxes', sandbox);
  } catch (err) {
    log.error('createSandbox failed', {}, err as Error);
    return null;
  }
}

export async function updateSandbox(
  id: string,
  updates: Partial<SandboxMethodology>,
): Promise<SandboxMethodology | null> {
  try {
    return await apiPatch<SandboxMethodology>(`/what-if/sandboxes/${id}`, updates);
  } catch (err) {
    log.error('updateSandbox failed', { id }, err as Error);
    return null;
  }
}

export async function deleteSandbox(id: string): Promise<void> {
  try {
    await apiDelete(`/what-if/sandboxes/${id}`);
  } catch (err) {
    log.error('deleteSandbox failed', { id }, err as Error);
  }
}

export async function publishSandbox(id: string): Promise<string | null> {
  try {
    const result = await apiPost<Record<string, unknown>>(
      `/what-if/sandboxes/${id}/publish`,
      {},
    );
    return String(result?.governance_request_id ?? result?.governanceRequestId ?? '') || null;
  } catch (err) {
    log.error('publishSandbox failed', { id }, err as Error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Impact Reports
// ---------------------------------------------------------------------------

export async function computeImpactReport(sandboxId: string): Promise<ImpactReport | null> {
  try {
    return await apiPost<ImpactReport>(`/what-if/sandboxes/${sandboxId}/impact`, {});
  } catch (err) {
    log.error('computeImpactReport failed', { sandboxId }, err as Error);
    return null;
  }
}

export async function getImpactReport(sandboxId: string): Promise<ImpactReport | null> {
  try {
    return await apiGet<ImpactReport>(`/what-if/sandboxes/${sandboxId}/impact`);
  } catch (err) {
    log.error('getImpactReport failed', { sandboxId }, err as Error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Elasticity Models
// ---------------------------------------------------------------------------

export async function listElasticityModels(entityId?: string): Promise<ElasticityModel[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<ElasticityModel[]>(`/what-if/elasticity${qs}`);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('listElasticityModels failed', {}, err as Error);
    return [];
  }
}

export async function upsertElasticityModel(
  model: ElasticityModel,
): Promise<ElasticityModel | null> {
  try {
    return await apiPost<ElasticityModel>('/what-if/elasticity', model);
  } catch (err) {
    log.error('upsertElasticityModel failed', { id: model.id }, err as Error);
    return null;
  }
}

export async function deleteElasticityModel(id: string): Promise<void> {
  try {
    await apiDelete(`/what-if/elasticity/${id}`);
  } catch (err) {
    log.error('deleteElasticityModel failed', { id }, err as Error);
  }
}

export async function calibrateElasticityModel(
  product: string,
  segment: string,
  entityId?: string,
): Promise<ElasticityModel | null> {
  try {
    return await apiPost<ElasticityModel>('/what-if/elasticity/calibrate', {
      product,
      segment,
      entity_id: entityId,
    });
  } catch (err) {
    log.error('calibrateElasticityModel failed', { product, segment }, err as Error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backtesting
// ---------------------------------------------------------------------------

export async function listBacktestRuns(entityId?: string): Promise<BacktestRun[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<BacktestRun[]>(`/what-if/backtests${qs}`);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('listBacktestRuns failed', {}, err as Error);
    return [];
  }
}

export async function createBacktestRun(
  run: Omit<BacktestRun, 'id' | 'startedAt' | 'status'>,
): Promise<BacktestRun | null> {
  try {
    return await apiPost<BacktestRun>('/what-if/backtests', run);
  } catch (err) {
    log.error('createBacktestRun failed', {}, err as Error);
    return null;
  }
}

export async function getBacktestResult(runId: string): Promise<BacktestResult | null> {
  try {
    return await apiGet<BacktestResult>(`/what-if/backtests/${runId}/result`);
  } catch (err) {
    log.error('getBacktestResult failed', { runId }, err as Error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Market Benchmarks
// ---------------------------------------------------------------------------

export async function listBenchmarks(
  filters?: GridFilters,
): Promise<MarketBenchmark[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.products?.length) params.set('products', filters.products.join(','));
    if (filters?.currencies?.length) params.set('currencies', filters.currencies.join(','));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const rows = await apiGet<MarketBenchmark[]>(`/what-if/benchmarks${qs}`);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('listBenchmarks failed', {}, err as Error);
    return [];
  }
}

export async function upsertBenchmark(benchmark: MarketBenchmark): Promise<MarketBenchmark | null> {
  try {
    return await apiPost<MarketBenchmark>('/what-if/benchmarks', benchmark);
  } catch (err) {
    log.error('upsertBenchmark failed', { id: benchmark.id }, err as Error);
    return null;
  }
}

export async function compareBenchmarks(
  snapshotId: string,
  asOfDate?: string,
): Promise<BenchmarkComparison[]> {
  try {
    const params = new URLSearchParams();
    params.set('snapshot_id', snapshotId);
    if (asOfDate) params.set('as_of_date', asOfDate);
    const rows = await apiGet<BenchmarkComparison[]>(
      `/what-if/benchmarks/compare?${params.toString()}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('compareBenchmarks failed', { snapshotId }, err as Error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Budget Targets
// ---------------------------------------------------------------------------

export async function listBudgetTargets(entityId?: string): Promise<BudgetTarget[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<BudgetTarget[]>(`/what-if/budget${qs}`);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('listBudgetTargets failed', {}, err as Error);
    return [];
  }
}

export async function upsertBudgetTarget(target: BudgetTarget): Promise<BudgetTarget | null> {
  try {
    return await apiPost<BudgetTarget>('/what-if/budget', target);
  } catch (err) {
    log.error('upsertBudgetTarget failed', { id: target.id }, err as Error);
    return null;
  }
}

export async function checkBudgetConsistency(
  snapshotId: string,
  entityId?: string,
): Promise<BudgetConsistency[]> {
  try {
    const params = new URLSearchParams({ snapshot_id: snapshotId });
    if (entityId) params.set('entity_id', entityId);
    const rows = await apiGet<BudgetConsistency[]>(
      `/what-if/budget/consistency?${params.toString()}`,
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    log.error('checkBudgetConsistency failed', { snapshotId }, err as Error);
    return [];
  }
}
