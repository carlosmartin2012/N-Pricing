/**
 * Ola 8 — Atribuciones jerárquicas (Bloque A) — cliente tipado.
 *
 * Wraps server endpoints `/api/attributions/*`. Mantiene el tipado de los
 * tipos de dominio (no hay snake_case en este lado — el server ya mapea).
 */

import { apiGet, apiPost, apiPatch } from '../utils/apiFetch';
import type {
  AttributionDecision,
  AttributionLevel,
  AttributionMatrix,
  AttributionQuote,
  AttributionThreshold,
  RoutingResult,
  SimulationInput,
  SimulationResult,
} from '../types/attributions';
import type { AttributionReportingSummary } from '../utils/attributions/attributionReporter';

export type { AttributionReportingSummary } from '../utils/attributions/attributionReporter';

// ---------------------------------------------------------------------------
// Matrix (read)
// ---------------------------------------------------------------------------

export async function getMatrix(): Promise<AttributionMatrix | null> {
  try {
    return await apiGet<AttributionMatrix>('/attributions/matrix');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Levels (write)
// ---------------------------------------------------------------------------

export interface CreateLevelInput {
  name: string;
  parentId: string | null;
  levelOrder: number;
  rbacRole: string;
  metadata?: Record<string, unknown>;
}

export async function createLevel(input: CreateLevelInput): Promise<AttributionLevel> {
  return apiPost<AttributionLevel>('/attributions/levels', input);
}

export interface UpdateLevelInput {
  name?: string;
  parentId?: string | null;
  levelOrder?: number;
  rbacRole?: string;
  metadata?: Record<string, unknown>;
  active?: boolean;
}

export async function updateLevel(
  id: string,
  input: UpdateLevelInput,
): Promise<AttributionLevel> {
  return apiPatch<AttributionLevel>(`/attributions/levels/${encodeURIComponent(id)}`, input);
}

// ---------------------------------------------------------------------------
// Thresholds (write)
// ---------------------------------------------------------------------------

export interface CreateThresholdInput {
  levelId: string;
  scope: AttributionThreshold['scope'];
  deviationBpsMax: number | null;
  rarocPpMin: number | null;
  volumeEurMax: number | null;
  activeFrom?: string;
  activeTo?: string | null;
}

export async function createThreshold(input: CreateThresholdInput): Promise<AttributionThreshold> {
  return apiPost<AttributionThreshold>('/attributions/thresholds', input);
}

export interface UpdateThresholdInput {
  scope?: AttributionThreshold['scope'];
  deviationBpsMax?: number | null;
  rarocPpMin?: number | null;
  volumeEurMax?: number | null;
  activeTo?: string | null;
  isActive?: boolean;
}

export async function updateThreshold(
  id: string,
  input: UpdateThresholdInput,
): Promise<AttributionThreshold> {
  return apiPatch<AttributionThreshold>(
    `/attributions/thresholds/${encodeURIComponent(id)}`,
    input,
  );
}

// ---------------------------------------------------------------------------
// Routing & simulation (stateless)
// ---------------------------------------------------------------------------

export async function routeQuote(quote: AttributionQuote): Promise<RoutingResult> {
  return apiPost<RoutingResult>('/attributions/route', { quote });
}

export async function simulateQuote(input: SimulationInput): Promise<SimulationResult> {
  return apiPost<SimulationResult>('/attributions/simulate', input);
}

// ---------------------------------------------------------------------------
// Decisions (append-only)
// ---------------------------------------------------------------------------

export interface RecordDecisionInput {
  requiredLevelId: string;
  decidedByLevelId?: string | null;
  decision: AttributionDecision['decision'];
  reason?: string | null;
  pricingSnapshotHash: string;
  routingMetadata: AttributionDecision['routingMetadata'];
}

export async function recordDecision(
  dealId: string,
  input: RecordDecisionInput,
): Promise<AttributionDecision> {
  return apiPost<AttributionDecision>(
    `/attributions/decisions/${encodeURIComponent(dealId)}`,
    input,
  );
}

export interface ListDecisionsParams {
  dealId?: string;
  levelId?: string;
  user?: string;
  limit?: number;
  offset?: number;
}

export interface DecisionsListResponse {
  items: AttributionDecision[];
  pagination: { limit: number; offset: number; returned: number };
}

export async function listDecisions(params: ListDecisionsParams = {}): Promise<DecisionsListResponse> {
  const qs = new URLSearchParams();
  if (params.dealId)  qs.set('deal_id',  params.dealId);
  if (params.levelId) qs.set('level_id', params.levelId);
  if (params.user)    qs.set('user',     params.user);
  if (typeof params.limit  === 'number') qs.set('limit',  String(params.limit));
  if (typeof params.offset === 'number') qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiGet<DecisionsListResponse>(`/attributions/decisions${suffix}`);
}

// ---------------------------------------------------------------------------
// Reporting (Ola 8 Bloque C)
// ---------------------------------------------------------------------------

export async function getReportingSummary(windowDays = 90): Promise<AttributionReportingSummary> {
  const qs = new URLSearchParams({ window_days: String(windowDays) });
  return apiGet<AttributionReportingSummary>(`/attributions/reporting/summary?${qs.toString()}`);
}

// ---------------------------------------------------------------------------
// Threshold recalibrations (Ola 10 Bloque B)
// ---------------------------------------------------------------------------

import type { ThresholdRecalibration } from '../types/attributions';

export interface RecalibrationListResponse {
  items: ThresholdRecalibration[];
}

export async function listRecalibrations(status?: ThresholdRecalibration['status']): Promise<RecalibrationListResponse> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiGet<RecalibrationListResponse>(`/attributions/recalibrations${qs}`);
}

export async function approveRecalibration(id: string, reason?: string): Promise<ThresholdRecalibration> {
  return apiPost<ThresholdRecalibration>(
    `/attributions/recalibrations/${encodeURIComponent(id)}/approve`,
    { reason: reason ?? null },
  );
}

export async function rejectRecalibration(id: string, reason?: string): Promise<ThresholdRecalibration> {
  return apiPost<ThresholdRecalibration>(
    `/attributions/recalibrations/${encodeURIComponent(id)}/reject`,
    { reason: reason ?? null },
  );
}
