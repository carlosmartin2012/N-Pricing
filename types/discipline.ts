/**
 * Types for Pricing Discipline & Gap Analytics (Ola 2).
 *
 * Measures deviation of realized deals vs. target grid, detects margin
 * leakage and outliers, and provides originator scorecards and alerts.
 */

import type { TenorBucket } from './targetGrid';

// ---------------------------------------------------------------------------
// Cohort
// ---------------------------------------------------------------------------

export interface Cohort {
  product: string;
  segment: string;
  tenorBucket: TenorBucket;
  currency: string;
  entityId?: string;
}

// ---------------------------------------------------------------------------
// Tolerance Bands
// ---------------------------------------------------------------------------

export interface ToleranceBand {
  id: string;
  product?: string;
  segment?: string;
  tenorBucket?: string;
  currency?: string;
  entityId?: string;
  ftpBpsTolerance: number;
  rarocPpTolerance: number;
  marginBpsTolerance?: number;
  priority: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Deal Variance
// ---------------------------------------------------------------------------

export interface DealVariance {
  dealId: string;
  snapshotId: string;
  cohort: Cohort;
  targetFtp: number | null;
  realizedFtp: number | null;
  ftpVarianceBps: number | null;
  targetRaroc: number | null;
  realizedRaroc: number | null;
  rarocVariancePp: number | null;
  targetMargin: number | null;
  realizedMargin: number | null;
  marginVarianceBps: number | null;
  leakageEur: number | null;
  outOfBand: boolean;
  bandAppliedId?: string;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Pricing Exception
// ---------------------------------------------------------------------------

export type PricingExceptionStatus = 'pending' | 'approved' | 'rejected';

export type PricingExceptionReasonCode =
  | 'relationship'
  | 'strategic_client'
  | 'market_spread'
  | 'competitive_pressure'
  | 'volume_commitment'
  | 'cross_sell'
  | 'other';

export interface PricingException {
  id: string;
  dealId: string;
  reasonCode: PricingExceptionReasonCode;
  reasonDetail: string;
  requestedBy: string;
  approvedBy?: string;
  status: PricingExceptionStatus;
  createdAt: string;
  resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// KPIs & Aggregates
// ---------------------------------------------------------------------------

export interface DisciplineKpis {
  totalDeals: number;
  inBandCount: number;
  inBandPct: number;
  outOfBandCount: number;
  totalLeakageEur: number;
  leakageTrend: number; // vs. previous period (%)
  avgFtpVarianceBps: number;
  avgRarocVariancePp: number;
}

export interface CohortBreakdown {
  cohort: Cohort;
  dealCount: number;
  inBandPct: number;
  avgFtpVarianceBps: number;
  avgRarocVariancePp: number;
  totalLeakageEur: number;
  topOutlierDealIds: string[];
}

export interface OriginatorScorecard {
  originatorId: string;
  originatorName: string;
  originatorEmail: string;
  totalDeals: number;
  inBandPct: number;
  totalLeakageEur: number;
  avgFtpVarianceBps: number;
  avgRarocVariancePp: number;
  trend: {
    period: string;
    inBandPct: number;
    leakageEur: number;
  }[];
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface DisciplineFilters {
  entityId?: string;
  products?: string[];
  segments?: string[];
  tenorBuckets?: TenorBucket[];
  currencies?: string[];
  dateFrom?: string;
  dateTo?: string;
  originatorId?: string;
  outOfBandOnly?: boolean;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface VarianceFilters extends DisciplineFilters {
  sortBy?: 'leakage' | 'ftp_variance' | 'raroc_variance' | 'date';
  sortDir?: 'asc' | 'desc';
}

export interface PageOpts {
  page: number;
  pageSize: number;
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type DisciplineAlertType =
  | 'threshold_breach'
  | 'leakage_alert'
  | 'originator_drift';

export interface DisciplineAlert {
  id: string;
  type: DisciplineAlertType;
  cohort?: Cohort;
  originatorId?: string;
  message: string;
  threshold: number;
  actualValue: number;
  triggeredAt: string;
  acknowledged: boolean;
}
