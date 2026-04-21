import type { GovernanceTranslationKeys } from './governance.en';

export const governanceEs: GovernanceTranslationKeys = {
  govMethodologyHeader: 'Metodología',
  govMethodologyActiveVersion: 'Versión activa',
  govMethodologyNextPromotion: 'Promoción programada',
  govMethodologyChangeRequests: 'Solicitudes de cambio',
  govMethodologyCompare: 'Comparar versiones',

  govModelInventoryHeader: 'Inventario de modelos',
  govModelInventoryFilterKind: 'Filtrar por tipo',
  govModelInventoryFilterStatus: 'Filtrar por estado',
  govModelInventoryAuthor: 'Autor',
  govModelInventoryValidationDoc: 'Documento de validación',
  govModelInventoryStatusDraft: 'Borrador',
  govModelInventoryStatusActive: 'Activo',
  govModelInventoryStatusRetired: 'Retirado',

  govDossiersHeader: 'Dossiers firmados',
  govDossiersNewDossier: 'Nuevo dossier',
  govDossiersSignature: 'Firma HMAC',
  govDossiersVerify: 'Verificar firma',
  govDossiersPayloadHash: 'Hash del JSON canónico',

  govEscalationsHeader: 'Escalados a comité',
  govEscalationsPending: 'Pendientes',
  govEscalationsOverdue: 'Vencidos',
  govEscalationsResolved: 'Resueltos',
  govEscalationsSweep: 'Ejecutar barrido de escalados',

  govAuditHeader: 'Registro de auditoría',
  govAuditExport: 'Exportar a CSV',
  govAuditFilterUser: 'Usuario',
  govAuditFilterAction: 'Acción',
  govAuditEmpty: 'Ningún evento coincide con el filtro.',
};
