import type { AlertRule } from '../types/alertRule';
import { apiDelete, apiGet, apiPatch, apiPost } from '../utils/apiFetch';

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const mapAlertRuleFromDB = (row: Record<string, unknown>): AlertRule => ({
  id: row.id as string,
  entityId: row.entity_id as string,
  name: row.name as string,
  metricName: row.metric_name as string,
  operator: row.operator as AlertRule['operator'],
  threshold: Number(row.threshold),
  recipients: (row.recipients as string[]) ?? [],
  isActive: (row.is_active as boolean) ?? true,
  lastTriggeredAt: (row.last_triggered_at as string | null) ?? null,
  createdAt: row.created_at as string,
});

const mapAlertRuleToDB = (rule: Partial<AlertRule>) => ({
  ...(rule.id && { id: rule.id }),
  entity_id: rule.entityId,
  name: rule.name,
  metric_name: rule.metricName,
  operator: rule.operator,
  threshold: rule.threshold,
  recipients: rule.recipients,
  is_active: rule.isActive ?? true,
});

// ---------------------------------------------------------------------------
export interface HealthSummary {
  entityId: string;
  pricingLatencyP50Ms: number | null;
  pricingLatencyP95Ms: number | null;
  latencySampleCount24h: number;
  errorEvents24h: number;
  dealCount: number;
  activeAlertRules: number;
}

export async function listAlertRules(entityId?: string): Promise<AlertRule[]> {
  try {
    const suffix = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/observability/alert-rules${suffix}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapAlertRuleFromDB);
  } catch {
    return [];
  }
}

export async function upsertAlertRule(rule: Partial<AlertRule>): Promise<AlertRule | null> {
  const row = await apiPost<Record<string, unknown> | null>('/observability/alert-rules', mapAlertRuleToDB(rule));
  return row ? mapAlertRuleFromDB(row) : null;
}

export async function deleteAlertRule(id: string): Promise<void> {
  await apiDelete(`/observability/alert-rules/${encodeURIComponent(id)}`);
}

export async function toggleAlertRule(id: string, isActive: boolean): Promise<void> {
  await apiPatch(`/observability/alert-rules/${encodeURIComponent(id)}/toggle`, { is_active: isActive });
}

// ---------------------------------------------------------------------------
// Metrics query (for health dashboard)
// ---------------------------------------------------------------------------

export async function getRecentMetrics(
  entityId: string,
  metricName: string,
  limit: number = 50,
): Promise<{ value: number; recordedAt: string }[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>(
      `/observability/metrics/recent?entity_id=${encodeURIComponent(entityId)}&metric_name=${encodeURIComponent(metricName)}&limit=${limit}`,
    );
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => ({
      value: Number(r.metric_value ?? 0),
      recordedAt: String(r.recorded_at ?? ''),
    }));
  } catch {
    return [];
  }
}

export async function getHealthSummary(entityId: string): Promise<HealthSummary> {
  return apiGet<HealthSummary>(`/observability/summary?entity_id=${encodeURIComponent(entityId)}`);
}

// ---------------------------------------------------------------------------
// Phase 0 — SLO summary
// ---------------------------------------------------------------------------

export type SLOStatus = 'ok' | 'warning' | 'breached';

export interface SLOSummaryEntry {
  name: string;
  target: number;
  current: number;
  status: SLOStatus;
  window: string;
  percentiles?: { p50: number; p95: number; p99: number };
  sampleCount?: number;
}

export interface SLOActiveAlert {
  ruleId: string;
  name: string;
  sli: string;
  severity: string;
  lastTriggeredAt: string | null;
}

export interface SLOSummaryResponse {
  entityId: string;
  generatedAt: string;
  window: string;
  slos: SLOSummaryEntry[];
  activeAlerts: SLOActiveAlert[];
}

export async function getSLOSummary(entityId: string): Promise<SLOSummaryResponse | null> {
  try {
    return await apiGet<SLOSummaryResponse>(
      `/observability/slo-summary?entity_id=${encodeURIComponent(entityId)}`,
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ola 6 Bloque A — tenancy violations canary widget
// ---------------------------------------------------------------------------

export interface TenancyViolationEndpoint {
  endpoint: string;
  errorCode: string;
  count: number;
}

export interface TenancyViolationsResponse {
  entityId: string;
  windowMinutes: number;
  since: string;
  total: number;
  topEndpoints: TenancyViolationEndpoint[];
}

export async function getTenancyViolations(
  entityId: string,
  windowMinutes: number = 60,
): Promise<TenancyViolationsResponse | null> {
  try {
    return await apiGet<TenancyViolationsResponse>(
      `/observability/tenancy-violations?entity_id=${encodeURIComponent(entityId)}&window_minutes=${windowMinutes}`,
    );
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 4 follow-up — integration adapter health
// ---------------------------------------------------------------------------

export type AdapterKind = 'core_banking' | 'crm' | 'market_data';

export interface AdapterHealthEntry {
  kind: AdapterKind;
  name: string;
  ok: boolean;
  latencyMs: number | null;
  message: string | null;
  checkedAt: string;
}

export interface AdapterHealthResponse {
  generatedAt: string;
  adapters: AdapterHealthEntry[];
}

export async function getAdapterHealth(): Promise<AdapterHealthResponse | null> {
  try {
    return await apiGet<AdapterHealthResponse>('/observability/integrations/health');
  } catch {
    return null;
  }
}
