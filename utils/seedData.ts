/** Seed / fallback data — single source of truth for offline mode and tests. Keep in sync with supabase/schema_v2.sql INSERT statements. */

export { MOCK_GROUPS, MOCK_ENTITIES, MOCK_ENTITY_USERS, DEFAULT_ENTITY_ID, DEFAULT_GROUP_ID } from './seedData.entities';

import { Transaction, BehaviouralModel, TransitionRateCard, PhysicalRateCard, GreeniumRateCard, ClientEntity, ProductDefinition, BusinessUnit, FtpRateCard, UserProfile, DualLiquidityCurve, LiquidityDashboardData, GeneralRule, IncentivisationRule, SDRConfig, LRConfig } from '../types';
import type { MethodologySnapshot, TargetGridCell, CanonicalDealTemplate, ToleranceBand, ElasticityModel } from '../types';
import type { FTPResult } from '../types';

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
  { id: 'CRED_LINE', name: 'Revolving Credit Line', category: 'Off-Balance' },
];

export const MOCK_BUSINESS_UNITS: BusinessUnit[] = [
  { id: 'BU-001', name: 'Commercial Banking', code: 'CIB' },
  { id: 'BU-002', name: 'Retail Banking', code: 'RET' },
  { id: 'BU-003', name: 'SME / Business', code: 'SME' },
  { id: 'BU-004', name: 'Wealth Management', code: 'WLM' },
  { id: 'BU-900', name: 'Central Treasury (ALM)', code: 'ALM' },
];

// --- MANAGEMENT & TREASURY WHITE LIST (V5.0) ---
const getRecentDate = (hoursAgo: number) => new Date(Date.now() - 1000 * 60 * 60 * hoursAgo).toISOString();

export const MOCK_USERS: UserProfile[] = [
  { id: 'usr-001', name: 'Carlos Martín', email: 'carlos.martin@nfq.es', role: 'Admin', status: 'Active', lastLogin: getRecentDate(0.5), department: 'Treasury / ALM' },
  { id: 'usr-002', name: 'Alejandro Lloveras', email: 'alejandro.lloveras@nfq.es', role: 'Trader', status: 'Active', lastLogin: getRecentDate(1.2), department: 'Global Markets' },
  { id: 'usr-003', name: 'Gregorio Gonzalo', email: 'gregorio.gonzalo@nfq.es', role: 'Risk_Manager', status: 'Active', lastLogin: getRecentDate(2.5), department: 'Risk Control' },
  { id: 'usr-004', name: 'Francisco Herrero', email: 'f.herrero@nfq.es', role: 'Admin', status: 'Active', lastLogin: getRecentDate(4), department: 'Treasury / ALM' },
  { id: 'usr-005', name: 'Martin Sanz', email: 'martin.sanz@nfq.es', role: 'Trader', status: 'Active', lastLogin: getRecentDate(0.2), department: 'Global Markets' },
  { id: 'usr-006', name: 'Roberto Flores', email: 'roberto.flores@nfq.es', role: 'Auditor', status: 'Active', lastLogin: getRecentDate(24), department: 'Internal Audit' },
  { id: 'usr-007', name: 'Arnau Lopez', email: 'arnau.lopez@nfq.es', role: 'Risk_Manager', status: 'Active', lastLogin: getRecentDate(5), department: 'Risk Control' },
  { id: 'usr-008', name: 'Diego Merino', email: 'diego.merino@nfq.es', role: 'Trader', status: 'Active', lastLogin: getRecentDate(1), department: 'Global Markets' },
  { id: 'usr-009', name: 'Diego Diaz', email: 'diego.diaz@nfq.es', role: 'Admin', status: 'Active', lastLogin: getRecentDate(3), department: 'Treasury / ALM' },
  { id: 'usr-010', name: 'Alin Marin', email: 'alin.marin@nfq.es', role: 'Admin', status: 'Active', lastLogin: getRecentDate(0), department: 'IT / Development' },
  { id: 'usr-demo', name: 'Demo User', email: 'demo@nfq.es', role: 'Admin', status: 'Active', lastLogin: getRecentDate(0), department: 'Demo' },
];

export const WHITELISTED_EMAILS = MOCK_USERS.map(u => u.email);

