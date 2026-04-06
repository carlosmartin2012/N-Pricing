export type ReportType =
  | 'portfolio_summary'
  | 'lcr_nsfr'
  | 'raroc_breakdown'
  | 'maturity_ladder'
  | 'nii_sensitivity'
  | 'pricing_analytics'
  | 'executive_summary';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

export interface ReportSchedule {
  id: string;
  entityId: string;
  name: string;
  reportType: ReportType;
  frequency: ReportFrequency;
  format: ReportFormat;
  recipients: string[];
  config: Record<string, unknown>;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ReportRun {
  id: string;
  scheduleId: string;
  entityId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  outputUrl: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}
