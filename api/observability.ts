/**
 * API layer — Observability
 *
 * Wraps Supabase calls for the `metrics` and `alert_rules` tables.
 */

import type { AlertRule } from '../types/alertRule';
import { safeSupabaseCall } from '../utils/safeSupabaseCall';
import { supabase } from '../utils/supabase/shared';

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
// Alert Rules CRUD
// ---------------------------------------------------------------------------

export async function listAlertRules(entityId?: string): Promise<AlertRule[]> {
  const { data } = await safeSupabaseCall(
    async () => {
      let q = supabase.from('alert_rules').select('*').order('created_at', { ascending: false });
      if (entityId) q = q.eq('entity_id', entityId);
      return q;
    },
    [],
    'listAlertRules',
  );
  return (data as Record<string, unknown>[]).map(mapAlertRuleFromDB);
}

export async function upsertAlertRule(rule: Partial<AlertRule>): Promise<AlertRule | null> {
  const { data, error } = await safeSupabaseCall(
    async () => supabase.from('alert_rules').upsert(mapAlertRuleToDB(rule)).select(),
    null,
    'upsertAlertRule',
  );
  if (error || !data) return null;
  const rows = data as Record<string, unknown>[];
  return rows.length > 0 ? mapAlertRuleFromDB(rows[0]) : null;
}

export async function deleteAlertRule(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('alert_rules').delete().eq('id', id),
    null,
    'deleteAlertRule',
  );
}

export async function toggleAlertRule(id: string, isActive: boolean): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('alert_rules').update({ is_active: isActive }).eq('id', id),
    null,
    'toggleAlertRule',
  );
}

// ---------------------------------------------------------------------------
// Metrics query (for health dashboard)
// ---------------------------------------------------------------------------

export async function getRecentMetrics(
  entityId: string,
  metricName: string,
  limit: number = 50,
): Promise<{ value: number; recordedAt: string }[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('metrics')
        .select('metric_value, recorded_at')
        .eq('entity_id', entityId)
        .eq('metric_name', metricName)
        .order('recorded_at', { ascending: false })
        .limit(limit),
    [],
    'getRecentMetrics',
  );
  return (data as Record<string, unknown>[]).map((r) => ({
    value: Number(r.metric_value),
    recordedAt: r.recorded_at as string,
  }));
}
