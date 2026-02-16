
import { Transaction, BehaviouralModel, TransitionRateCard, PhysicalRateCard, ClientEntity, ProductDefinition, BusinessUnit, FtpRateCard, UserProfile } from './types';

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
  'diego.merino@nfq.es'
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
];

export const INITIAL_DEAL: Transaction = {
  // No ID implies new deal calculation
  clientId: 'CL-1001',
  clientType: 'Corporate',

  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate Finance',

  productType: 'LOAN_COMM',
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
    grid: [{ tenor: 'ON', spread: 5 }, { tenor: '1M', spread: 10 }, { tenor: '6M', spread: 18 }, { tenor: '1Y', spread: 25 }, { tenor: '5Y', spread: 45 }]
  },
  {
    id: 'RC-LIQ-EUR-HY', name: 'EUR High Yield Liquidity', type: 'Liquidity', currency: 'EUR',
    grid: [{ tenor: 'ON', spread: 15 }, { tenor: '1M', spread: 25 }, { tenor: '1Y', spread: 60 }, { tenor: '5Y', spread: 120 }]
  },
  {
    id: 'RC-COM-SME-A', name: 'SME Commercial Grid A', type: 'Commercial', currency: 'USD',
    grid: [{ tenor: '1Y', spread: 150 }, { tenor: '3Y', spread: 185 }, { tenor: '5Y', spread: 210 }, { tenor: '7Y', spread: 250 }]
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
    productType: 'LOAN_COMM', amount: 12500000, currency: 'USD', marginTarget: 2.25,
    startDate: '2023-10-24', status: 'Booked', businessLine: 'Corp Fin',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 36, amortization: 'Bullet', repricingFreq: 'Monthly',
    riskWeight: 100, capitalRatio: 11.5, targetROE: 15, operationalCostBps: 45,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88393', clientId: 'CL-1002', clientType: 'Corporate',
    productType: 'DEP_TERM', amount: 5000000, currency: 'EUR', marginTarget: 1.50,
    startDate: '2023-10-24', status: 'Pending', businessLine: 'Retail',
    businessUnit: 'BU-002', fundingBusinessUnit: 'BU-900',
    durationMonths: 12, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 15, operationalCostBps: 20,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88394', clientId: 'CL-2001', clientType: 'SME',
    productType: 'LOAN_MORT', amount: 850000, currency: 'USD', marginTarget: 1.85,
    startDate: '2023-10-20', status: 'Review', businessLine: 'Real Estate',
    businessUnit: 'BU-003', fundingBusinessUnit: 'BU-900',
    durationMonths: 120, amortization: 'French', repricingFreq: 'Fixed',
    riskWeight: 35, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 25,
    transitionRisk: 'Green', physicalRisk: 'Medium'
  },
  {
    id: 'TRD-88395', clientId: 'CL-1002', clientType: 'Corporate',
    productType: 'CRED_LINE', amount: 2000000, currency: 'EUR', marginTarget: 2.10,
    startDate: '2023-09-15', status: 'Booked', businessLine: 'Corp Fin',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 24, amortization: 'Bullet', repricingFreq: 'Daily',
    riskWeight: 75, capitalRatio: 11.5, targetROE: 14, operationalCostBps: 35,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88396', clientId: 'CL-4099', clientType: 'Retail',
    productType: 'LOAN_AUTO', amount: 45000, currency: 'GBP', marginTarget: 3.50,
    startDate: '2023-10-22', status: 'Pending', businessLine: 'Retail',
    businessUnit: 'BU-002', fundingBusinessUnit: 'BU-900',
    durationMonths: 48, amortization: 'Linear', repricingFreq: 'Fixed',
    riskWeight: 75, capitalRatio: 11.5, targetROE: 18, operationalCostBps: 80,
    transitionRisk: 'Brown', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88397', clientId: 'CL-3055', clientType: 'Institution',
    productType: 'DEP_TERM', amount: 50000000, currency: 'JPY', marginTarget: 0.15,
    startDate: '2023-10-01', status: 'Booked', businessLine: 'Institutional',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 3, amortization: 'Bullet', repricingFreq: 'Fixed',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 10, operationalCostBps: 5,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88398', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'LOAN_COMM', amount: 25000000, currency: 'USD', marginTarget: 2.00,
    startDate: '2023-08-10', status: 'Booked', businessLine: 'Corp Fin',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 60, amortization: 'Bullet', repricingFreq: 'Quarterly',
    riskWeight: 100, capitalRatio: 11.5, targetROE: 15, operationalCostBps: 40,
    transitionRisk: 'Amber', physicalRisk: 'Medium'
  },
  {
    id: 'TRD-88399', clientId: 'CL-2001', clientType: 'SME',
    productType: 'LOAN_COMM', amount: 350000, currency: 'EUR', marginTarget: 2.75,
    startDate: '2023-10-23', status: 'Rejected', businessLine: 'SME',
    businessUnit: 'BU-003', fundingBusinessUnit: 'BU-900',
    durationMonths: 36, amortization: 'Linear', repricingFreq: 'Monthly',
    riskWeight: 85, capitalRatio: 11.5, targetROE: 16, operationalCostBps: 50,
    transitionRisk: 'Brown', physicalRisk: 'High'
  },
  {
    id: 'TRD-88400', clientId: 'CL-4099', clientType: 'Retail',
    productType: 'LOAN_MORT', amount: 650000, currency: 'USD', marginTarget: 1.60,
    startDate: '2023-09-01', status: 'Booked', businessLine: 'Retail',
    businessUnit: 'BU-002', fundingBusinessUnit: 'BU-900',
    durationMonths: 360, amortization: 'French', repricingFreq: 'Fixed',
    riskWeight: 35, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 20,
    transitionRisk: 'Green', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88401', clientId: 'CL-1001', clientType: 'Corporate',
    productType: 'SWAP_IRS', amount: 10000000, currency: 'USD', marginTarget: 0.10,
    startDate: '2023-10-15', status: 'Booked', businessLine: 'Markets',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 60, amortization: 'Bullet', repricingFreq: 'Quarterly',
    riskWeight: 20, capitalRatio: 11.5, targetROE: 20, operationalCostBps: 10,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88402', clientId: 'CL-4099', clientType: 'Retail',
    productType: 'DEP_CASA', amount: 150000, currency: 'GBP', marginTarget: 2.20,
    startDate: '2023-01-01', status: 'Booked', businessLine: 'Wealth',
    businessUnit: 'BU-004', fundingBusinessUnit: 'BU-900',
    durationMonths: 1, amortization: 'Bullet', repricingFreq: 'Daily',
    riskWeight: 0, capitalRatio: 11.5, targetROE: 25, operationalCostBps: 15,
    transitionRisk: 'Neutral', physicalRisk: 'Low'
  },
  {
    id: 'TRD-88403', clientId: 'CL-3055', clientType: 'Institution',
    productType: 'LOAN_COMM', amount: 75000000, currency: 'USD', marginTarget: 1.25,
    startDate: '2023-10-24', status: 'Review', businessLine: 'Institutional',
    businessUnit: 'BU-001', fundingBusinessUnit: 'BU-900',
    durationMonths: 12, amortization: 'Bullet', repricingFreq: 'Monthly',
    riskWeight: 50, capitalRatio: 11.5, targetROE: 12, operationalCostBps: 10,
    transitionRisk: 'Green', physicalRisk: 'Low'
  },
];
