/**
 * API layer — Report Schedules
 *
 * Wraps Supabase calls for `report_schedules` and `report_runs` tables
 * with typed inputs/outputs and consistent error handling via `safeSupabaseCall`.
 */

import type { ReportSchedule, ReportRun } from '../types/reportSchedule';
import { safeSupabaseCall } from '../utils/validation';
import { supabase } from '../utils/supabase/shared';
import { mapReportScheduleFromDB, mapReportScheduleToDB, mapReportRunFromDB } from './mappers';

export async function listSchedules(entityId?: string): Promise<ReportSchedule[]> {
  const { data } = await safeSupabaseCall(
    async () => {
      let q = supabase.from('report_schedules').select('*').order('created_at', { ascending: false });
      if (entityId) q = q.eq('entity_id', entityId);
      return q;
    },
    [],
    'listSchedules',
  );
  return (data as Record<string, unknown>[]).map(mapReportScheduleFromDB);
}

export async function upsertSchedule(schedule: Partial<ReportSchedule>): Promise<ReportSchedule | null> {
  const { data, error } = await safeSupabaseCall(
    async () => supabase.from('report_schedules').upsert(mapReportScheduleToDB(schedule)).select(),
    null,
    'upsertSchedule',
  );
  if (error || !data) return null;
  const rows = data as Record<string, unknown>[];
  return rows.length > 0 ? mapReportScheduleFromDB(rows[0]) : null;
}

export async function deleteSchedule(id: string): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('report_schedules').delete().eq('id', id),
    null,
    'deleteSchedule',
  );
}

export async function toggleSchedule(id: string, isActive: boolean): Promise<void> {
  await safeSupabaseCall(
    async () => supabase.from('report_schedules').update({ is_active: isActive }).eq('id', id),
    null,
    'toggleSchedule',
  );
}

export async function listRuns(scheduleId: string): Promise<ReportRun[]> {
  const { data } = await safeSupabaseCall(
    async () =>
      supabase
        .from('report_runs')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('started_at', { ascending: false })
        .limit(20),
    [],
    'listRuns',
  );
  return (data as Record<string, unknown>[]).map(mapReportRunFromDB);
}
