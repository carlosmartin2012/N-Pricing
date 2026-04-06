export interface ScenarioMetrics {
  lcr: number;
  nsfr: number;
  lpValue: number;
  clc: number;
  wlp: number;
  impactHQLA: number;
  impactOutflows: number;
}

export interface PortfolioMetrics {
  hqla: number;
  netOutflows: number;
  asf: number;
  rsf: number;
  lcr: number;
  nsfr: number;
  totalAssetVolume: number;
  totalLiabilityVolume: number;
  dealCount: number;
}

export interface PortfolioBusinessUnitSummary {
  bu: string;
  buName: string;
  volume: number;
  count: number;
  avgMargin: number;
}

export interface LcrHistoryPoint {
  date: string;
  lcr: number;
  simulated: number;
}

export interface FundingCurveDatum {
  tenor: string;
  wholesale: number;
  lp: number;
  simWholesale: number;
  simLP: number;
  basis: number;
}

export type FundingCollateralType = 'Secured' | 'Unsecured';
