export type { Group, Entity, EntityUser, EntityScope } from './types/entity';
export type { ReportSchedule, ReportRun, ReportType, ReportFrequency, ReportFormat } from './types/reportSchedule';
export type { PricingLineageRef } from './types/pricingLineage';
export type { AlertRule, AlertOperator } from './types/alertRule';

// Ola 1 — Target Grid
export type {
  TenorBucket, MethodologySnapshot, TargetGridCell, CanonicalDealTemplate,
  CanonicalTemplateValues, GridFilters, GridDiff, DiffThresholds,
  GridComputeOptions, GridComputeResult,
} from './types/targetGrid';
export { TENOR_BUCKETS, TENOR_BUCKET_MONTHS, DEFAULT_DIFF_THRESHOLDS } from './types/targetGrid';

// Ola 2 — Pricing Discipline
export type {
  Cohort, ToleranceBand, DealVariance, PricingException,
  PricingExceptionStatus, PricingExceptionReasonCode,
  DisciplineKpis, CohortBreakdown, OriginatorScorecard,
  DisciplineFilters, DateRange, VarianceFilters, PageOpts, Paged,
  DisciplineAlert, DisciplineAlertType,
} from './types/discipline';

// Ola 3 — What-If
export type {
  SandboxMethodology, SandboxDiff, SandboxStatus,
  ImpactReport, ImpactSummary, CellImpact, PortfolioImpact,
  ElasticityModel, ElasticitySource, ElasticityPrediction,
  BacktestRun, BacktestResult, BacktestStatus, BacktestPeriod, BacktestCohort,
  MarketBenchmark, BenchmarkComparison,
  BudgetTarget, BudgetConsistency,
} from './types/whatIf';

// Phase 0 — Tenancy, reproducibility snapshots, SLO
export type {
  EntityRole, TenancyErrorCode, TenancyContext, TenancyViolation,
  PricingSnapshotRow, PricingSnapshotInput, PricingSnapshotContext, PricingSnapshotOutput,
  SnapshotReplayResult, SnapshotReplayDiffEntry,
  SLIName, AlertSeverity, AlertChannelType, SLODefinition,
  EmailChannelConfig, SlackChannelConfig, PagerDutyChannelConfig,
  WebhookChannelConfig, OpsgenieChannelConfig, AlertChannelConfig,
  AlertRuleV2, AlertInvocation, SLOStatus,
} from './types/phase0';
export { PRICING_SLOS } from './types/phase0';

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
  termLP: number; // Managed spread with floors (bps)
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
  entityId?: string;
}

// Unified Transaction Interface (used for both Pricing Calculator and Blotter)
export interface Transaction {
  id?: string; // Optional for new deals in calculator before saving
  status?: 'Draft' | 'Booked' | 'Pending' | 'Pending_Approval' | 'Approved' | 'Rejected' | 'Review';
  desk?: string; // usually businessLine
  entityId?: string;
  parentDealId?: string; // links amendment/renewal to original deal
  amendmentType?: 'AMENDMENT' | 'RENEWAL';

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
  ead?: number; // Gap 16: Exposure at Default (separate from amount)
  feeIncome?: number; // Gap 6: annual fee income for RAROC

  // Repricing (Gap 15)
  repricingMonths?: number; // months until next repricing (RM) — distinct from DTM

  // Collateral (Gap 8)
  collateralType?: 'None' | 'Sovereign' | 'Corporate' | 'Cash' | 'Real_Estate';
  haircutPct?: number; // collateral haircut % for secured LP

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

  // Credit Risk / Anejo IX inputs (Sprint 2-5)
  guaranteeType?: 'MORTGAGE' | 'FINANCIAL_PLEDGE' | 'PERSONAL_GUARANTEE' | 'PUBLIC_GUARANTEE' | 'NONE';
  appraisalAgeMonths?: number;
  publicGuaranteePct?: number;
  ccfType?: string;
  utilizationRate?: number;
  // Mirror mode (external IFRS 9 params)
  creditRiskMode?: 'native' | 'mirror';
  externalPd12m?: number;
  externalLgd?: number;
  externalEad?: number;

