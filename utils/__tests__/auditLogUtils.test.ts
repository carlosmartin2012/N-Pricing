import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '../../types';
import {
  DEFAULT_AUDIT_FILTERS,
  filterAuditEntries,
  formatAuditDetails,
  getAuditModuleOptions,
  resolveAuditActionFamily,
  summarizeAuditEntries,
} from '../../components/Admin/auditLogUtils';

const auditEntries: AuditEntry[] = [
  {
    id: '1',
    timestamp: '2026-04-01T10:00:00.000Z',
    userEmail: 'ana@nfq.es',
    userName: 'Ana Lopez',
    action: 'LOGIN',
    module: 'AUTH',
    description: 'User signed in successfully',
    details: { ip: '127.0.0.1' },
  },
  {
    id: '2',
    timestamp: '2026-04-01T10:05:00.000Z',
    userEmail: 'carlos@nfq.es',
    userName: 'Carlos Martin',
    action: 'DELETE_DEAL',
    module: 'BLOTTER',
    description: 'Deleted stale test deal',
    details: { dealId: 'TRD-1' },
  },
  {
    id: '3',
    timestamp: '2026-04-01T10:10:00.000Z',
    userEmail: 'risk@nfq.es',
    userName: 'Risk Team',
    action: 'IMPORT_METHODOLOGY',
    module: 'METHODOLOGY',
    description: 'Imported refreshed methodology rules',
    details: { rows: 24 },
  },
];

describe('auditLogUtils', () => {
  it('classifies common audit action families consistently', () => {
    expect(resolveAuditActionFamily('LOGIN')).toBe('ACCESS');
    expect(resolveAuditActionFamily('DELETE_DEAL')).toBe('DELETE');
    expect(resolveAuditActionFamily('IMPORT_METHODOLOGY')).toBe('CREATE');
  });

  it('filters by module, action family, and free text including payload', () => {
    const filtered = filterAuditEntries(auditEntries, {
      ...DEFAULT_AUDIT_FILTERS,
      module: 'METHODOLOGY',
      actionFamily: 'CREATE',
      searchTerm: 'rows',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('3');
  });

  it('summarizes visible entries for the dashboard header', () => {
    expect(summarizeAuditEntries(auditEntries)).toEqual({
      total: 3,
      destructiveCount: 1,
      accessCount: 1,
      modules: 3,
    });
  });

  it('builds unique sorted module options and readable payload output', () => {
    expect(getAuditModuleOptions(auditEntries)).toEqual(['AUTH', 'BLOTTER', 'METHODOLOGY']);
    expect(formatAuditDetails({ dealId: 'TRD-1' })).toContain('TRD-1');
    expect(formatAuditDetails({})).toBe('No additional payload.');
  });
});
