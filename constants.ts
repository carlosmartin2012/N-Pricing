
import { Transaction, BehaviouralModel, TransitionRateCard, PhysicalRateCard, ClientEntity, ProductDefinition, BusinessUnit, FtpRateCard, UserProfile, DualLiquidityCurve, LiquidityDashboardData } from './types';

export const MOCK_CLIENTS: ClientEntity[] = [
  { id: 'CL-1001', name: 'Acme Corp Industries', type: 'Corporate', segment: 'Large Cap', rating: 'BBB' },
  { id: 'CL-1002', name: 'Globex Retail Group', type: 'Corporate', segment: 'Mid Market', rating: 'BB+' },
  { id: 'CL-2001', name: 'John Doe Properties', type: 'SME', segment: 'Real Estate', rating: 'B' },
  { id: 'CL-3055', name: 'Sovereign Wealth Fund A', type: 'Institution', segment: 'Financial', rating: 'AA' },
  { id: 'CL-4099', name: 'Maria Garcia', type: 'Retail', segment: 'Private Banking', rating: 'A' },
];

export const MOCK_PRODUCT_DEFS: ProductDefinition[] = [
  { id: 'LOAN_COMM', name: 'Commercial Loan', category: 'Asset' },
  { id: 'LOAN_MORT', name: 'Mortgage (Residential)', category: 'Asset' },
  { id: 'LOAN_AUTO', name: 'Auto Loan', category: 'Asset' },
  { id: 'DEP_TERM', name: 'Term Deposit', category: 'Liability' },
  { id: 'DEP_CASA', name: 'Current Account (CASA)', category: 'Liability' },
  { id: 'SWAP_IRS', name: 'Interest Rate Swap', category: 'Off-Balance' },
  { id: 'CRED_LINE', name: 'Revolving Credit Line', category: 'Asset' },
];

export const MOCK_BUSINESS_UNITS: BusinessUnit[] = [
  { id: 'BU-001', name: 'Commercial Banking', code: 'CIB' },
  { id: 'BU-002', name: 'Retail Banking', code: 'RET' },
  { id: 'BU-003', name: 'SME / Business', code: 'SME' },
  { id: 'BU-004', name: 'Wealth Management', code: 'WLM' },
  { id: 'BU-900', name: 'Central Treasury (ALM)', code: 'ALM' },
];

export const WHITELISTED_EMAILS = [
  'carlos.martin@nfq.es',
  'alejandro.lloveras@nfq.es',
  'gregorio.gonzalo@nfq.es',
  'francisco.herrero@nfq.es',
  'martin.sanz@nfq.es',
  'roberto.flores@nfq.es',
  'arnau.lopez@nfq.es',
  'diego.merino@nfq.es',
  'diego.diaz@nfq.es'
];

export const MOCK_USERS: UserProfile[] = [
  { id: 'USR-001', name: 'Carlos Martin', email: 'carlos.martin@nfq.es', role: 'Admin', status: 'Active', lastLogin: '2023-10-24 09:15', department: 'Management' },
  { id: 'USR-002', name: 'Alejandro Lloveras', email: 'alejandro.lloveras@nfq.es', role: 'Trader', status: 'Active', lastLogin: 'Never', department: 'Treasury' },
  { id: 'USR-003', name: 'Gregorio Gonzalo', email: 'gregorio.gonzalo@nfq.es', role: 'Risk_Manager', status: 'Active', lastLogin: 'Never', department: 'Risk Control' },
  { id: 'USR-004', name: 'Francisco Herrero', email: 'francisco.herrero@nfq.es', role: 'Auditor', status: 'Active', lastLogin: 'Never', department: 'Audit' },
  { id: 'USR-005', name: 'Martin Sanz', email: 'martin.sanz@nfq.es', role: 'Trader', status: 'Active', lastLogin: 'Never', department: 'Treasury' },
  { id: 'USR-006', name: 'Roberto Flores', email: 'roberto.flores@nfq.es', role: 'Trader', status: 'Active', lastLogin: 'Never', department: 'Management' },
  { id: 'USR-007', name: 'Arnau Lopez', email: 'arnau.lopez@nfq.es', role: 'Trader', status: 'Active', lastLogin: 'Never', department: 'Treasury' },
  { id: 'USR-008', name: 'Diego Merino', email: 'diego.merino@nfq.es', role: 'Trader', status: 'Active', lastLogin: 'Never', department: 'Risk Control' },
  { id: 'USR-009', name: 'Diego Diaz', email: 'diego.diaz@nfq.es', role: 'Trader', status: 'Active', lastLogin: 'Never', department: 'Treasury' },
];

