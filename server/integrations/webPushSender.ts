/**
 * Ola 10 Bloque C — Web Push sender (real implementation).
 *
 * Reemplaza el stub de `POST /api/notifications/push/test` con un
 * sender real basado en la lib `web-push`. La integración con el flujo
 * de decisiones escaladas (push notif al approver cuando una decision
 * cae en su bandeja) vive en `server/integrations/escalationPushDispatcher.ts`.
 *
 * Configuración:
 *   - VAPID_PUBLIC_KEY  : clave pública (base64 url-safe). El cliente
 *                          la pide via /api/notifications/vapid-public-key
 *                          y la pasa a pushManager.subscribe.
 *   - VAPID_PRIVATE_KEY : clave privada (NEVER expose).
 *   - VAPID_SUBJECT     : `mailto:ops@bank.es` o URL de la web — exigido
 *                          por la spec Web Push.
 *
 * Generación inicial (una vez por deployment):
 *   $ node -e "console.log(require('web-push').generateVAPIDKeys())"
 *
 * El sender es defensivo: si las VAPID keys faltan, no lanza —
 * devuelve un Result `{ ok:false, reason:'no_vapid_config' }` que el
 * caller mapea a una respuesta clara. Esto preserva la idempotencia
 * de los workers (no fail loud cuando el deployment no ha cableado push).
 *
 * Errores 410/404 del provider (Apple/Firebase) significan que la
 * suscripción está stale → el sender lo señaliza con `staleEndpoint:true`
 * para que el caller la borre de la DB.
 */

import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  /** URL relativa donde el click lleva — e.g. `/approvals?focus=ABC-1234`. */
  url?: string;
  /** Identificador único del payload — útil para deduplicación si el
   *  service worker recibe dos mismas notifs por race condition. */
  tag?: string;
  /** Datos arbitrarios que el service worker recibe. */
  data?: Record<string, unknown>;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keysP256dh: string;
  keysAuth: string;
}

export interface PushRetryOptions {
  /** Total attempts per subscription. 1 means no retry. */
  maxAttempts?: number;
  /** Base delay in ms between attempts. Delay grows linearly per attempt. */
  retryDelayMs?: number;
}

export type SendPushResult =
  | { ok: true; statusCode: number }
  | { ok: false; reason: 'no_vapid_config' | 'send_failed'; staleEndpoint?: boolean; statusCode?: number; error?: unknown };

let configured = false;
let configuredKey: string | null = null;

function ensureConfigured(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:ops@n-pricing.local';
  if (!pub || !priv) {
    configured = false;
    configuredKey = null;
    return false;
  }
  // Re-configure si las keys cambian (re-deploy con rotación)
  if (!configured || configuredKey !== pub) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
    configuredKey = pub;
  }
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export function isWebPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Envía un payload a una suscripción concreta. No lanza — devuelve
 * Result. El caller decide si reintenta (retry policy) o purga la
 * suscripción (cuando staleEndpoint=true).
 */
export async function sendPush(
  subscription: PushSubscriptionInput,
  payload: PushPayload,
): Promise<SendPushResult> {
  if (!ensureConfigured()) {
    return { ok: false, reason: 'no_vapid_config' };
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keysP256dh,
      auth:   subscription.keysAuth,
    },
  };

  try {
    const result = await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload),
    );
    return { ok: true, statusCode: result.statusCode };
  } catch (err) {
    // web-push throws WebPushError con statusCode cuando el provider
    // (FCM/APNS/Mozilla Push) responde con error HTTP.
    const errorObj = err as { statusCode?: number; body?: string };
    const statusCode = typeof errorObj.statusCode === 'number' ? errorObj.statusCode : undefined;
    const stale = statusCode === 410 || statusCode === 404;
    return {
      ok: false,
      reason: 'send_failed',
      staleEndpoint: stale,
      statusCode,
      error: err,
    };
  }
}

/**
 * Envío masivo a múltiples suscripciones del mismo usuario (los devices
 * que tenga registrados). Reporta por suscripción.
 */
export interface BulkSendReport {
  total: number;
  delivered: number;
  retried: number;
  staleEndpoints: string[];      // endpoints a purgar
  failures: Array<{ endpoint: string; statusCode?: number; reason: string; attempts: number }>;
}

function normaliseRetryOptions(options?: PushRetryOptions): Required<PushRetryOptions> {
  const rawAttempts = Number(options?.maxAttempts ?? 1);
  const rawDelay = Number(options?.retryDelayMs ?? 0);
  return {
    maxAttempts: Number.isFinite(rawAttempts) ? Math.max(1, Math.min(5, Math.floor(rawAttempts))) : 1,
    retryDelayMs: Number.isFinite(rawDelay) ? Math.max(0, Math.floor(rawDelay)) : 0,
  };
}

function shouldRetryPush(result: SendPushResult): boolean {
  if (result.ok || result.reason !== 'send_failed' || result.staleEndpoint) return false;
  const code = result.statusCode;
  return code === undefined || code === 408 || code === 429 || code >= 500;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPushWithRetry(
  subscription: PushSubscriptionInput,
  payload: PushPayload,
  options?: PushRetryOptions,
): Promise<{ result: SendPushResult; attempts: number }> {
  const retry = normaliseRetryOptions(options);
  let attempts = 0;
  let result: SendPushResult = { ok: false, reason: 'send_failed' };

  while (attempts < retry.maxAttempts) {
    attempts += 1;
    result = await sendPush(subscription, payload);
    if (!shouldRetryPush(result) || attempts >= retry.maxAttempts) break;
    await sleep(retry.retryDelayMs * attempts);
  }

  return { result, attempts };
}

export async function sendPushToMany(
  subscriptions: PushSubscriptionInput[],
  payload: PushPayload,
  options?: PushRetryOptions,
): Promise<BulkSendReport> {
  const report: BulkSendReport = {
    total:           subscriptions.length,
    delivered:       0,
    retried:         0,
    staleEndpoints:  [],
    failures:        [],
  };
  for (const sub of subscriptions) {
    const { result, attempts } = await sendPushWithRetry(sub, payload, options);
    report.retried += Math.max(0, attempts - 1);
    if (result.ok) {
      report.delivered += 1;
    } else if (result.staleEndpoint) {
      report.staleEndpoints.push(sub.endpoint);
      report.failures.push({
        endpoint: sub.endpoint,
        statusCode: result.statusCode,
        reason: 'stale',
        attempts,
      });
    } else {
      report.failures.push({
        endpoint: sub.endpoint,
        statusCode: result.statusCode,
        reason: result.reason,
        attempts,
      });
    }
  }
  return report;
}

// Re-export for direct usage in tests / debugging
export { webpush as __webpush };
