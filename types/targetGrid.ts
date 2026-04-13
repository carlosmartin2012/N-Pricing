/**
 * Types for the Target Pricing Grid (Ola 1).
 *
 * The target grid materializes the pricing methodology as a navigable,
 * versioned rate card. Each governance-approved methodology change freezes
 * a snapshot with pre-computed target rates per cohort.
 */

import type { FTPResult, Transaction } from '../types';

// ---------------------------------------------------------------------------
// Dimension values
// ---------------------------------------------------------------------------

export type TenorBucket = '0-1Y' | '1-3Y' | '3-5Y' | '5-10Y' | '10Y+';

export const TENOR_BUCKETS: TenorBucket[] = ['0-1Y', '1-3Y', '3-5Y', '5-10Y', '10Y+'];

/** Maps a tenor bucket to a representative tenor in months for canonical deals */
export const TENOR_BUCKET_MONTHS: Record<TenorBucket, number> = {
  '0-1Y': 6,
  '1-3Y': 24,
  '3-5Y': 48,
  '5-10Y': 84,
  '10Y+': 180,
};

// ---------------------------------------------------------------------------
// Methodology Snapshot
// ---------------------------------------------------------------------------

export interface MethodologySnapshot {
  id: string;
  version: string;
  approvedAt: string;
  approvedBy?: string;
  governanceRequestId?: string;
  methodologyHash: string;
  notes?: string;
  entityId?: string;
  isCurrent: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Target Grid Cell
// ---------------------------------------------------------------------------

export interface TargetGridCell {
  id: string;
  snapshotId: string;
  product: string;
  segment: string;
  tenorBucket: TenorBucket;
  currency: string;
  entityId?: string;
  canonicalDealInput: Partial<Transaction>;
  ftp: number;
  liquidityPremium: number | null;
  capitalCharge: number | null;
  esgAdjustment: number | null;
  targetMargin: number;
  targetClientRate: number;
  targetRaroc: number;
  /** Full FTP breakdown per 19 gaps (stored as JSON) */
  components: FTPResult;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Canonical Deal Template
// ---------------------------------------------------------------------------

export interface CanonicalDealTemplate {
  id: string;
  product: string;
  segment: string;
  tenorBucket: TenorBucket;
  currency: string;
  entityId?: string;
  /** Template values to merge into a Transaction when synthesizing a canonical deal */
  template: CanonicalTemplateValues;
  editableByRole: string[];
  updatedAt: string;
}

export interface CanonicalTemplateValues {
  amount: number;
  tenorMonths: number;
  rating: string;
  clientType: string;
  ltv?: number;
  riskWeight: number;
  capitalRatio: number;
  targetROE: number;
  operationalCostBps: number;
  amortization: Transaction['amortization'];
  repricingFreq: Transaction['repricingFreq'];
  transitionRisk: Transaction['transitionRisk'];
  physicalRisk: Transaction['physicalRisk'];
  greenFormat?: Transaction['greenFormat'];
  collateralType?: Transaction['collateralType'];
  haircutPct?: number;
  marginTarget: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Grid Filters
// ---------------------------------------------------------------------------

export interface GridFilters {
  products?: string[];
  segments?: string[];
  tenorBuckets?: TenorBucket[];
  currencies?: string[];
  entityId?: string;
}

// ---------------------------------------------------------------------------
// Snapshot Diff
// ---------------------------------------------------------------------------

export interface GridDiff {
  product: string;
  segment: string;
  tenorBucket: TenorBucket;
  currency: string;
  entityId?: string;
  fromCell: TargetGridCell | null;
  toCell: TargetGridCell | null;
  ftpDiffBps: number;
  marginDiffBps: number;
  clientRateDiffBps: number;
  rarocDiffPp: number;
  isNew: boolean;
  isRemoved: boolean;
  isSignificant: boolean;
}

export interface DiffThresholds {
  ftpBps: number;
  marginBps: number;
  clientRateBps: number;
  rarocPp: number;
}

export const DEFAULT_DIFF_THRESHOLDS: DiffThresholds = {
  ftpBps: 5,
  marginBps: 5,
  clientRateBps: 5,
  rarocPp: 0.5,
};

// ---------------------------------------------------------------------------
// Compute job
// ---------------------------------------------------------------------------

export interface GridComputeOptions {
  snapshotId: string;
  entityId?: string;
  batchSize?: number;
  onProgress?: (computed: number, total: number) => void;
}

export interface GridComputeResult {
  snapshotId: string;
  cellCount: number;
  durationMs: number;
  errors: { cohort: string; error: string }[];
}