export const INITIAL_DEAL: Transaction = {
  // No ID implies new deal calculation
  clientId: 'CL-1001',
  clientType: 'Corporate',

  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate Finance',

  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 5000000,
  startDate: new Date().toISOString().split('T')[0],
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.25,
  behaviouralModelId: '',

  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15.0,
  operationalCostBps: 45,
  lcrOutflowPct: 0,

  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

export const EMPTY_DEAL: Transaction = {
  clientId: '',
  clientType: '',
  businessUnit: '',
  fundingBusinessUnit: '',
  businessLine: '',
  productType: '',
  category: 'Asset',
  currency: 'USD',
  amount: 0,
  startDate: new Date().toISOString().split('T')[0],
  durationMonths: 0,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 0,
  behaviouralModelId: '',
  riskWeight: 0,
  capitalRatio: 0,
  targetROE: 0,
  operationalCostBps: 0,
  lcrOutflowPct: 0,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

export const MOCK_TRANSITION_GRID: TransitionRateCard[] = [
  { id: 1, classification: 'Green', sector: 'All', adjustmentBps: -15, description: 'EU Taxonomy Aligned (Incentive)' },
  { id: 2, classification: 'Amber', sector: 'Manufacturing', adjustmentBps: 5, description: 'Transition plan required (Scope 1/2)' },
  { id: 3, classification: 'Brown', sector: 'Energy/Fossil', adjustmentBps: 35, description: 'Stranded Asset Risk Premium' },
  { id: 4, classification: 'Neutral', sector: 'Services', adjustmentBps: 0, description: 'Standard Portfolio' },
];

export const MOCK_PHYSICAL_GRID: PhysicalRateCard[] = [
  { id: 101, riskLevel: 'High', locationType: 'Coastal / Flood Zone', adjustmentBps: 20, description: 'Insurance Premium Equiv. (Acute Risk)' },
  { id: 102, riskLevel: 'Medium', locationType: 'Water Stress Area', adjustmentBps: 8, description: 'Operational continuity risk' },
  { id: 103, riskLevel: 'Low', locationType: 'Standard Zone', adjustmentBps: 0, description: 'No significant climate exposure' },
];

export const MOCK_FTP_RATE_CARDS: FtpRateCard[] = [
  {
    id: 'RC-LIQ-USD-STD', name: 'USD Liquidity Curve (Std)', type: 'Liquidity', currency: 'USD',
    points: [{ tenor: 'ON', rate: 0.05 }, { tenor: '1M', rate: 0.10 }, { tenor: '6M', rate: 0.18 }, { tenor: '1Y', rate: 0.25 }, { tenor: '5Y', rate: 0.45 }]
  },
  {
    id: 'RC-LIQ-EUR-HY', name: 'EUR High Yield Liquidity', type: 'Liquidity', currency: 'EUR',
    points: [{ tenor: 'ON', rate: 0.15 }, { tenor: '1M', rate: 0.25 }, { tenor: '1Y', rate: 0.60 }, { tenor: '5Y', rate: 1.20 }]
  },
  {
    id: 'RC-COM-SME-A', name: 'SME Commercial Grid A', type: 'Commercial', currency: 'USD',
    points: [{ tenor: '1Y', rate: 1.50 }, { tenor: '3Y', rate: 1.85 }, { tenor: '5Y', rate: 2.10 }, { tenor: '7Y', rate: 2.50 }]
  }
];

export const MOCK_BEHAVIOURAL_MODELS: BehaviouralModel[] = [
  // NMD Models
  { id: 'NMD-001', name: 'Retail Savings - Sticky', type: 'NMD_Replication', nmdMethod: 'Parametric', description: 'High stability retail deposits', coreRatio: 90, decayRate: 15, betaFactor: 0.15 },
  { id: 'NMD-002', name: 'Corporate Vista - Volatile', type: 'NMD_Replication', nmdMethod: 'Parametric', description: 'Operating accounts for large corp', coreRatio: 40, decayRate: 60, betaFactor: 0.85 },
  {
    id: 'NMD-CAT-01',
    name: 'Wealth Mgmt Replication',
    type: 'NMD_Replication',
    nmdMethod: 'Caterpillar',
    description: 'Replicating portfolio for Wealth',
    replicationProfile: [
      { term: '1M', weight: 40, spread: 2 },
      { term: '3M', weight: 30, spread: 5 },
      { term: '1Y', weight: 30, spread: 12 }
    ]
  },
  // Prepayment Models
  { id: 'PRE-001', name: 'Mortgage Standard CPR', type: 'Prepayment_CPR', description: 'Standard residential mortgage prepay', cpr: 5.0, penaltyExempt: 10 },
  { id: 'PRE-002', name: 'Corp Loan - Aggressive', type: 'Prepayment_CPR', description: 'Refi-sensitive corporate borrowers', cpr: 12.5, penaltyExempt: 0 },
  { id: 'PRE-003', name: 'Auto Loan Static', type: 'Prepayment_CPR', description: 'Fixed curve for vehicle finance', cpr: 8.0, penaltyExempt: 100 },
];

export const MOCK_LIQUIDITY_CURVES: DualLiquidityCurve[] = [
  {
    currency: 'USD',
    lastUpdate: new Date().toISOString(),
    points: [
      { tenor: 'ON', wholesaleSpread: 5, termLP: 15 },
      { tenor: '1M', wholesaleSpread: 10, termLP: 20 },
      { tenor: '3M', wholesaleSpread: 15, termLP: 22 },
      { tenor: '6M', wholesaleSpread: 20, termLP: 25 },
      { tenor: '1Y', wholesaleSpread: 25, termLP: 30 },
      { tenor: '2Y', wholesaleSpread: 35, termLP: 40 },
      { tenor: '5Y', wholesaleSpread: 50, termLP: 55 },
    ]
  },
  {
    currency: 'EUR',
    lastUpdate: new Date().toISOString(),
    points: [
      { tenor: 'ON', wholesaleSpread: 8, termLP: 18 },
      { tenor: '1M', wholesaleSpread: 14, termLP: 24 },
      { tenor: '1Y', wholesaleSpread: 30, termLP: 40 },
      { tenor: '5Y', wholesaleSpread: 65, termLP: 75 },
    ]
  }
];

export const MOCK_YIELD_CURVE = [
  { tenor: 'ON', rate: 5.32, prev: 5.30 },
  { tenor: '1M', rate: 5.35, prev: 5.33 },
  { tenor: '3M', rate: 5.40, prev: 5.42 },
  { tenor: '6M', rate: 5.25, prev: 5.20 },
  { tenor: '1Y', rate: 5.10, prev: 5.05 },
  { tenor: '2Y', rate: 4.85, prev: 4.90 },
  { tenor: '3Y', rate: 4.65, prev: 4.70 },
  { tenor: '5Y', rate: 4.50, prev: 4.55 },
  { tenor: '7Y', rate: 4.40, prev: 4.42 },
  { tenor: '10Y', rate: 4.25, prev: 4.30 },
  { tenor: '30Y', rate: 4.10, prev: 4.15 },
];

export const METHODOLOGIES = [
  { id: 'mm', name: 'Matched Maturity', type: 'Deterministic', risk: 'Low' },
  { id: 'ma', name: 'Moving Average', type: 'Smoothed', risk: 'Medium' },
  { id: 'rc', name: 'Rate Card', type: 'Fixed', risk: 'High' },
];

// Expanded to full Transaction objects
export const MOCK_DEALS: Transaction[] = [
  {
    id: 'TRD-88392', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'LOAN_COMM', category: 'Asset', amount: 12500000, currency: 'USD', marginTarget: 2.25,
    startDate: '2023-10-24', status: 'Booked', businessLine: 'Corp Fin',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 36, amortization: 'Bullet', repricingFreq: 'Monthly',
    riskWeight: 100, capitalRatio: 11.5, targetROE: 15, operationalCostBps: 45,
    lcrOutflowPct: 0,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88393', clientId: 'CL-1002', clientType: 'Corporate',
    productType: 'DEP_TERM', category: 'Liability', amount: 5000000, currency: 'EUR', marginTarget: 1.50,
    startDate: '2023-10-24', status: 'Pending', businessLine: 'Retail',
    businessUnit: 'BU-002', fundingBusinessUnit: 'BU-900',
    durationMonths: 12, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 15, operationalCostBps: 20,
    lcrOutflowPct: 100,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88394', clientId: 'CL-2001', clientType: 'SME',
    productType: 'LOAN_MORT', category: 'Asset', amount: 850000, currency: 'USD', marginTarget: 1.85,
    startDate: '2023-10-20', status: 'Review', businessLine: 'Real Estate',
    businessUnit: 'BU-003', fundingBusinessUnit: 'BU-900',
    durationMonths: 120, amortization: 'French', repricingFreq: 'Fixed',
    riskWeight: 35, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 25,
    lcrOutflowPct: 0,
    transitionRisk: 'Green', physicalRisk: 'Medium'
  },
  {
    id: 'TRD-88395', clientId: 'CL-1002', clientType: 'Corporate',
    productType: 'CRED_LINE', category: 'Asset', amount: 2000000, currency: 'EUR', marginTarget: 2.10,
    startDate: '2023-09-15', status: 'Booked', businessLine: 'Corp Fin',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 24, amortization: 'Bullet', repricingFreq: 'Daily',
    riskWeight: 75, capitalRatio: 11.5, targetROE: 14, operationalCostBps: 35,
    lcrOutflowPct: 10,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88396', clientId: 'CL-4099', clientType: 'Retail',
    productType: 'LOAN_AUTO', category: 'Asset', amount: 45000, currency: 'GBP', marginTarget: 3.50,
    startDate: '2023-10-22', status: 'Pending', businessLine: 'Retail',
    businessUnit: 'BU-002', fundingBusinessUnit: 'BU-900',
    durationMonths: 48, amortization: 'Linear', repricingFreq: 'Fixed',
    riskWeight: 75, capitalRatio: 11.5, targetROE: 18, operationalCostBps: 80,
    lcrOutflowPct: 0,
    transitionRisk: 'Brown', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88397', clientId: 'CL-3055', clientType: 'Institution',
    productType: 'DEP_TERM', category: 'Liability', amount: 50000000, currency: 'JPY', marginTarget: 0.15,
    startDate: '2023-10-01', status: 'Booked', businessLine: 'Institutional',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 3, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 10, operationalCostBps: 5,
    lcrOutflowPct: 100,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88398', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'LOAN_COMM', category: 'Asset', amount: 25000000, currency: 'USD', marginTarget: 2.00,
    startDate: '2023-08-10', status: 'Booked', businessLine: 'Corp Fin',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 60, amortization: 'Bullet', repricingFreq: 'Quarterly',
    riskWeight: 100, capitalRatio: 11.5, targetROE: 15, operationalCostBps: 40,
    lcrOutflowPct: 0,
    transitionRisk: 'Amber', physicalRisk: 'Medium'
  },
  {
    id: 'TRD-88399', clientId: 'CL-2001', clientType: 'SME',
    productType: 'LOAN_COMM', category: 'Asset', amount: 35000, currency: 'EUR', marginTarget: 2.75,
    startDate: '2023-10-23', status: 'Rejected', businessLine: 'SME',
    businessUnit: 'BU-003', fundingBusinessUnit: 'BU-900',
    durationMonths: 36, amortization: 'Linear', repricingFreq: 'Monthly',
    riskWeight: 85, capitalRatio: 11.5, targetROE: 16, operationalCostBps: 50,
    lcrOutflowPct: 0,
    transitionRisk: 'Brown', physicalRisk: 'High'
  },
  {
    id: 'TRD-88400', clientId: 'CL-4099', clientType: 'Retail',
    productType: 'LOAN_MORT', category: 'Asset', amount: 650000, currency: 'USD', marginTarget: 1.60,
    startDate: '2023-09-01', status: 'Booked', businessLine: 'Retail',
    businessUnit: 'BU-002', fundingBusinessUnit: 'BU-900',
    durationMonths: 360, amortization: 'French', repricingFreq: 'Fixed',
    riskWeight: 35, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 20,
    lcrOutflowPct: 0,
    transitionRisk: 'Green', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88401', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'SWAP_IRS', category: 'Off-Balance', amount: 10000000, currency: 'USD', marginTarget: 0.10,
    startDate: '2023-10-15', status: 'Booked', businessLine: 'Markets',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 60, amortization: 'Bullet', repricingFreq: 'Quarterly',
    riskWeight: 20, capitalRatio: 11.5, targetROE: 20, operationalCostBps: 10,
    lcrOutflowPct: 0,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88402', clientId: 'CL-4099', clientType: 'Retail',
    productType: 'DEP_CASA', category: 'Liability', amount: 150000, currency: 'GBP', marginTarget: 2.20,
    startDate: '2023-01-01', status: 'Booked', businessLine: 'Wealth',
    businessUnit: 'BU-004', fundingBusinessUnit: 'BU-900',
    durationMonths: 1, amortization: 'Bullet', repricingFreq: 'Daily',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 25, operationalCostBps: 15,
    lcrOutflowPct: 100,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88403', clientId: 'CL-3055', clientType: 'Institution',
    productType: 'LOAN_COMM', category: 'Asset', amount: 75000000, currency: 'USD', marginTarget: 1.25,
    startDate: '2023-10-24', status: 'Review', businessLine: 'Institutional',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 12, amortization: 'Bullet', repricingFreq: 'Monthly',
    riskWeight: 50, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 10,
    lcrOutflowPct: 0,
    transitionRisk: 'Green', physicalRisk: 'Low'
  },
  // V4.0: SHOWCASE DEMO DEALS
  {
    id: 'DL-DEMO-001', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'LOAN_COMM', category: 'Asset', amount: 10000000, currency: 'USD', marginTarget: 2.50,
    startDate: '2024-01-01', status: 'Review', businessLine: 'Demo',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 6, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 100, capitalRatio: 12.0, targetROE: 15, operationalCostBps: 45,
    lcrOutflowPct: 0,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'NSFR Trigger: Asset < 12M forcing 1Y floor.'
  },
  {
    id: 'DL-DEMO-002', clientId: 'CL-1002', clientType: 'Corporate',
    productType: 'DEP_TERM', category: 'Liability', amount: 50000000, currency: 'USD', marginTarget: 1.20,
    startDate: '2024-01-01', status: 'Booked', businessLine: 'Demo',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 12, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 15,
    lcrOutflowPct: 25, isOperationalSegment: true,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'LCR/Op Split: Operational deposit benefit.'
  },
  {
    id: 'DL-DEMO-004', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'CRED_LINE', category: 'Off-Balance', amount: 100000000, currency: 'USD', marginTarget: 0.50,
    startDate: '2024-01-01', status: 'Pending', businessLine: 'Demo',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 36, amortization: 'Bullet', repricingFreq: 'Daily',
    riskWeight: 75, capitalRatio: 11.5, targetROE: 14, operationalCostBps: 20,
    lcrOutflowPct: 10, undrawnAmount: 85000000, isCommitted: true,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'CLC Masivo: Committed undrawn line impact.'
  },
];

export const MOCK_LIQUIDITY_DASHBOARD_DATA: LiquidityDashboardData = {
  basisSpreads: [
    { tenor: 'ON', libor: 5.32, ois: 5.30, basis: 2 },
    { tenor: '1M', libor: 5.45, ois: 5.35, basis: 10 },
    { tenor: '3M', libor: 5.62, ois: 5.48, basis: 14 },
    { tenor: '6M', libor: 5.75, ois: 5.55, basis: 20 },
    { tenor: '1Y', libor: 5.95, ois: 5.65, basis: 30 },
  ],
  fundingCurves: [
    { tenor: 'ON', secured: 5.25, unsecured: 5.40 },
    { tenor: '1M', secured: 5.30, unsecured: 5.55 },
    { tenor: '3M', secured: 5.40, unsecured: 5.75 },
    { tenor: '1Y', secured: 5.60, unsecured: 6.10 },
    { tenor: '5Y', secured: 5.85, unsecured: 6.50 },
  ],
  clcProfiles: [
    { profile: 'Retail Stable', cost: 1.5, outflow: 5 },
    { profile: 'Corp Operational', cost: 7.5, outflow: 25 },
    { profile: 'Corp Non-Operational', cost: 12.0, outflow: 40 },
    { profile: 'Financial Inst.', cost: 30.0, outflow: 100 },
  ],
  kpis: {
    hqlaCost: 12.5,
    nsfrFloorPremium: 8.2,
    securedBenefit: 45.0
  }
};
