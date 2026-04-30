// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const dbMock = vi.hoisted(() => ({
  pool:                   { query: vi.fn(), connect: vi.fn() },
  query:                  vi.fn(),
  queryOne:               vi.fn(),
  execute:                vi.fn(),
  withTransaction:        vi.fn(),
  withTenancyTransaction: vi.fn(),
}));
vi.mock('../../server/db', () => dbMock);

import { dispatchEscalationPush } from '../../server/integrations/escalationPushDispatcher';

const ENTITY = '00000000-0000-0000-0000-000000000099';

const baseInput = {
  entityId:        ENTITY,
  dealId:          'SME-1234',
  decisionId:      'dec-1',
  requiredLevelId: 'lvl-office',
  routingMetadata: { deviationBps: -7.2, rarocPp: 13.8, volumeEur: 80_000, scope: {} },
};

beforeEach(() => {
  dbMock.query.mockReset();
  sendNotificationMock.mockReset();
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe('escalationPushDispatcher · skip paths', () => {
  it('VAPID no configurado → skipped=no_vapid sin tocar DB', async () => {
    const report = await dispatchEscalationPush(baseInput);
    expect(report.skipped).toBe('no_vapid');
    expect(report.notified).toBe(0);
    expect(dbMock.query).not.toHaveBeenCalled();
  });

  it('level no encontrado → error sin enviar push', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    dbMock.query.mockResolvedValueOnce([]);                 // level lookup empty
    const report = await dispatchEscalationPush(baseInput);
    expect(report.errors[0]).toMatch(/not found/);
    expect(report.notified).toBe(0);
  });

  it('sin usuarios con el role → skipped=no_users', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    dbMock.query
      .mockResolvedValueOnce([{ rbac_role: 'BranchManager', name: 'Office' }])
      .mockResolvedValueOnce([]);                            // users empty
    const report = await dispatchEscalationPush(baseInput);
    expect(report.skipped).toBe('no_users');
  });

  it('usuarios pero sin push subscriptions → skipped=no_subscriptions', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    dbMock.query
      .mockResolvedValueOnce([{ rbac_role: 'BranchManager', name: 'Office' }])
      .mockResolvedValueOnce([{ email: 'dir@bank.es' }])
      .mockResolvedValueOnce([]);                            // subs empty
    const report = await dispatchEscalationPush(baseInput);
    expect(report.skipped).toBe('no_subscriptions');
  });
});

describe('escalationPushDispatcher · happy path', () => {
  beforeEach(() => {
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
  });

  it('envía push y devuelve count notificado', async () => {
    dbMock.query
      .mockResolvedValueOnce([{ rbac_role: 'BranchManager', name: 'Office Madrid' }])
      .mockResolvedValueOnce([{ email: 'dir@bank.es' }])
      .mockResolvedValueOnce([{ endpoint: 'https://e1', keys_p256dh: 'p', keys_auth: 'a' }]);
    sendNotificationMock.mockResolvedValueOnce({ statusCode: 201 });
    const report = await dispatchEscalationPush(baseInput);
    expect(report.notified).toBe(1);
    expect(report.skipped).toBeNull();
    // Verificar payload básico
    const callArgs = sendNotificationMock.mock.calls[0];
    expect(callArgs[1]).toContain('SME-1234');
    expect(callArgs[1]).toContain('Office Madrid');
    expect(callArgs[1]).toContain('-7.2');

    // Anti-regresión (Ola 10.2 fix #5 — cross-tenant): el users lookup
    // (segunda query) debe ir scope-ado por entity_id vía entity_users.
    // La versión bug usaba `SELECT email FROM users WHERE role = $1` sin
    // entity_id, leakeando candidatos cross-tenant.
    const usersSql = dbMock.query.mock.calls[1][0] as string;
    expect(usersSql).toMatch(/FROM entity_users/i);
    expect(usersSql).toMatch(/eu\.entity_id\s*=\s*\$1/);
    expect(usersSql).toMatch(/eu\.role\s*=\s*\$2/);
    // Y los params deben incluir entity_id como primer arg
    const usersParams = dbMock.query.mock.calls[1][1] as unknown[];
    expect(usersParams[0]).toBe(ENTITY);
    expect(usersParams[1]).toBe('BranchManager');
  });

  it('purga endpoints stale 410 + cuenta delivered correctamente', async () => {
    dbMock.query
      .mockResolvedValueOnce([{ rbac_role: 'BranchManager', name: 'Office' }])
      .mockResolvedValueOnce([{ email: 'dir@bank.es' }])
      .mockResolvedValueOnce([
        { endpoint: 'https://ok',    keys_p256dh: 'p', keys_auth: 'a' },
        { endpoint: 'https://stale', keys_p256dh: 'p', keys_auth: 'a' },
      ])
      // DELETE stale
      .mockResolvedValueOnce([]);
    sendNotificationMock
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));

    const report = await dispatchEscalationPush(baseInput);
    expect(report.notified).toBe(1);
    expect(report.staleEndpointsPurged).toBe(1);
    // verifica que se llamó DELETE con endpoint stale
    const deleteCall = dbMock.query.mock.calls.find((c) => /DELETE FROM push_subscriptions/.test(c[0] as string));
    expect(deleteCall).toBeTruthy();
  });
});
