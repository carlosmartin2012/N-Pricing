/**
 * Ola 10 Bloque C — Web Push subscribe helper.
 *
 * Wraps el flujo browser estándar:
 *   1. Registra el service worker (idempotente).
 *   2. Pide `Notification.requestPermission()` si no está concedido.
 *   3. Llama `pushManager.subscribe({ applicationServerKey })`.
 *   4. Mapea el `PushSubscription` a la forma que el server espera
 *      (`PushSubscriptionPayload` con base64 keys).
 *
 * Pure: el módulo NO hace fetch al server — devuelve el payload listo
 * para que el caller lo POSTee a `/api/notifications/push/subscribe`.
 * Esto permite tests deterministas sin tocar HTTP ni APIs del browser.
 */

export interface PushSubscriptionPayload {
  endpoint: string;
  keysP256dh: string;
  keysAuth: string;
  userAgent: string | null;
}

export interface SubscribeOptions {
  /** VAPID public key del server. Requerido por pushManager.subscribe. */
  vapidPublicKey: string;
  /** Path al service worker. Default '/sw.js'. */
  serviceWorkerPath?: string;
  /** Override del navigator.serviceWorker — para tests. */
  serviceWorker?: ServiceWorkerContainer;
  /** Override de Notification.permission API — para tests. */
  notification?: typeof Notification;
}

export type SubscribeResult =
  | { ok: true; payload: PushSubscriptionPayload }
  | { ok: false; reason: 'unsupported' | 'denied' | 'subscribe_failed'; error?: unknown };

/**
 * Convierte VAPID base64url (string del server) a Uint8Array
 * (lo que el browser espera). Pure.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64WithPad = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function' ? atob(base64WithPad) : Buffer.from(base64WithPad, 'base64').toString('binary');
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Convierte un ArrayBuffer a base64 url-safe (lo que el server guarda).
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64;
}

/**
 * Mapea un PushSubscription nativo del browser al payload del server.
 * Aislado para tests: el caller que ya tenga un PushSubscription
 * (e.g. desde `pushManager.getSubscription()`) puede llamar esto sin
 * pasar por `subscribeUserToPush`.
 */
export function pushSubscriptionToPayload(
  sub: PushSubscription,
  userAgent: string | null = null,
): PushSubscriptionPayload {
  return {
    endpoint:    sub.endpoint,
    keysP256dh:  arrayBufferToBase64(sub.getKey('p256dh')),
    keysAuth:    arrayBufferToBase64(sub.getKey('auth')),
    userAgent,
  };
}

/**
 * Flujo completo: registra SW + pide permiso + suscribe + devuelve payload.
 * Devuelve un Result. Cada fallo es semántico (unsupported / denied /
 * subscribe_failed) — el caller decide si reintentar o mostrar UI.
 */
export async function subscribeUserToPush(options: SubscribeOptions): Promise<SubscribeResult> {
  const swContainer = options.serviceWorker ?? (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined);
  const NotificationApi = options.notification ?? (typeof Notification !== 'undefined' ? Notification : undefined);

  if (!swContainer || !NotificationApi) {
    return { ok: false, reason: 'unsupported' };
  }

  // 1) Permiso
  if (NotificationApi.permission === 'denied') {
    return { ok: false, reason: 'denied' };
  }
  if (NotificationApi.permission !== 'granted') {
    const result = await NotificationApi.requestPermission();
    if (result !== 'granted') {
      return { ok: false, reason: 'denied' };
    }
  }

  // 2) Registrar service worker (idempotente)
  let registration: ServiceWorkerRegistration;
  try {
    const path = options.serviceWorkerPath ?? '/sw.js';
    registration = await swContainer.register(path);
  } catch (err) {
    return { ok: false, reason: 'subscribe_failed', error: err };
  }

  // 3) Subscribirse
  try {
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(options.vapidPublicKey),
    });
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    return { ok: true, payload: pushSubscriptionToPayload(sub, userAgent) };
  } catch (err) {
    return { ok: false, reason: 'subscribe_failed', error: err };
  }
}