  // ESG
  transitionRisk: 'Brown' | 'Amber' | 'Neutral' | 'Green';
  physicalRisk: 'High' | 'Medium' | 'Low';
  greenFormat?: 'Green_Bond' | 'Green_Loan' | 'Sustainability_Linked' | 'Social_Bond' | 'None';
  dnshCompliant?: boolean;
  isfEligible?: boolean; // Infrastructure Supporting Factor (CRR2 Art. 501a)

  // Optimistic locking
  version?: number;

  // Audit Results (Internal/Persisted)
  liquiditySpread?: number;
  _liquidityPremiumDetails?: number;
  _clcChargeDetails?: number;
  description?: string; // V4.0: For demo identification

  // ── Phase 1 extensions — CRR3 Capital Engine ──
  rwaStandardized?: number;   // SA RWA (% × amount when not provided explicitly)
  rwaIrb?: number;            // IRB RWA if bank is IRB-authorized
  isGSII?: boolean;           // G-SII surcharge applies
  isOSII?: boolean;           // O-SII surcharge applies

  // ── Phase 1 extensions — IFRS 9 / Anejo IX Lifecycle ──
  ifrs9Stage?: 1 | 2 | 3;     // Explicit stage override (if omitted, derived via SICR)
  pdMultiplier?: number;      // Current 12m PD vs origination PD — ratio for SICR
  daysPastDue?: number;       // SICR / default trigger
  isRefinanced?: boolean;     // Refinanced under financial difficulties
  isWatchlist?: boolean;      // Internal watchlist flag
  isForborne?: boolean;       // Forborne exposure

  // ── Phase 1 extensions — Credit rating (for CSRBB) ──
  clientRating?: string;      // AAA/AA/A/BBB/BB/B/CCC/D

  // ── Phase 1 R2 extensions — Delegation engine ──
  ltvPct?: number;            // LTV % for delegation matrix
  submittedByRole?: string;   // Manager role submitting the deal

  // ── Phase 1 R2 extensions — Cross-bonuses (bonificaciones cruzadas) ──
  crossBonusAttachments?: Array<{
    ruleId: string;
    overrideProbability?: number;
  }>;

  // ── Pivot extension — Outcome capture for pricing elasticity calibration ──
  // See: docs/pivot/PIVOT_PLAN.md §Bloque A, migration 20260413000001_deal_outcomes.sql
  wonLost?: 'WON' | 'LOST' | 'PENDING' | 'WITHDRAWN';
  lossReason?: 'PRICE' | 'COVENANT' | 'RELATIONSHIP' | 'COMPETITOR' | 'TIMING' | 'CLIENT_WITHDREW' | 'OTHER';
  competitorRate?: number;   // pct, best competitor rate disclosed by client (optional)
  proposedRate?: number;     // pct, snapshot of initial rate proposed to client
  decisionDate?: string;     // ISO timestamp when won/lost decision was recorded
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
  // Pivot §Bloque E: EVA-based governance (optional — gated by VITE_GOVERNANCE_MODE).
  // EVA bands in basis points. Deals with EVA above the threshold pass that tier.
  autoApprovalEvaBp?: number;   // e.g., 200  → EVA > +200bp auto-approve
  l1EvaBp?: number;              // e.g., 0    → EVA > 0 L1
  l2EvaBp?: number;              // e.g., -100 → EVA > -100bp L2 committee
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

export interface GreeniumRateCard {
  id: number;
  greenFormat: 'Green_Bond' | 'Green_Loan' | 'Sustainability_Linked' | 'Social_Bond';
  sector: string;
  adjustmentBps: number; // negative = discount (incentive)
  description: string;
}

export interface FtpRateCard {
  id: string;
  name: string;
  type: 'Liquidity' | 'Basis' | 'Commercial' | 'Credit';
  currency: string;
  points: YieldCurvePoint[];
}

// ── Credit Risk (Anejo IX) ────────────────────────────────────────────────
export interface CreditRiskResult {
  anejoSegment: string;
  stage: 1 | 2 | 3;
  grossExposure: number;
  effectiveGuarantee: number;
  netExposure: number;
  coveragePct: number;
  el12m: number;
  creditCostAnnualPct: number;
  // Forward-looking & migration (Sprint 3)
  day1Provision?: number;
  elLifetime?: number;
  migrationCostAnnual?: number;
  pMigrateS2?: number;
  pMigrateS3?: number;
  scenarioWeightedCoveragePct?: number;
  // Sprint 4: Capital Engine integration params
  capitalParams?: {
    pd: number;           // PD floor-adjusted (min 0.03% = 0.0003 per CRR3)
    lgd: number;          // LGD for IRB (decimal)
    ead: number;          // Exposure at default
    maturityYears: number;
    exposureClass: string; // Maps to CapitalEngine's ExposureClass
  };
  mode?: 'native' | 'mirror';
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
  esgGreeniumAdj?: number;       // Gap 17: Greenium/Movilización discount (negative = incentive)
  esgDnshCapitalAdj?: number;    // Gap 18: DNSH capital charge discount
  esgPillar1Adj?: number;        // Gap 19: ISF / ESG Pillar I overlay on capital
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
  matchedMethodology: string;
  matchReason: string;
  // V5.0: Granular FTP decomposition
  irrbbCharge?: number; // IRRBB component (base rate %)
  liquidityCharge?: number; // LP component (%)
  liquidityRecharge?: number; // LR buffer allocation (%)
  capitalIncome?: number; // income from regulatory capital
  formulaUsed?: string; // formula string applied (for display)
  behavioralMaturityUsed?: number; // effective BM used for interpolation
  incentivisationAdj?: number; // subsidy/incentive adjustment (%)
  anejoSegment?: string; // Anejo IX segment classification

