import type { AuditEntry } from '../../types';

export type AuditActionFamily =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ACCESS'
  | 'TEST'
  | 'EXPORT'
  | 'OTHER';

export type AuditActionFamilyFilter = AuditActionFamily | 'ALL';

export interface AuditFilters {
  searchTerm: string;
  module: string;
  actionFamily: AuditActionFamilyFilter;
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  searchTerm: '',
  module: 'ALL',
  actionFamily: 'ALL',
};

export const AUDIT_ACTION_FAMILY_OPTIONS: Array<{
  value: AuditActionFamilyFilter;
  label: string;
}> = [
  { value: 'ALL', label: 'All Actions' },
  { value: 'CREATE', label: 'Create / Import' },
  { value: 'UPDATE', label: 'Update / Approve' },
  { value: 'DELETE', label: 'Delete / Remove' },
  { value: 'ACCESS', label: 'Access / Session' },
  { value: 'TEST', label: 'Diagnostics' },
  { value: 'EXPORT', label: 'Export / Download' },
  { value: 'OTHER', label: 'Other' },
];

export function resolveAuditActionFamily(action: string): AuditActionFamily {
  const normalizedAction = action.trim().toUpperCase();

  if (
    normalizedAction.startsWith('CREATE') ||
    normalizedAction.startsWith('IMPORT') ||
    normalizedAction.startsWith('ADD')
  ) {
    return 'CREATE';
  }

  if (
    normalizedAction.startsWith('UPDATE') ||
    normalizedAction.startsWith('APPLY') ||
    normalizedAction.startsWith('SUBMIT') ||
    normalizedAction.startsWith('APPROVE') ||
    normalizedAction.startsWith('REWORK') ||
    normalizedAction.startsWith('REJECT')
  ) {
    return 'UPDATE';
  }

  if (
    normalizedAction.startsWith('DELETE') ||
    normalizedAction.startsWith('REMOVE')
  ) {
    return 'DELETE';
  }

  if (
    normalizedAction.startsWith('LOGIN') ||
    normalizedAction.startsWith('LOGOUT') ||
    normalizedAction.startsWith('SESSION')
  ) {
    return 'ACCESS';
  }

  if (normalizedAction.startsWith('TEST')) {
    return 'TEST';
  }

  if (
    normalizedAction.startsWith('EXPORT') ||
    normalizedAction.startsWith('DOWNLOAD')
  ) {
    return 'EXPORT';
  }

  return 'OTHER';
}

export function getAuditActionTextClass(action: string) {
  switch (resolveAuditActionFamily(action)) {
    case 'CREATE':
      return 'text-emerald-400';
    case 'UPDATE':
      return 'text-amber-400';
    case 'DELETE':
      return 'text-rose-400';
    case 'ACCESS':
      return 'text-cyan-400';
    case 'TEST':
      return 'text-violet-400';
    case 'EXPORT':
      return 'text-indigo-400';
    default:
      return 'text-slate-300';
  }
}

export function getAuditBadgeVariant(
  action: string,
): 'success' | 'warning' | 'danger' | 'secondary' | 'outline' {
  switch (resolveAuditActionFamily(action)) {
    case 'CREATE':
      return 'success';
    case 'UPDATE':
      return 'warning';
    case 'DELETE':
      return 'danger';
    case 'ACCESS':
    case 'TEST':
    case 'EXPORT':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function formatAuditTimestamp(timestamp: string) {
  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return 'Invalid timestamp';
  }

  return parsedDate.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatAuditDetails(details: unknown) {
  if (details === null || details === undefined) {
    return 'No additional payload.';
  }

  if (typeof details === 'string') {
    return details.trim() || 'No additional payload.';
  }

  if (typeof details !== 'object') {
    return String(details);
  }

  if (Array.isArray(details) && !details.length) {
    return 'No additional payload.';
  }

  if (!Array.isArray(details) && !Object.keys(details).length) {
    return 'No additional payload.';
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return 'Payload unavailable.';
  }
}

export function filterAuditEntries(entries: AuditEntry[], filters: AuditFilters) {
  const normalizedSearch = filters.searchTerm.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filters.module !== 'ALL' && entry.module !== filters.module) {
      return false;
    }

    const actionFamily = resolveAuditActionFamily(entry.action);
    if (filters.actionFamily !== 'ALL' && actionFamily !== filters.actionFamily) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const searchableContent = [
      entry.userName,
      entry.userEmail,
      entry.action,
      entry.module,
      entry.description,
      formatAuditDetails(entry.details),
    ]
      .join(' ')
      .toLowerCase();

    return searchableContent.includes(normalizedSearch);
  });
}

export function getAuditModuleOptions(entries: AuditEntry[]) {
  return Array.from(new Set(entries.map((entry) => entry.module))).sort((left, right) =>
    left.localeCompare(right),
  );
}

export function summarizeAuditEntries(entries: AuditEntry[]) {
  return {
    total: entries.length,
    destructiveCount: entries.filter(
      (entry) => resolveAuditActionFamily(entry.action) === 'DELETE',
    ).length,
    accessCount: entries.filter(
      (entry) => resolveAuditActionFamily(entry.action) === 'ACCESS',
    ).length,
    modules: new Set(entries.map((entry) => entry.module)).size,
  };
}