export const INITIAL_DEAL: Transaction = {
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
  marginTarget: 9.75,
  behaviouralModelId: '',
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15.0,
  operationalCostBps: 45,
  lcrOutflowPct: 0,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
  // Phase 1+2: defaults for new panels to show meaningful content
  clientRating: 'A',
  ltvPct: 65,
  ifrs9Stage: 1,
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

export const MOCK_GREENIUM_GRID: GreeniumRateCard[] = [
  { id: 201, greenFormat: 'Green_Bond', sector: 'All', adjustmentBps: -20, description: 'EU Green Bond Standard — full taxonomy alignment discount' },
  { id: 202, greenFormat: 'Green_Loan', sector: 'All', adjustmentBps: -15, description: 'Green Loan Principles (LMA) — verified use of proceeds' },
  { id: 203, greenFormat: 'Sustainability_Linked', sector: 'All', adjustmentBps: -10, description: 'Sustainability-Linked Loan — KPI-based margin ratchet' },
  { id: 204, greenFormat: 'Social_Bond', sector: 'All', adjustmentBps: -8, description: 'Social Bond Principles — affordable housing/healthcare' },
];

export const MOCK_FTP_RATE_CARDS: FtpRateCard[] = [
  {
    id: 'RC-LIQ-USD-STD', name: 'USD Liquidity Curve (Std)', type: 'Liquidity', currency: 'USD',
    points: [{ tenor: 'ON', rate: 0.05 }, { tenor: '1M', rate: 0.10 }, { tenor: '6M', rate: 0.18 }, { tenor: '1Y', rate: 0.25 }, { tenor: '5Y', rate: 0.45 }]
  },
  {
    id: 'RC-LIQ-EUR-HY', name: 'EUR High Yield Liquidity', type: 'Liquidity', currency: 'EUR',
    points: [{ tenor: 'ON', rate: 0.15 }, { tenor: '1M', rate: 0.25 }, { tenor: '1Y', rate: 0.60 }, { tenor: '5Y', rate: 1.20 }]
  }
];

export const MOCK_BEHAVIOURAL_MODELS: BehaviouralModel[] = [
  { id: 'NMD-001', name: 'Retail Savings - Sticky', type: 'NMD_Replication', nmdMethod: 'Parametric', description: 'High stability retail deposits', coreRatio: 90, decayRate: 15, betaFactor: 0.15 },
  { id: 'NMD-002', name: 'Corporate Vista - Volatile', type: 'NMD_Replication', nmdMethod: 'Parametric', description: 'Operating accounts for large corp', coreRatio: 40, decayRate: 60, betaFactor: 0.85 },
  { id: 'NMD-CAT-01', name: 'Wealth Mgmt Replication (Caterpillar)', type: 'NMD_Replication', nmdMethod: 'Caterpillar', description: 'Replicating portfolio for Wealth using Caterpillar decay.', replicationProfile: [{ term: '1M', weight: 40, spread: 2 }, { term: '3M', weight: 30, spread: 5 }, { term: '1Y', weight: 30, spread: 12 }] },
  { id: 'PRE-001', name: 'Mortgage Standard CPR', type: 'Prepayment_CPR', description: 'Standard residential mortgage prepay (CPR 5%)', cpr: 5.0, penaltyExempt: 10 },
  { id: 'PRE-002', name: 'Corp Loan - Aggressive', type: 'Prepayment_CPR', description: 'Refi-sensitive corporate borrowers', cpr: 12.5, penaltyExempt: 0 },
];

export const MOCK_LIQUIDITY_CURVES: DualLiquidityCurve[] = [
  // USD Unsecured (default)
  {
    currency: 'USD',
    curveType: 'unsecured',
    lastUpdate: new Date().toISOString(),
    points: [
      { tenor: 'ON', wholesaleSpread: 5, termLP: 15 },
      { tenor: '1M', wholesaleSpread: 10, termLP: 20 },
      { tenor: '3M', wholesaleSpread: 15, termLP: 22 },
      { tenor: '6M', wholesaleSpread: 20, termLP: 25 },
      { tenor: '1Y', wholesaleSpread: 25, termLP: 30 },
      { tenor: '2Y', wholesaleSpread: 35, termLP: 40 },
      { tenor: '3Y', wholesaleSpread: 42, termLP: 48 },
      { tenor: '5Y', wholesaleSpread: 50, termLP: 55 },
      { tenor: '10Y', wholesaleSpread: 55, termLP: 59 },
    ]
  },
  // USD Secured (Gap 8: repos, covered bonds)
  {
    currency: 'USD',
    curveType: 'secured',
    lastUpdate: new Date().toISOString(),
    points: [
      { tenor: 'ON', wholesaleSpread: 2, termLP: 5 },
      { tenor: '1M', wholesaleSpread: 5, termLP: 10 },
      { tenor: '3M', wholesaleSpread: 8, termLP: 12 },
      { tenor: '6M', wholesaleSpread: 10, termLP: 15 },
      { tenor: '1Y', wholesaleSpread: 15, termLP: 20 },
      { tenor: '2Y', wholesaleSpread: 20, termLP: 28 },
      { tenor: '3Y', wholesaleSpread: 25, termLP: 33 },
      { tenor: '5Y', wholesaleSpread: 30, termLP: 38 },
      { tenor: '10Y', wholesaleSpread: 33, termLP: 41 },
    ]
  },
  // EUR Unsecured (Gap 10)
  {
    currency: 'EUR',
    curveType: 'unsecured',
    lastUpdate: new Date().toISOString(),
    points: [
      { tenor: 'ON', wholesaleSpread: 3, termLP: 10 },
      { tenor: '1M', wholesaleSpread: 8, termLP: 15 },
      { tenor: '3M', wholesaleSpread: 12, termLP: 18 },
      { tenor: '6M', wholesaleSpread: 16, termLP: 22 },
      { tenor: '1Y', wholesaleSpread: 22, termLP: 28 },
      { tenor: '2Y', wholesaleSpread: 32, termLP: 38 },
      { tenor: '3Y', wholesaleSpread: 40, termLP: 45 },
      { tenor: '5Y', wholesaleSpread: 48, termLP: 52 },
      { tenor: '10Y', wholesaleSpread: 52, termLP: 56 },
    ]
  },
  // GBP Unsecured (Gap 10)
  {
    currency: 'GBP',
    curveType: 'unsecured',
    lastUpdate: new Date().toISOString(),
    points: [
      { tenor: 'ON', wholesaleSpread: 4, termLP: 12 },
      { tenor: '1M', wholesaleSpread: 9, termLP: 17 },
      { tenor: '3M', wholesaleSpread: 14, termLP: 20 },
      { tenor: '6M', wholesaleSpread: 18, termLP: 24 },
      { tenor: '1Y', wholesaleSpread: 24, termLP: 32 },
      { tenor: '2Y', wholesaleSpread: 34, termLP: 42 },
      { tenor: '5Y', wholesaleSpread: 48, termLP: 56 },
      { tenor: '10Y', wholesaleSpread: 54, termLP: 60 },
    ]
  },
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
  { tenor: '20Y', rate: 4.15, prev: 4.20 },
  { tenor: '30Y', rate: 4.10, prev: 4.15 },
];

export const MOCK_DEALS: Transaction[] = [
  {
    id: 'TRD-HYPER-001', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'LOAN_COMM', category: 'Asset', amount: 25000000, currency: 'USD', marginTarget: 1.75,
    startDate: '2023-11-01', status: 'Booked', businessLine: 'Corporate',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 60, amortization: 'French', repricingFreq: 'Monthly',
    riskWeight: 100, capitalRatio: 12.0, targetROE: 15, operationalCostBps: 35,
    lcrOutflowPct: 0, transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'Crédito Corporativo Estándar - 5Y'
  },
  {
    id: 'TRD-HYPER-002', clientId: 'CL-4099', clientType: 'Retail',
    productType: 'LOAN_MORT', category: 'Asset', amount: 350000, currency: 'EUR', marginTarget: 1.20,
    startDate: '2023-10-15', status: 'Booked', businessLine: 'Retail',
    businessUnit: 'BU-002', fundingBusinessUnit: 'BU-900',
    durationMonths: 240, amortization: 'French', repricingFreq: 'Fixed',
    riskWeight: 35, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 20,
    lcrOutflowPct: 0, transitionRisk: 'Green', physicalRisk: 'Medium',
    description: 'Hipoteca Residencial Eficiente (ESG Premium)'
  },
  {
    id: 'TRD-HYPER-003', clientId: 'CL-1002', clientType: 'Corporate',
    productType: 'DEP_TERM', category: 'Liability', amount: 15000000, currency: 'USD', marginTarget: 0.85,
    startDate: '2023-11-20', status: 'Booked', businessLine: 'Corporate',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 12, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 0, capitalRatio: 12.0, targetROE: 10, operationalCostBps: 10,
    lcrOutflowPct: 25, isOperationalSegment: true,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'Depósito Operativo - Mitigación LCR'
  },
  {
    id: 'TRD-HYPER-004', clientId: 'CL-3055', clientType: 'Institution',
    productType: 'CRED_LINE', category: 'Off-Balance', amount: 50000000, currency: 'EUR', marginTarget: 0.45,
    startDate: '2023-11-10', status: 'Pending', businessLine: 'Institutional',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 36, amortization: 'Bullet', repricingFreq: 'Daily',
    riskWeight: 100, capitalRatio: 11.5, targetROE: 14, operationalCostBps: 15,
    lcrOutflowPct: 40, undrawnAmount: 45000000, isCommitted: true,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'Línea de Crédito Comprometida - Impacto CLC'
  },
  {
    id: 'TRD-HYPER-005', clientId: 'CL-2001', clientType: 'SME',
    productType: 'LOAN_COMM', category: 'Asset', amount: 1200000, currency: 'USD', marginTarget: 3.50,
    startDate: '2023-11-25', status: 'Review', businessLine: 'SME',
    businessUnit: 'BU-003', fundingBusinessUnit: 'BU-900',
    durationMonths: 48, amortization: 'Linear', repricingFreq: 'Quarterly',
    riskWeight: 100, capitalRatio: 12.0, targetROE: 18, operationalCostBps: 85,
    lcrOutflowPct: 0, transitionRisk: 'Amber', physicalRisk: 'High',
    description: 'Préstamo SME - Riesgo de Transición Sectorial'
  },
  {
    id: 'TRD-HYPER-006', clientId: 'CL-3055', clientType: 'Institution',
    productType: 'DEP_CASA', category: 'Liability', amount: 100000000, currency: 'USD', marginTarget: 0.10,
    startDate: '2023-11-01', status: 'Booked', businessLine: 'Treasury',
    businessUnit: 'BU-900', fundingBusinessUnit: 'BU-900',
    durationMonths: 1, amortization: 'Bullet', repricingFreq: 'Daily',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 5,
    lcrOutflowPct: 100, isOperationalSegment: false,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'Fondeo Mayorista (Financial Inst.) - 100% LCR Outflow'
  },
  {
    id: 'DL-DEMO-001', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'LOAN_COMM', category: 'Asset', amount: 10000000, currency: 'USD', marginTarget: 2.50,
    startDate: '2024-01-01', status: 'Review', businessLine: 'Demo',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 6, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 100, capitalRatio: 12.0, targetROE: 15, operationalCostBps: 45,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'Gatillo NSFR: Activo < 12M forzando suelo 1Y.'
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
    description: 'LCR/Op Split: Beneficio depósito operativo.'
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
    description: 'CLC Masivo: Impacto línea comprometida no dispuesta.'
  },
  {
    id: 'TRD-IRS-001', clientId: 'CL-3055', clientType: 'Institution',
    productType: 'SWAP_IRS', category: 'Off-Balance', amount: 25000000, currency: 'EUR', marginTarget: 0.15,
    startDate: '2023-12-01', status: 'Review', businessLine: 'Derivatives',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 120, amortization: 'Bullet', repricingFreq: 'Monthly',
    riskWeight: 20, capitalRatio: 12.0, targetROE: 15, operationalCostBps: 10,
    transitionRisk: 'Neutral', physicalRisk: 'Low',
    description: 'IRS Swap - Cobertura de Tipo de Interés'
  }
];

// --- PRICING & METHODOLOGY RULES (V5.0) ---
export const MOCK_RULES: GeneralRule[] = [
  {
    id: 1,
    businessUnit: 'Commercial Banking',
    product: 'Commercial Loan',
    segment: 'Corporate',
    tenor: '< 12M',
    baseMethod: 'Matched Maturity',
    baseReference: 'USD-SOFR',
    spreadMethod: '50% LP(DTM) + 50% LP(1Y) [NSFR Floor]',
    liquidityReference: 'USD-LIQ-STD',
    strategicSpread: 15,
    formulaSpec: { baseRateKey: 'DTM', lpFormula: '50_50_DTM_1Y', sign: 1 },
  },
  {
    id: 2,
    businessUnit: 'Retail Banking',
    product: 'Term Deposit',
    segment: 'Retail Operational',
    tenor: 'Any',
    baseMethod: 'Moving Average',
    baseReference: 'EUR-ESTR',
    spreadMethod: '50% LP(BM) + 50% LP[max(1Y, BM)] + 25% CLC',
    liquidityReference: 'EUR-LIQ-STD',
    strategicSpread: 5,
    formulaSpec: { baseRateKey: 'BM', lpFormula: 'LP_BM', sign: -1 },
  },
  {
    id: 3,
    businessUnit: 'Global Markets',
    product: 'Secured Repo',
    segment: 'ECA Qualified',
    tenor: 'Any',
    baseMethod: 'Matched Maturity',
    baseReference: 'USD-SOFR',
    spreadMethod: '(1-HC)·(sec. LP + ECA adj) + HC·unsec. LP',
    liquidityReference: 'USD-LIQ-SEC',
    strategicSpread: 2,
    formulaSpec: { baseRateKey: 'DTM', lpFormula: 'SECURED_LP', lpCurveType: 'secured', sign: 1 },
  },
  {
    id: 4,
    businessUnit: 'Commercial Banking',
    product: 'Mortgage',
    segment: 'Retail',
    tenor: '> 5Y',
    baseMethod: 'Caterpillar (NMD)',
    baseReference: 'USD-SOFR',
    spreadMethod: 'Stable Funding LP (Long-Term)',
    liquidityReference: 'USD-LIQ-STD',
    strategicSpread: 10,
    formulaSpec: { baseRateKey: 'BM', lpFormula: 'LP_BM', sign: 1 },
  },
  {
    id: 5,
    businessUnit: 'Commercial Banking',
    product: 'Commercial Loan',
    segment: 'Corporate',
    tenor: '> 12M',
    baseMethod: 'Matched Maturity',
    baseReference: 'USD-SOFR',
    spreadMethod: 'BR[min(BM,RM)] + LP(BM)',
    liquidityReference: 'USD-LIQ-STD',
    strategicSpread: 12,
    formulaSpec: { baseRateKey: 'MIN_BM_RM', lpFormula: 'LP_BM', sign: 1 },
  },
  {
    id: 6,
    businessUnit: 'Retail Banking',
    product: 'Current Account',
    segment: 'Retail',
    tenor: 'Any',
    baseMethod: 'Caterpillar (NMD)',
    baseReference: 'EUR-ESTR',
    spreadMethod: 'LP(BM) — NMD Replication',
    liquidityReference: 'EUR-LIQ-STD',
    strategicSpread: 3,
    formulaSpec: { baseRateKey: 'BM', lpFormula: 'LP_BM', sign: -1 },
  }
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
    securedBenefit: 45.0,
    lcrRatio: 135.4,
    nsfrRatio: 112.8,
  },
  history: [
    { date: '2023-08', lcr: 128.2, nsfr: 108.5 },
    { date: '2023-09', lcr: 130.5, nsfr: 109.2 },
    { date: '2023-10', lcr: 132.8, nsfr: 110.8 },
    { date: '2023-11', lcr: 135.4, nsfr: 112.8 },
  ]
};

