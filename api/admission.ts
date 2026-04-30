/**
 * Ola 9 Bloque A — Admission API client.
 *
 * Wraps `/api/admission/*` para que la UI no toque el adapter layer
 * directamente. Si el adapter remoto está caído el server devuelve 502
 * con `{ code, message }` — el caller decide cómo presentar.
 */

import { apiGet, apiPost } from '../utils/apiFetch';
import type {
  AdmissionContext,
  AdmissionDecisionPush,
  AdmissionReconciliationItem,
  AdapterHealth,
} from '../integrations/types';

export interface AdmissionHealthResponse {
  kind: 'admission';
  name: string;
  health: AdapterHealth;
}

export interface AdmissionPushResponse {
  accepted: true;
  externalId: string | null;
}

export interface AdmissionReconciliationResponse {
  asOfDate: string;
  items: AdmissionReconciliationItem[];
  summary: {
    total: number;
    matched: number;
    mismatchRate: number;
    mismatchMissing: number;
    unknown: number;
  };
}

export async function getAdmissionHealth(): Promise<AdmissionHealthResponse> {
  return apiGet<AdmissionHealthResponse>('/admission/health');
}

export async function pushPricingDecision(
  decision: AdmissionDecisionPush,
): Promise<AdmissionPushResponse> {
  return apiPost<AdmissionPushResponse>('/admission/push', decision);
}

export async function getAdmissionContext(dealId: string): Promise<AdmissionContext | null> {
  try {
    return await apiGet<AdmissionContext>(`/admission/context/${encodeURIComponent(dealId)}`);
  } catch {
    return null;
  }
}

export async function pullAdmissionReconciliation(
  asOfDate?: string,
): Promise<AdmissionReconciliationResponse> {
  const qs = asOfDate ? `?as_of=${encodeURIComponent(asOfDate)}` : '';
  return apiGet<AdmissionReconciliationResponse>(`/admission/reconciliation${qs}`);
}
