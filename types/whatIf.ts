/**
 * Types for Methodology What-If & Optimization (Ola 3).
 *
 * Enables methodologists to simulate policy changes, calibrate
 * price-volume elasticity, backtest against historical portfolios,
 * and compare target grid vs. market benchmarks.
 */

import type { TargetGridCell, GridFilters } from './targetGrid';

// ---------------------------------------------------------------------------
// Sandbox Methodology
// ---------------------------------------------------------------------------

export type SandboxStatus = 'draft' | 'computing' | 'ready' | 'published' | 'archived';

export interface SandboxMethodology {
  id: string;
  name: string;
  description?: string;
  baseSnapshotId: string;
  status: SandboxStatus;
  diffs: SandboxDiff[];
  createdAt: string;
  createdByEmail: string;
  createdByName: string;
  updatedAt: string;
  entityId?: string;
}

export interface SandboxDiff {
  parameterPath: string;
  parameterLabel: string;
  currentValue: unknown;
  proposedValue: unknown;
  changeType: 'rule' | 'curve' | 'spread' | 'threshold' | 'esg' | 'capital';
}

// ---------------------------------------------------------------------------
// Impact Report
// ---------------------------------------------------------------------------

export interface ImpactReport {
  sandboxId: string;
  baseSnapshotId: string;
  sandboxSnapshotId?: string;
  computedAt: string;
  summary: ImpactSummary;
  cellImpacts: CellImpact[];
  portfolioImpact: PortfolioImpact;
}

export interface ImpactSummary {
  totalCellsAffected: number;
  avgFtpChangeBps: number;
  avgRarocChangePp: number;
  estimatedNiiDelta: number;
  estimatedNiiDeltaPct: number;
  volumeAtRisk: number;
  volumeAtRiskPct: number;
}

export interface CellImpact {
  product: string;
  segment: string;
  tenorBucket: string;
  currency: string;
  currentCell: TargetGridCell;
  proposedCell: TargetGridCell;
  ftpDeltaBps: number;
  rarocDeltaPp: number;
  clientRateDeltaBps: number;
  estimatedVolumeDelta?: number;
}

export interface PortfolioImpact {
  currentNii: number;
  projectedNii: number;
  niiDelta: number;
  currentAvgRaroc: number;
  projectedAvgRaroc: number;
  rarocDelta: number;
  dealCount: number;
  affectedDealCount: number;
}

// ---------------------------------------------------------------------------
// Elasticity Models
// ---------------------------------------------------------------------------

export type ElasticitySource = 'empirical' | 'expert' | 'hybrid';

export interface ElasticityModel {
  id: string;
  product: string;
  segment: string;
  currency?: string;
  entityId?: string;
  slope: number;
  intercept: number;
  rSquared: number | null;
  source: ElasticitySource;
  sampleSize?: number;
  calibratedAt: string;
  calibratedByEmail: string;
  validFrom: string;
  validTo?: string;
  notes?: string;
}

export interface ElasticityPrediction {
  priceDeltaBps: number;
  volumeDeltaPct: number;
  confidenceInterval?: { low: number; high: number };
}

// ---------------------------------------------------------------------------
// Backtesting
// ---------------------------------------------------------------------------

export type BacktestStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BacktestRun {
  id: string;
  name: string;
  description?: string;
  sandboxId?: string;
  snapshotId: string;
  dateFrom: string;
  dateTo: string;
  status: BacktestStatus;
  dealCount: number;
  filters?: GridFilters;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  entityId?: string;
  createdByEmail: string;
}

export interface BacktestResult {
  runId: string;
  simulatedPnl: number;
  actualPnl: number;
  pnlDelta: number;
  pnlDeltaPct: number;
  simulatedAvgRaroc: number;
  actualAvgRaroc: number;
  rarocDeltaPp: number;
  periodBreakdown: BacktestPeriod[];
  cohortBreakdown: BacktestCohort[];
}

export interface BacktestPeriod {
  period: string;
  simulatedPnl: number;
  actualPnl: number;
  delta: number;
  dealCount: number;
}

export interface BacktestCohort {
  product: string;
  segment: string;
  simulatedAvgRate: number;
  actualAvgRate: number;
  rateDeltaBps: number;
  dealCount: number;
  volumeEur: number;
}

// ---------------------------------------------------------------------------
// Market Benchmarks
// ---------------------------------------------------------------------------

export interface MarketBenchmark {
  id: string;
  productType: string;
  tenorBucket: string;
  clientType: string;
  currency: string;
  rate: number;
  source: string;
  asOfDate: string;
  notes?: string;
}

export interface BenchmarkComparison {
  product: string;
  segment: string;
  tenorBucket: string;
  currency: string;
  targetRate: number;
  benchmarkRate: number;
  deltaBps: number;
  source: string;
  asOfDate: string;
}

// ---------------------------------------------------------------------------
// Budget Targets
// ---------------------------------------------------------------------------

export interface BudgetTarget {
  id: string;
  product: string;
  segment: string;
  currency: string;
  entityId?: string;
  period: string;
  targetNii: number;
  targetVolume: number;
  targetRaroc: number;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetConsistency {
  product: string;
  segment: string;
  currency: string;
  budgetNii: number;
  gridImpliedNii: number;
  niiGap: number;
  niiGapPct: number;
  budgetVolume: number;
  gridImpliedVolume: number;
  volumeGap: number;
  volumeGapPct: number;
}
