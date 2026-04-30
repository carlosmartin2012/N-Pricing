// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock web-push — vi.hoisted para que la closure se evalúe antes del import
const { sendNotificationMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
}));
vi.mock('web-push', () => ({
  default: {
    setVapidDetails:  vi.fn(),
    sendNotification: sendNotificationMock,
    generateVAPIDKeys: vi.fn(() => ({ publicKey: 'pub', privateKey: 'priv' })),
  },
}));

import {
  sendPush,
  sendPushToMany,
  isWebPushConfigured,
  getVapidPublicKey,
} from '../../server/integrations/webPushSender';

const SUB = {
  endpoint:    'https://fcm.googleapis.com/fcm/send/abc',
  keysP256dh:  'p256-fake',
  keysAuth:    'auth-fake',
};

const PAYLOAD = {
  title: 'test', body: 'hello', tag: 't-1',
};

beforeEach(() => {
  sendNotificationMock.mockReset();
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

describe('webPushSender · isWebPushConfigured + getVapidPublicKey', () => {
  it('false cuando VAPID keys faltan', () => {
    expect(isWebPushConfigured()).toBe(false);
    expect(getVapidPublicKey()).toBeNull();
  });

  it('true cuando ambas claves están definidas', () => {
    process.env.VAPID_PUBLIC_KEY = 'pub-key';
    process.env.VAPID_PRIVATE_KEY = 'priv-key';
    expect(isWebPushConfigured()).toBe(true);
    expect(getVapidPublicKey()).toBe('pub-key');
  });
});

describe('webPushSender · sendPush', () => {
  it('reason=no_vapid_config si VAPID falta', async () => {
    const r = await sendPush(SUB, PAYLOAD);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_vapid_config');
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('happy path: web-push.sendNotification es invocado y devuelve ok', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    sendNotificationMock.mockResolvedValueOnce({ statusCode: 201 });
    const r = await sendPush(SUB, PAYLOAD);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.statusCode).toBe(201);
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: SUB.endpoint,
        keys: { p256dh: SUB.keysP256dh, auth: SUB.keysAuth },
      }),
      expect.stringContaining('"title":"test"'),
    );
  });

  it('410 → staleEndpoint=true (suscripción inválida)', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }));
    const r = await sendPush(SUB, PAYLOAD);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.staleEndpoint).toBe(true);
      expect(r.statusCode).toBe(410);
    }
  });

  it('404 → staleEndpoint=true', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error('Not found'), { statusCode: 404 }));
    const r = await sendPush(SUB, PAYLOAD);
    if (!r.ok) expect(r.staleEndpoint).toBe(true);
  });

  it('500 → staleEndpoint=false (transient)', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error('Server'), { statusCode: 500 }));
    const r = await sendPush(SUB, PAYLOAD);
    if (!r.ok) {
      expect(r.staleEndpoint).toBeFalsy();
      expect(r.statusCode).toBe(500);
    }
  });
});

describe('webPushSender · sendPushToMany', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
  });

  it('agrega delivered + staleEndpoints + failures', async () => {
    sendNotificationMock
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('Server'), { statusCode: 500 }));

    const subs = [
      { endpoint: 'https://e1', keysP256dh: 'k', keysAuth: 'a' },
      { endpoint: 'https://stale', keysP256dh: 'k', keysAuth: 'a' },
      { endpoint: 'https://transient', keysP256dh: 'k', keysAuth: 'a' },
    ];
    const report = await sendPushToMany(subs, PAYLOAD);
    expect(report.total).toBe(3);
    expect(report.delivered).toBe(1);
    expect(report.staleEndpoints).toEqual(['https://stale']);
    expect(report.failures).toHaveLength(2);
    const stale = report.failures.find((f) => f.reason === 'stale');
    expect(stale?.endpoint).toBe('https://stale');
  });

  it('lista vacía → todos los counters a 0', async () => {
    const report = await sendPushToMany([], PAYLOAD);
    expect(report.total).toBe(0);
    expect(report.delivered).toBe(0);
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});
