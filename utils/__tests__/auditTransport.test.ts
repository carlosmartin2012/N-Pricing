import { describe, expect, it, vi } from 'vitest';
import {
  buildAuditInsertPayload,
  sendAuditEntryKeepalive,
} from '../supabase/auditTransport';

const auditEntry = {
  userEmail: 'ana@nfq.es',
  userName: 'Ana Lopez',
  action: 'SESSION_END',
  module: 'AUTH' as const,
  description: 'User closed the application.',
  details: { reason: 'tab-close' },
  timestamp: '2026-04-02T00:00:00.000Z',
};

describe('auditTransport', () => {
  it('builds the REST payload expected by the audit_log endpoint', () => {
    expect(buildAuditInsertPayload(auditEntry)).toEqual({
      user_email: 'ana@nfq.es',
      user_name: 'Ana Lopez',
      action: 'SESSION_END',
      module: 'AUTH',
      description: 'User closed the application.',
      details: { reason: 'tab-close' },
      timestamp: '2026-04-02T00:00:00.000Z',
    });
  });

  it('posts keepalive audit events to the API endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    try {
      const result = await sendAuditEntryKeepalive(auditEntry);

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/audit');
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        method: 'POST',
        keepalive: true,
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
