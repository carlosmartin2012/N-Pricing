import { monitoringService } from './monitoring';

export const auditService = {
  fetchAuditLog: monitoringService.fetchAuditLog,
  fetchAuditLogPaginated: monitoringService.fetchAuditLogPaginated,
  addAuditEntry: monitoringService.addAuditEntry,
};