  // ── Phase 1 extensions — Additional FTP charges (Gaps 20, 21) ──
  csrbbCost?: number;                // Gap 20: Credit Spread Risk Banking Book (%)
  contingentLiquidityCost?: number;  // Gap 21: Contingent liquidity for undrawn commitments (%)

  // ── Phase 1 extensions — CRR3 Capital diagnostics ──
  effectiveRwa?: number;             // Max(IRB, outputFloor × SA)
  outputFloorBinding?: boolean;      // True if CRR3 output floor binds
  outputFloorFactor?: number;        // Phase-in % for the calculation year
  totalCapitalRatio?: number;        // Full buffered requirement (% RWA)
  capitalBuffersBreakdown?: {
    pillar1: number;
    pillar2Requirement: number;
    conservationBuffer: number;
    countercyclicalBuffer: number;
    systemicRiskBuffer: number;
    sifiBuffer: number;
    managementBuffer: number;
  };

  // ── Phase 1 extensions — IFRS 9 / SICR diagnostics ──
  ifrs9StageUsed?: 1 | 2 | 3;        // Stage applied in pricing (from SICR or override)
  sicrTriggered?: boolean;           // True if SICR detected
  sicrReasons?: string[];            // SICR trigger reasons (audit trail)
  lifetimeEL?: number;               // Lifetime EL when stage 2/3

  // ── Phase 1 R2 extensions — Cross-bonuses ──
  crossBonusDiscountPct?: number;    // Total expected rate discount (%)
  crossBonusNpvIncome?: number;      // NPV of attached-product income (€)
  crossBonusNetAdjPct?: number;      // Net adjustment (% of loan)

