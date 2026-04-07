import type { ReportSchedule, ReportRun } from '../types/reportSchedule';
import { apiGet, apiPost, apiPatch, apiDelete } from '../utils/apiFetch';
import { mapReportScheduleFromDB, mapReportScheduleToDB, mapReportRunFromDB } from './mappers';

export async function listSchedules(entityId?: string): Promise<ReportSchedule[]> {
  try {
    const qs = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : '';
    const rows = await apiGet<Record<string, unknown>[]>(`/report-schedules${qs}`);
    return rows.map(mapReportScheduleFromDB);
  } catch { return []; }
}

export async function upsertSchedule(schedule: Partial<ReportSchedule>): Promise<ReportSchedule | null> {
  try {
    const row = await apiPost<Record<string, unknown>>('/report-schedules', mapReportScheduleToDB(schedule));
    return row ? mapReportScheduleFromDB(row) : null;
  } catch { return null; }
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
    return rows.map(mapReportRunFromDB);
  } catch { return []; }
}
