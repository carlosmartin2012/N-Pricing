
export type MethodologyType = 'MatchedMaturity' | 'MovingAverage' | 'RateCard' | 'ZeroDiscount';

export interface ClientEntity {
  id: string;
  name: string;
  type: 'Corporate' | 'Retail' | 'SME' | 'Institution' | 'Gov';
  segment: string;
  rating: string;
}

export interface ProductDefinition {
  id: string;
  name: string;
  category: 'Asset' | 'Liability' | 'Off-Balance';
  defaultAmortization?: string;
}

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
}

// Unify FtpRateCard (remove duplicate)

// --- LIQUIDITY CURVE INTERFACES (V4.0) ---

export interface LiquidityCurvePoint {
  tenor: string;
  wholesaleSpread: number; // Market spread (bps)
  termLP: number;          // Managed spread with floors (bps)
}

export interface DualLiquidityCurve {
  currency: string;
  lastUpdate: string;
  points: LiquidityCurvePoint[];
}

// --- ALM ANALYTICS INTERFACES (V4.1) ---

export interface BasisSpreadPoint {
  tenor: string;
  libor: number;
  ois: number;
  basis: number; // LIBOR - OIS
}

export interface FundingPoint {
  tenor: string;
  secured: number;
  unsecured: number;
}

export interface CLCProfilePoint {
  profile: string;
  cost: number; // bps
  outflow: number; // %
}

export interface LiquidityDashboardData {
  basisSpreads: BasisSpreadPoint[];
  fundingCurves: FundingPoint[];
  clcProfiles: CLCProfilePoint[];
  kpis: {
    hqlaCost: number;
    nsfrFloorPremium: number;
    securedBenefit: number;
    lcrRatio: number;
    nsfrRatio: number;
  };
  history: {
    date: string;
    lcr: number;
    nsfr: number;
  }[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Trader' | 'Risk_Manager' | 'Auditor';
  status: 'Active' | 'Inactive' | 'Locked';
  lastLogin: string;
  department: string;
}

// Unified Transaction Interface (used for both Pricing Calculator and Blotter)
export interface Transaction {
  id?: string; // Optional for new deals in calculator before saving
  status?: 'Booked' | 'Pending' | 'Rejected' | 'Review';
  desk?: string; // usually businessLine

  // Client Data
  clientId: string;
  // clientName removed - looked up from ClientEntity
  clientType: string;

  // Organization
  businessUnit: string;
  fundingBusinessUnit: string;
  businessLine: string;

  // Product
  productType: string;
  category: 'Asset' | 'Liability' | 'Off-Balance';
  currency: string;
  amount: number;

  // Time
  startDate: string;
  durationMonths: number;
  amortization: 'Bullet' | 'French' | 'Linear';
  repricingFreq: 'Daily' | 'Monthly' | 'Quarterly' | 'Fixed';

  // Economics
  marginTarget: number;
  behaviouralModelId?: string;

  // Regulatory & Capital
  riskWeight: number;
  capitalRatio: number;
  targetROE: number;
  operationalCostBps: number;
  lcrOutflowPct?: number;
  isOperationalSegment?: boolean; // V4.0: For deposit split logic

  // LCR / NSFR Data
  drawnAmount?: number;
  undrawnAmount?: number; // V4.0: For credit line CLC (This field already existed, adding comment)
  isCommitted?: boolean;
  lcrClassification?: 'Corp_Credit' | 'Corp_Liquidity' | 'IFI_Liquidity' | 'Retail_Stable' | 'Retail_Other';
  depositType?: 'Operational' | 'Non_Operational';
  behavioralMaturityOverride?: number;

  // ESG
  transitionRisk: 'Brown' | 'Amber' | 'Neutral' | 'Green';
  physicalRisk: 'High' | 'Medium' | 'Low';

  // Audit Results (Internal/Persisted)
  liquiditySpread?: number;
  _liquidityPremiumDetails?: number;
  _clcChargeDetails?: number;
  description?: string; // V4.0: For demo identification
}

export interface ReplicationTranche {
  term: string;
  weight: number;
  spread: number;
}

export interface BehaviouralModel {
  id: string;
  name: string;
  type: 'NMD_Replication' | 'Prepayment_CPR';
  // Caterpillar is now a "mode" within NMD_Replication
  nmdMethod?: 'Parametric' | 'Caterpillar';
  description: string;

  // NMD Parametric
  coreRatio?: number;
  decayRate?: number;
  betaFactor?: number;

  // NMD Caterpillar
  replicationProfile?: ReplicationTranche[];

  // Prepayment Specific
  cpr?: number;
  penaltyExempt?: number;
}

export interface ApprovalMatrixConfig {
  autoApprovalThreshold: number;
  l1Threshold: number;
  l2Threshold: number;
}

export interface TransitionRateCard {
  id: number;
  classification: 'Brown' | 'Amber' | 'Neutral' | 'Green';
  sector: string;
  adjustmentBps: number;
  description: string;
}

export interface PhysicalRateCard {
  id: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  locationType: string;
  adjustmentBps: number;
  description: string;
}

export interface FtpRateCard {
  id: string;
  name: string;
  type: 'Liquidity' | 'Basis' | 'Commercial' | 'Credit';
  currency: string;
  points: YieldCurvePoint[];
}

export interface FTPResult {
  baseRate: number;
  liquiditySpread: number;
  _liquidityPremiumDetails: number;
  _clcChargeDetails: number;
  strategicSpread: number;
  optionCost: number;
  regulatoryCost: number;
  lcrCost?: number;
  nsfrCost?: number;
  termAdjustment?: number;
  operationalCost: number;
  capitalCharge: number;
  esgTransitionCharge: number;
  esgPhysicalCharge: number;
  floorPrice: number;
  technicalPrice: number;
  targetPrice: number;
  totalFTP: number;
  finalClientRate: number;
  raroc: number;
  economicProfit: number;
  approvalLevel: 'Auto' | 'L1_Manager' | 'L2_Committee' | 'Rejected';
  accountingEntry: {
    source: string;
    dest: string;
    amountDebit: number;
    amountCredit: number;
  };
  matchedMethodology: MethodologyType;
  matchReason: string;
}

export type ViewState = 'CALCULATOR' | 'BLOTTER' | 'CONFIG' | 'MARKET_DATA' | 'ACCOUNTING' | 'BEHAVIOURAL' | 'MANUAL' | 'USER_MGMT' | 'AI_LAB' | 'METHODOLOGY' | 'AUDIT_LOG' | 'SHOCKS' | 'REPORTING';

export interface YieldCurvePoint {
  tenor: string;
  rate: number;
  prev?: number;
}

export interface GeneralRule {
  id: number;
  businessUnit: string; // Pivot Axis
  product: string;
  segment: string;
  tenor: string;
  baseMethod: string; // V4.3: Supports formula strings
  baseReference?: string; // New: Curve ID for Base
  spreadMethod: string; // V4.3: Supports formula strings
  liquidityReference?: string; // New: Curve ID for Liquidity
  strategicSpread: number;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  action: string;
  module: ViewState;
  description: string;
  details?: any;
}