// --- SDR, LR & INCENTIVISATION CONFIG (V5.0) ---

export const MOCK_SDR_CONFIG: SDRConfig = {
  stableDepositRatio: 0.72,     // 72% of deposits classified stable
  sdrFloor: 0.50,               // minimum SDR for benefit to kick in
  sdrImpactMultiplier: 0.30,    // how much SDR above floor reduces LP
  externalFundingPct: 0.35,     // 35% external / 65% internal for blended LP
};

export const MOCK_LR_CONFIG: LRConfig = {
  totalBufferCostBps: 20.52,        // total HQLA buffer cost (bps)
  riskAppetiteAddon: 1.30,          // 30% risk appetite addon
  buAllocations: {
    'BU-001': 0.40,                 // Commercial Banking 40%
    'BU-002': 0.25,                 // Retail Banking 25%
    'BU-003': 0.15,                 // SME / Business 15%
    'BU-004': 0.10,                 // Wealth Management 10%
    'BU-900': 0.10,                 // Central Treasury 10%
  },
};

export const MOCK_INCENTIVISATION_RULES: IncentivisationRule[] = [
  {
    id: 'INC-001',
    productType: 'LOAN_MORT',
    segment: 'Retail',
    subsidyBps: -5,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    maxVolume: 500000000,
    description: 'Green mortgage incentive — reduced LP for energy-efficient homes',
  },
  {
    id: 'INC-002',
    productType: 'LOAN_COMM',
    segment: 'SME',
    subsidyBps: -3,
    validFrom: '2024-01-01',
    validTo: '2024-06-30',
    description: 'SME new production subsidy — strategic growth segment',
  },
  {
    id: 'INC-003',
    productType: 'DEP_TERM',
    segment: 'Retail',
    subsidyBps: 2,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    description: 'Term deposit retention premium — stable funding incentive',
  },
];
