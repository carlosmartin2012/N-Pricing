import type { ReportSchedule, ReportRun } from '../types/reportSchedule';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/apiFetch';
import { createLogger } from '../utils/logger';
import { mapReportScheduleFromDB, mapReportScheduleToDB, mapReportRunFromDB } from './mappers';

const log = createLogger('api/reportSchedules');

export async function listSchedules(entityId?: string): Promise<ReportSchedule[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/report-schedules${qs}`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapReportScheduleFromDB);
  } catch (err) {
    log.warn('listSchedules failed — returning empty list', { entityId, error: String(err) });
    return [];
  }
}

export async function upsertSchedule(schedule: Partial<ReportSchedule>): Promise<ReportSchedule | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/report-schedules', mapReportScheduleToDB(schedule));
    return row ? mapReportScheduleFromDB(row) : null;
  } catch (err) {
    log.error('upsertSchedule failed', { scheduleId: schedule.id }, err as Error);
    return null;
  }
}

export async function deleteSchedule(id: string): Promise<void> {
  await apiDelete(`/report-schedules/${id}`);
}

export async function toggleSchedule(id: string, isActive: boolean): Promise<void> {
  await apiPatch(`/report-schedules/${id}/toggle`, { is_active: isActive });
}

export async function listRunsForSchedule(scheduleId: string): Promise<ReportRun[]> {
  try {
    const rows = await apiGet<Record<string, unknown>[]>(`/report-schedules/${scheduleId}/runs`);
    if (!Array.isArray(rows)) return [];
    return rows.map(mapReportRunFromDB);
  } catch (err) {
    log.warn('listRunsForSchedule failed — returning empty list', { scheduleId, error: String(err) });
    return [];
  }
}
