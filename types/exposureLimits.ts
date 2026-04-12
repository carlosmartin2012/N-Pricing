export type LimitDimension = 'client' | 'sector' | 'product' | 'currency' | 'business_unit' | 'country';
export type LimitStatus = 'within' | 'approaching' | 'breached';

export interface ExposureLimit {
  id: string;
  entityId: string;
  name: string;
  dimension: LimitDimension;
  dimensionValue: string;
  softLimitAmount: number;
  hardLimitAmount: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface LimitCheckResult {
  limit: ExposureLimit;
  currentUtilization: number;
  utilizationPct: number;
  status: LimitStatus;
  headroom: number;
  message: string;
}

export interface LimitUtilizationSummary {
  totalLimits: number;
  within: number;
  approaching: number;
  breached: number;
  results: LimitCheckResult[];
}
