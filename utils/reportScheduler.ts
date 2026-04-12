import type { ReportFrequency, ReportSchedule } from '../types';

/**
 * Compute the next run date for a report schedule based on its frequency.
 */
export function computeNextRun(
  frequency: ReportFrequency,
  from: Date = new Date(),
): Date {
  const next = new Date(from);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0); // 06:00 next day
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 - next.getDay() + 1)); // next Monday
      next.setHours(6, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1, 1); // 1st of next month
      next.setHours(6, 0, 0, 0);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3 - (next.getMonth() % 3), 1);
      next.setHours(6, 0, 0, 0);
      break;
  }

  return next;
}

/**
 * Check which schedules are due for execution.
 */
export function getDueSchedules(
  schedules: ReportSchedule[],
  now: Date = new Date(),
): ReportSchedule[] {
  return schedules.filter((s) => {
    if (!s.isActive) return false;
    if (!s.nextRunAt) return true; // never run
    return new Date(s.nextRunAt) <= now;
  });
}

/**
 * Create a new schedule with computed nextRunAt.
 */
export function createSchedule(
  partial: Omit<ReportSchedule, 'id' | 'lastRunAt' | 'nextRunAt' | 'createdAt'>,
): ReportSchedule {
  return {
    ...partial,
    id: `sched-${Date.now().toString(36)}`,
    lastRunAt: null,
    nextRunAt: computeNextRun(partial.frequency).toISOString(),
    createdAt: new Date().toISOString(),
  };
}

/** Pre-configured schedule templates */
export const SCHEDULE_TEMPLATES: Omit<ReportSchedule, 'id' | 'entityId' | 'lastRunAt' | 'nextRunAt' | 'createdAt' | 'createdBy'>[] = [
  {
    name: 'Daily Portfolio Summary',
    reportType: 'portfolio_summary',
    frequency: 'daily',
    format: 'pdf',
    recipients: [],
    config: {},
    isActive: true,
  },
  {
    name: 'Weekly LCR/NSFR Report',
    reportType: 'lcr_nsfr',
    frequency: 'weekly',
    format: 'xlsx',
    recipients: [],
    config: {},
    isActive: true,
  },
  {
    name: 'Monthly Executive Summary',
    reportType: 'executive_summary',
    frequency: 'monthly',
    format: 'pdf',
    recipients: [],
    config: {},
    isActive: true,
  },
  {
    name: 'Quarterly NII Sensitivity',
    reportType: 'nii_sensitivity',
    frequency: 'quarterly',
    format: 'xlsx',
    recipients: [],
    config: {},
    isActive: true,
  },
];
