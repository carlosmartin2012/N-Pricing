export const AUDIT_LOG_CHANGED_EVENT = 'n-pricing-audit-log-changed';

export function emitAuditLogChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUDIT_LOG_CHANGED_EVENT));
}
