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
  const suffix = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
  const rows = await apiGet<Record<string, unknown>[]>(`/observability/alert-rules${suffix}`);
  return rows.map(mapAlertRuleFromDB);
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
  const rows = await apiGet<Record<string, unknown>[]>(
    `/observability/metrics/recent?entity_id=${encodeURIComponent(entityId)}&metric_name=${encodeURIComponent(metricName)}&limit=${limit}`,
  );
  return rows.map((r) => ({
    value: Number(r.metric_value),
    recordedAt: r.recorded_at as string,
  }));
}

export async function getHealthSummary(entityId: string): Promise<HealthSummary> {
  return apiGet<HealthSummary>(`/observability/summary?entity_id=${encodeURIComponent(entityId)}`);
}
