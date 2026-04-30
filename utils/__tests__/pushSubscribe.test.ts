// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import {
  urlBase64ToUint8Array,
  arrayBufferToBase64,
  pushSubscriptionToPayload,
  subscribeUserToPush,
} from '../notifications/pushSubscribe';

// ---------------------------------------------------------------------------
// urlBase64ToUint8Array
// ---------------------------------------------------------------------------

describe('pushSubscribe · urlBase64ToUint8Array', () => {
  it('decodifica base64 url-safe estándar', () => {
    // VAPID public key real (random)
    const out = urlBase64ToUint8Array('BJ8-_g4Z6vk');
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(0);
  });

  it('maneja padding implícito', () => {
    const out = urlBase64ToUint8Array('YWJj');                  // 'abc'
    expect(out.length).toBe(3);
    expect(String.fromCharCode(...out)).toBe('abc');
  });

  it('reemplaza - por + y _ por /', () => {
    const out = urlBase64ToUint8Array('YWJj');                  // ya válido
    const out2 = urlBase64ToUint8Array('YWJ-');                 // - debe convertirse a +
    expect(out.length).toBe(3);
    expect(out2.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// arrayBufferToBase64
// ---------------------------------------------------------------------------

describe('pushSubscribe · arrayBufferToBase64', () => {
  it('null → ""', () => {
    expect(arrayBufferToBase64(null)).toBe('');
  });

  it('codifica un buffer simple', () => {
    const buffer = new Uint8Array([97, 98, 99]).buffer;        // 'abc'
    expect(arrayBufferToBase64(buffer)).toBe('YWJj');
  });
});

// ---------------------------------------------------------------------------
// pushSubscriptionToPayload
// ---------------------------------------------------------------------------

describe('pushSubscribe · pushSubscriptionToPayload', () => {
  it('mapea un PushSubscription mock al payload del server', () => {
    const sub = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      getKey:   (_name: 'p256dh' | 'auth') =>
        new Uint8Array([97, 98, 99]).buffer,
    } as unknown as PushSubscription;
    const payload = pushSubscriptionToPayload(sub, 'Mozilla/5.0 test');
    expect(payload).toEqual({
      endpoint:    'https://fcm.googleapis.com/fcm/send/abc',
      keysP256dh:  'YWJj',
      keysAuth:    'YWJj',
      userAgent:   'Mozilla/5.0 test',
    });
  });
});

// ---------------------------------------------------------------------------
// subscribeUserToPush — Result type semántico
// ---------------------------------------------------------------------------

describe('pushSubscribe · subscribeUserToPush', () => {
  function buildMockSwContainer(registration: ServiceWorkerRegistration | Error) {
    return {
      register: vi.fn(async () => {
        if (registration instanceof Error) throw registration;
        return registration;
      }),
    } as unknown as ServiceWorkerContainer;
  }

  function buildMockNotification(initialPermission: NotificationPermission, requestResult?: NotificationPermission) {
    const Notif = function() {} as unknown as typeof Notification;
    Object.defineProperty(Notif, 'permission', { value: initialPermission, writable: true });
    Object.defineProperty(Notif, 'requestPermission', {
      value: vi.fn(async () => requestResult ?? 'granted'),
    });
    return Notif;
  }

  it('reason=unsupported si serviceWorker o Notification API faltan', async () => {
    const result = await subscribeUserToPush({
      vapidPublicKey: 'YWJj',
      // Force missing APIs
      serviceWorker: undefined as unknown as ServiceWorkerContainer,
      notification:  undefined as unknown as typeof Notification,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported');
  });

  it('reason=denied cuando Notification.permission ya es denied', async () => {
    const result = await subscribeUserToPush({
      vapidPublicKey: 'YWJj',
      serviceWorker:  buildMockSwContainer({} as ServiceWorkerRegistration),
      notification:   buildMockNotification('denied'),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('denied');
  });

  it('reason=denied cuando el usuario rechaza el prompt', async () => {
    const result = await subscribeUserToPush({
      vapidPublicKey: 'YWJj',
      serviceWorker:  buildMockSwContainer({} as ServiceWorkerRegistration),
      notification:   buildMockNotification('default', 'denied'),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('denied');
  });

  it('reason=subscribe_failed cuando register o subscribe lanzan', async () => {
    const result = await subscribeUserToPush({
      vapidPublicKey: 'YWJj',
      serviceWorker:  buildMockSwContainer(new Error('SW network err')),
      notification:   buildMockNotification('granted'),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('subscribe_failed');
  });

  it('happy path: devuelve payload con endpoint + keys mapeadas', async () => {
    const fakeSubscription = {
      endpoint: 'https://example.com/push/abc',
      getKey:   (_n: 'p256dh' | 'auth') => new Uint8Array([97, 98, 99]).buffer,
    } as unknown as PushSubscription;
    const fakeRegistration = {
      pushManager: {
        subscribe: vi.fn(async () => fakeSubscription),
      },
    } as unknown as ServiceWorkerRegistration;

    const result = await subscribeUserToPush({
      vapidPublicKey: 'YWJj',
      serviceWorker:  buildMockSwContainer(fakeRegistration),
      notification:   buildMockNotification('granted'),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.endpoint).toBe('https://example.com/push/abc');
      expect(result.payload.keysP256dh).toBe('YWJj');
    }
  });
});
