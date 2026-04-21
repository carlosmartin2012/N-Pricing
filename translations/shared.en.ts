/**
 * Shared namespace (EN) — common UI labels used across buckets.
 *
 * Kept small on purpose: only genuinely cross-cutting strings (buttons,
 * status, time formatters). If a string is only used by one bucket, it
 * belongs in that bucket's namespace.
 */

interface SharedPack {
  [key: string]: string;
}

export const sharedEn: SharedPack = {
  // Actions
  sharedSave: 'Save',
  sharedCancel: 'Cancel',
  sharedDelete: 'Delete',
  sharedEdit: 'Edit',
  sharedClose: 'Close',
  sharedRetry: 'Retry',
  sharedLoading: 'Loading…',
  sharedRefresh: 'Refresh',
  sharedExport: 'Export',
  sharedImport: 'Import',
  sharedApply: 'Apply',

  // Status / severity
  sharedStatusOk: 'OK',
  sharedStatusWarning: 'Warning',
  sharedStatusError: 'Error',
  sharedStatusPending: 'Pending',

  // Common labels
  sharedYes: 'Yes',
  sharedNo: 'No',
  sharedNA: 'N/A',
  sharedEmpty: 'No data',
  sharedAll: 'All',
  sharedNone: 'None',

  // Time
  sharedToday: 'Today',
  sharedYesterday: 'Yesterday',
  sharedThisWeek: 'This week',
  sharedThisMonth: 'This month',

  // Errors
  sharedErrorGeneric: 'Something went wrong. Retry or contact support.',
  sharedErrorNetwork: 'Network error. Check your connection.',
  sharedErrorForbidden: 'You do not have permission for this action.',
};

export type SharedTranslationKeys = typeof sharedEn;