  // ── Phase 1 R2 extensions — Delegation engine ──
  delegationTier?: 'AUTO' | 'MANAGER_L1' | 'MANAGER_L2' | 'RISK_COMMITTEE' | 'EXECUTIVE_COMMITTEE';
  delegationRuleId?: string | null;
  delegationRuleLabel?: string;
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

export type ViewState =
  | 'CALCULATOR'
  | 'BLOTTER'
  | 'CONFIG'
  | 'MARKET_DATA'
  | 'ACCOUNTING'
  | 'BEHAVIOURAL'
  | 'MANUAL'
  | 'USER_MGMT'
  | 'AI_LAB'
  | 'METHODOLOGY'
  | 'AUDIT_LOG'
  | 'SHOCKS'
  | 'REPORTING'
  | 'RAROC'
  | 'HEALTH'
  | 'NOTIFICATIONS'
  | 'TARGET_GRID'
  | 'DISCIPLINE'
  | 'WHAT_IF';
export type AuditModule = ViewState | 'AUTH' | 'MASTER_DATA' | 'SYS_CONFIG' | 'SYSTEM' | (string & {});

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
  version?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive?: boolean;
}

export interface RuleVersion {
  id: number;
  ruleId: number;
  version: number;
  businessUnit: string;
  product: string;
  segment: string;
  tenor: string;
  baseMethod: string;
  baseReference?: string;
  spreadMethod: string;
  liquidityReference?: string;
  strategicSpread: number;
  formulaSpec?: FormulaSpec;
  effectiveFrom: string;
  effectiveTo?: string;
  changedBy?: string;
  changeReason?: string;
  createdAt: string;
}

export interface AuditSubjectRef {
  type:
    | 'RULE'
    | 'DEAL'
    | 'DOSSIER'
    | 'METHOD_CHANGE'
    | 'APPROVAL_TASK'
    | 'SYSTEM_CONFIG'
    | 'PORTFOLIO_SNAPSHOT'
    | 'MARKET_DATA_SOURCE';
  id: string;
  label?: string;
}

export interface AuditCorrelation {
  correlationId: string;
  dealId?: string;
  changeRequestId?: string;
  approvalTaskId?: string;
  dossierId?: string;
}

export interface AuditEventEnvelope {
  action: string;
  module: AuditModule;
  description: string;
  subject?: AuditSubjectRef;
  correlation?: AuditCorrelation;
  details?: Record<string, unknown>;
}

export type MethodologyChangeTarget =
  | 'RULE'
  | 'RATE_CARD'
  | 'TRANSITION_GRID'
  | 'PHYSICAL_GRID'
  | 'GREENIUM_GRID'
  | 'APPROVAL_MATRIX'
  | 'CAPITAL';

export type MethodologyChangeAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'ROLLBACK';
export type MethodologyChangeStatus = 'Pending_Review' | 'Approved' | 'Rejected' | 'Applied' | 'Rolled_Back';

export interface MethodologyChangeOperation {
  entityType: MethodologyChangeTarget;
  entityId: string;
  action: MethodologyChangeAction;
  summary: string;
  currentValue?: unknown;
  proposedValue?: unknown;
  currentSnapshot?: Record<string, unknown> | null;
  proposedSnapshot?: Record<string, unknown> | null;
}

export interface MethodologyChangeRequest {
  id: string;
  title: string;
  reason: string;
  target: MethodologyChangeTarget;
  action: MethodologyChangeAction;
  status: MethodologyChangeStatus;
  submittedByEmail: string;
  submittedByName: string;
  submittedAt: string;
  reviewedByEmail?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewComment?: string;
  appliedByEmail?: string;
  appliedByName?: string;
  appliedAt?: string;
  rolledBackByEmail?: string;
  rolledBackByName?: string;
  rolledBackAt?: string;
  correlation: AuditCorrelation;
  operations: MethodologyChangeOperation[];
}

export interface MethodologyVersion {
  id: string;
  label: string;
  fingerprint: string;
  ruleCount: number;
  createdAt: string;
  createdByEmail: string;
  createdByName: string;
  sourceChangeRequestId?: string;
  summary: {
    activeRules: number;
    appliedRequests: number;
    reason: string;
  };
}

export type ApprovalTaskScope = 'METHODOLOGY_CHANGE' | 'DEAL_PRICING' | 'CONFIG_CHANGE';
export type ApprovalTaskStatus = 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Rolled_Back' | 'Cancelled';
export type ApprovalTaskRole = UserProfile['role'];

export interface ApprovalTask {
  id: string;
  scope: ApprovalTaskScope;
  status: ApprovalTaskStatus;
  title: string;
  description: string;
  requiredRole: ApprovalTaskRole;
  submittedByEmail: string;
  submittedByName: string;
  submittedAt: string;
  decidedByEmail?: string;
  decidedByName?: string;
  decidedAt?: string;
  notes?: string;
  subject: AuditSubjectRef;
  correlation: AuditCorrelation;
  dueAt?: string;
}

export interface PricingRunContext {
  methodologyVersionId: string;
  matchedMethodology: string;
  marketDataAsOf: string;
  approvalMatrix: ApprovalMatrixConfig;
  shocksApplied: {
    interestRate: number;
    liquiditySpread: number;
  };
  curveCounts: {
    yield: number;
    liquidity: number;
  };
  ruleCount: number;
}

export interface PricingEvidence {
  id: string;
  type: 'PRICING_RECEIPT' | 'APPROVAL_NOTE' | 'AUDIT_TRACE' | 'EXPORT_PACKAGE' | 'AI_TRACE';
  label: string;
  format: 'pdf' | 'json' | 'txt' | 'xlsx';
  createdAt: string;
  createdByEmail: string;
  createdByName: string;
  status: 'Generated' | 'Pending_Generation';
  metadata?: Record<string, unknown>;
}

export type PricingDossierStatus = 'Draft' | 'Pending_Approval' | 'Approved' | 'Rejected' | 'Booked';

export interface PricingDossier {
  id: string;
  dealId: string;
  status: PricingDossierStatus;
  title: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  createdByEmail: string;
  createdByName: string;
  methodologyVersionId: string;
  approvalLevel: FTPResult['approvalLevel'];
  dealSnapshot: Transaction;
  pricingResult: FTPResult;
  runContext: PricingRunContext;
  approvalTaskId?: string;
  evidence: PricingEvidence[];
  correlation: AuditCorrelation;
  groundedContext?: AIGroundedContext;
  aiResponseTraces?: AIResponseTrace[];
}

export interface PortfolioScenario {
  id: string;
  name: string;
  description?: string;
  shocks: {
    interestRate: number;
    liquiditySpread: number;
  };
  createdAt: string;
  createdByEmail: string;
  createdByName: string;
}

export interface PortfolioSnapshotResult {
  dealId: string;
  currency: string;
  amount: number;
  raroc: number;
  finalClientRate: number;
  approvalLevel: FTPResult['approvalLevel'];
}

export interface PortfolioSnapshot {
  id: string;
  name: string;
  scenario: PortfolioScenario;
  createdAt: string;
  createdByEmail: string;
  createdByName: string;
  dealIds: string[];
  totals: {
    exposure: number;
    averageRaroc: number;
    averageFinalRate: number;
    approved: number;
    pendingApproval: number;
    rejected: number;
  };
  results: PortfolioSnapshotResult[];
}

export type MarketDataSourceType = 'YieldCurve' | 'LiquidityCurve' | 'MasterData' | 'ReferenceData';

export interface MarketDataSource {
  id: string;
  name: string;
  provider: string;
  sourceType: MarketDataSourceType;
  status: 'Active' | 'Inactive';
  currencies: string[];
  lastSyncAt?: string;
  notes?: string;
}

export interface AIAction {
  id: string;
  type: 'EXPLAIN_PRICING' | 'SUMMARIZE_DOSSIER' | 'COMPARE_SCENARIOS' | 'DETECT_ANOMALY';
  label: string;
  subject?: AuditSubjectRef;
  enabled: boolean;
}

export interface AIGroundedContext {
  subjectRefs: AuditSubjectRef[];
  methodologyVersionId?: string;
  dossierId?: string;
  dealId?: string;
  portfolioSnapshotId?: string;
  evidenceIds: string[];
  marketDataSourceIds?: string[];
}

export interface AIResponseTrace {
  id: string;
  generatedAt: string;
  model: string;
  groundedContext: AIGroundedContext;
  sources: AuditSubjectRef[];
  suggestedActions: AIAction[];
  promptPreview?: string;
  responsePreview?: string;
}

// --- V5.0: ALM CONFIG TYPES ---

export interface IncentivisationRule {
  id: string;
  productType: string;
  segment: string;
  subsidyBps: number; // negative = discount
  validFrom: string;
  validTo: string;
  maxVolume?: number;
  description: string;
}

export interface SDRConfig {
  stableDepositRatio: number; // 0-1
  sdrFloor: number; // minimum SDR for benefit
  sdrImpactMultiplier: number; // how much SDR reduces LP
  externalFundingPct: number; // for blended LP curve
}

export interface LRConfig {
  totalBufferCostBps: number; // total HQLA cost to allocate
  riskAppetiteAddon: number; // multiplier (e.g. 1.3)
  buAllocations: Record<string, number>; // BU id -> allocation weight
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  action: string;
  module: AuditModule;
  description: string;
  details?: unknown;
}

export interface DealComment {
  id: number;
  dealId: string;
  userEmail: string;
  userName?: string;
  action: 'COMMENT' | 'APPROVE' | 'REJECT' | 'SUBMIT' | 'REWORK';
  comment: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  recipientEmail: string;
  senderEmail?: string;
  type: 'APPROVAL_REQUEST' | 'APPROVED' | 'REJECTED' | 'COMMENT';
  title: string;
  message?: string;
  dealId?: string;
  isRead: boolean;
  createdAt: string;
}
