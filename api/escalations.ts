import { apiGet, apiPost, apiPut } from '../utils/apiFetch';
import type {
  ApprovalEscalation,
  ApprovalEscalationConfig,
  EscalationLevel,
  EscalationStatus,
  EscalationAction,
} from '../types/governance';

/**
 * Client for the approval escalation workflow (Phase 3 continuation).
 * All reads are entity-scoped — the server enforces via `x-entity-id`.
 */

export interface SweepSummary {
  notified: number;
  escalated: number;
  expired: number;
  untouched: number;
}

export async function listEscalations(status?: EscalationStatus): Promise<ApprovalEscalation[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await apiGet<{ escalations: ApprovalEscalation[] }>(`/governance/escalations${qs}`);
  return res.escalations ?? [];
}

export async function openEscalation(input: {
  dealId?: string | null;
  exceptionId?: string | null;
  level?: EscalationLevel;
  notes?: string | null;
  openedBy?: string | null;
}): Promise<ApprovalEscalation> {
  const res = await apiPost<{ escalation: ApprovalEscalation }>('/governance/escalations', input);
  return res.escalation;
}

export async function resolveEscalation(id: string, notes?: string): Promise<ApprovalEscalation> {
  const res = await apiPost<{ escalation: ApprovalEscalation }>(
    `/governance/escalations/${id}/resolve`,
    { notes: notes ?? null },
  );
  return res.escalation;
}

export async function runSweep(): Promise<{ summary: SweepSummary; evaluatedAt: string }> {
  return apiPost('/governance/escalations/sweep', {});
}

export async function evaluateEscalation(id: string): Promise<{
  escalation: ApprovalEscalation;
  action: EscalationAction;
}> {
  return apiGet(`/governance/escalations/${id}/evaluate`);
}

export async function listConfigs(): Promise<Partial<Record<EscalationLevel, ApprovalEscalationConfig>>> {
  const res = await apiGet<{ configs: Partial<Record<EscalationLevel, ApprovalEscalationConfig>> }>(
    '/governance/escalation-configs',
  );
  return res.configs ?? {};
}

export async function upsertConfig(
  level: EscalationLevel,
  body: Partial<Omit<ApprovalEscalationConfig, 'id' | 'entityId' | 'level' | 'createdAt' | 'updatedAt'>>,
): Promise<ApprovalEscalationConfig> {
  const res = await apiPut<{ config: ApprovalEscalationConfig }>(
    `/governance/escalation-configs/${level}`,
    body,
  );
  return res.config;
}
