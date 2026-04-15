import { apiGet, apiPost, apiPatch } from '../utils/apiFetch';
import type {
  ModelInventoryEntry,
  ModelKind,
  ModelStatus,
} from '../types/governance';

/**
 * Governance API client for model inventory (SR 11-7 / EBA MRM).
 * Entity-scope is enforced server-side via `x-entity-id`. Models with
 * `entityId = null` are global (engine-wide) and visible to every tenant.
 */

export interface ListModelsParams {
  kind?: ModelKind;
  status?: ModelStatus;
}

export async function listModels(params: ListModelsParams = {}): Promise<ModelInventoryEntry[]> {
  const qs = new URLSearchParams();
  if (params.kind) qs.set('kind', params.kind);
  if (params.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs}` : '';
  const res = await apiGet<ModelInventoryEntry[] | { models: ModelInventoryEntry[] }>(
    `/governance/models${suffix}`,
  );
  return Array.isArray(res) ? res : res.models ?? [];
}

export interface CreateModelInput {
  kind: ModelKind;
  name: string;
  version: string;
  status?: ModelStatus;
  entityScope?: 'entity' | 'global';
  ownerEmail?: string | null;
  validationDocUrl?: string | null;
  validatedAt?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
}

export async function createModel(input: CreateModelInput): Promise<ModelInventoryEntry> {
  return apiPost<ModelInventoryEntry>('/governance/models', input);
}

export async function updateModelStatus(
  id: string,
  status: ModelStatus,
): Promise<ModelInventoryEntry> {
  return apiPatch<ModelInventoryEntry>(`/governance/models/${id}/status`, { status });
}
