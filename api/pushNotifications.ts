/**
 * Ola 10 Bloque C — Web Push notifications API client.
 *
 * Distinto de `api/notifications.ts` (in-app notifications). Este
 * cliente cubre el flujo Web Push: subscribe, unsubscribe, list y
 * test. El sender real con web-push lib + VAPID queda como follow-up.
 */

import { apiGet, apiPost } from '../utils/apiFetch';
import type { PushSubscriptionPayload } from '../utils/notifications/pushSubscribe';

export interface PushSubscriptionRow {
  id:           string;
  entityId:     string;
  userEmail:    string;
  endpoint:     string;
  keysP256dh:   string;
  keysAuth:     string;
  userAgent:    string | null;
  createdAt:    string;
  lastSeenAt:   string;
}

export async function subscribeToPush(payload: PushSubscriptionPayload): Promise<PushSubscriptionRow> {
  return apiPost<PushSubscriptionRow>('/notifications/push/subscribe', payload);
}

export async function unsubscribeFromPush(endpoint: string): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>('/notifications/push/unsubscribe', { endpoint });
}

export async function listMyPushSubscriptions(): Promise<{ items: PushSubscriptionRow[] }> {
  return apiGet<{ items: PushSubscriptionRow[] }>('/notifications/push/subscriptions');
}

export interface PushTestResponse {
  delivered: number;
  stub: boolean;
  subscriptionCount: number;
  message: string;
}

export async function sendTestPush(message?: string): Promise<PushTestResponse> {
  return apiPost<PushTestResponse>('/notifications/push/test', { message: message ?? null });
}
