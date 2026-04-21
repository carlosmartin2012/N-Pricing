/**
 * Governance namespace (EN) — Methodology, Model Inventory, Dossiers,
 * Escalations, Audit.
 *
 * SR 11-7 / EBA-driven labels used in the Governance sidebar bucket.
 * Keys here are new; the monolith retains any legacy governance key until
 * the per-component migration sweep.
 */

interface GovernancePack {
  [key: string]: string;
}

export const governanceEn: GovernancePack = {
  // Methodology
  govMethodologyHeader: 'Methodology',
  govMethodologyActiveVersion: 'Active version',
  govMethodologyNextPromotion: 'Scheduled promotion',
  govMethodologyChangeRequests: 'Change requests',
  govMethodologyCompare: 'Compare versions',

  // Model inventory
  govModelInventoryHeader: 'Model Inventory',
  govModelInventoryFilterKind: 'Filter by kind',
  govModelInventoryFilterStatus: 'Filter by status',
  govModelInventoryAuthor: 'Author',
  govModelInventoryValidationDoc: 'Validation document',
  govModelInventoryStatusDraft: 'Draft',
  govModelInventoryStatusActive: 'Active',
  govModelInventoryStatusRetired: 'Retired',

  // Dossiers (signed committee packets)
  govDossiersHeader: 'Signed Dossiers',
  govDossiersNewDossier: 'New dossier',
  govDossiersSignature: 'HMAC signature',
  govDossiersVerify: 'Verify signature',
  govDossiersPayloadHash: 'Canonical JSON hash',

  // Escalations
  govEscalationsHeader: 'Committee Escalations',
  govEscalationsPending: 'Pending',
  govEscalationsOverdue: 'Overdue',
  govEscalationsResolved: 'Resolved',
  govEscalationsSweep: 'Run escalation sweep',

  // Audit log
  govAuditHeader: 'Audit log',
  govAuditExport: 'Export to CSV',
  govAuditFilterUser: 'User',
  govAuditFilterAction: 'Action',
  govAuditEmpty: 'No audit events match the filter.',
};

export type GovernanceTranslationKeys = typeof governanceEn;
