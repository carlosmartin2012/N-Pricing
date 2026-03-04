
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
  curveType?: 'unsecured' | 'secured'; // Gap 8: secured vs unsecured LP
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
  ead?: number;                    // Gap 16: Exposure at Default (separate from amount)
  feeIncome?: number;              // Gap 6: annual fee income for RAROC

  // Repricing (Gap 15)
  repricingMonths?: number;        // months until next repricing (RM) — distinct from DTM

  // Collateral (Gap 8)
  collateralType?: 'None' | 'Sovereign' | 'Corporate' | 'Cash' | 'Real_Estate';
  haircutPct?: number;             // collateral haircut % for secured LP

  // Regulatory & Capital
  riskWeight: number;
  capitalRatio: number;
  targetROE: number;
  operationalCostBps: number;
  lcrOutflowPct?: number;
  isOperationalSegment?: boolean; // V4.0: For deposit split logic
  depositStability?: 'Stable' | 'Semi_Stable' | 'Non_Stable'; // Gap 14: deposit classification

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
  // V5.0: Granular FTP decomposition
  irrbbCharge?: number;            // IRRBB component (base rate %)
  liquidityCharge?: number;        // LP component (%)
  liquidityRecharge?: number;      // LR buffer allocation (%)
  capitalIncome?: number;          // income from regulatory capital
  formulaUsed?: string;            // formula string applied (for display)
  behavioralMaturityUsed?: number; // effective BM used for interpolation
  incentivisationAdj?: number;     // subsidy/incentive adjustment (%)
}

export interface RAROCInputs {
  transactionId: string;
  loanAmt: number;
  osAmt: number;
  ead: number;
  interestRate: number;
  interestSpread: number;
  cofRate: number;
  rwa: number;
  ecl: number;
  feeIncome: number;
  operatingCostPct: number;
  riskFreeRate: number;
  opRiskCapitalCharge: number;
  minRegCapitalReq: number;
  hurdleRate: number;
  pillar2CapitalCharge: number;
}

export type ViewState = 'CALCULATOR' | 'BLOTTER' | 'CONFIG' | 'MARKET_DATA' | 'ACCOUNTING' | 'BEHAVIOURAL' | 'MANUAL' | 'USER_MGMT' | 'AI_LAB' | 'METHODOLOGY' | 'AUDIT_LOG' | 'SHOCKS' | 'REPORTING' | 'RAROC';

export interface YieldCurvePoint {
  tenor: string;
  rate: number;
  prev?: number;
}

export type FormulaBaseRateKey = 'DTM' | 'BM' | 'RM' | 'MIN_BM_RM';
export type FormulaLPType = 'LP_DTM' | 'LP_BM' | '50_50_DTM_1Y' | 'SECURED_LP' | 'BLENDED';

export interface FormulaSpec {
  baseRateKey: FormulaBaseRateKey;
  lpFormula: FormulaLPType;
  lpCurveType?: 'unsecured' | 'secured';
  sign?: 1 | -1; // +1 for assets, -1 for deposits
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
  formulaSpec?: FormulaSpec; // V5.0: Product-specific formula specification
}

// --- V5.0: ALM CONFIG TYPES ---

export interface IncentivisationRule {
  id: string;
  productType: string;
  segment: string;
  subsidyBps: number;       // negative = discount
  validFrom: string;
  validTo: string;
  maxVolume?: number;
  description: string;
}

export interface SDRConfig {
  stableDepositRatio: number;    // 0-1
  sdrFloor: number;              // minimum SDR for benefit
  sdrImpactMultiplier: number;   // how much SDR reduces LP
  externalFundingPct: number;    // for blended LP curve
}

export interface LRConfig {
  totalBufferCostBps: number;           // total HQLA cost to allocate
  riskAppetiteAddon: number;            // multiplier (e.g. 1.3)
  buAllocations: Record<string, number>; // BU id -> allocation weight
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
