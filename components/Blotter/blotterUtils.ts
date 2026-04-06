import { INITIAL_DEAL } from '../../constants';
import type {
  ProductDefinition,
  Transaction,
} from '../../types';

type ImportRow = Record<string, unknown>;

export const DEAL_BLOTTER_TEMPLATE = "id,clientId,clientType,productType,amount,currency,startDate,durationMonths,marginTarget,riskWeight,capitalRatio,targetROE,operationalCostBps,status\nTRD-90001,CL-1001,Corporate,LOAN_COMM,2500000,USD,2023-10-25,24,2.5,100,11.5,15,45,Pending\nTRD-90002,CL-1002,Corporate,DEP_TERM,500000,EUR,2023-10-25,12,1.2,0,11.5,12,20,Pending";

const DEFAULT_STATUS: Transaction['status'] = 'Draft';

const readString = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const readNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const todayIso = () => new Date().toISOString().split('T')[0];

export const generateDealId = () =>
  `TRD-${Date.now().toString(36).toUpperCase()}`;

const resolveProductCategory = (
  productType: string,
  products: ProductDefinition[],
  fallback: Transaction['category'],
) => products.find(product => product.id === productType)?.category ?? fallback;

export const normalizeDealDraft = (
  draft: Partial<Transaction>,
  products: ProductDefinition[],
  overrides: Partial<Transaction> = {},
): Transaction => {
  const productType = readString(
    overrides.productType ?? draft.productType,
    INITIAL_DEAL.productType,
  );
  const category = resolveProductCategory(
    productType,
    products,
    (overrides.category ?? draft.category ?? INITIAL_DEAL.category) as Transaction['category'],
  );

  return {
    ...INITIAL_DEAL,
    ...draft,
    ...overrides,
    id: readString(overrides.id ?? draft.id, generateDealId()),
    startDate: readString(overrides.startDate ?? draft.startDate, todayIso()),
    productType,
    category,
    status: (overrides.status ?? draft.status ?? DEFAULT_STATUS) as Transaction['status'],
    clientType: readString(overrides.clientType ?? draft.clientType),
    businessLine: readString(overrides.businessLine ?? draft.businessLine, INITIAL_DEAL.businessLine),
  };
};

export const createImportedDeal = (
  row: ImportRow,
  products: ProductDefinition[],
): Transaction =>
  normalizeDealDraft(
    {
      id: readString(row.id ?? row.ID, `TRD-IMP-${Math.floor(Math.random() * 100000)}`),
      clientId: readString(row.clientId ?? row.ClientID, 'Unknown'),
      clientType: readString(row.clientType ?? row.ClientType, 'Corporate'),
      productType: readString(row.productType ?? row.ProductType, INITIAL_DEAL.productType),
      amount: readNumber(row.amount ?? row.Amount, 0),
      currency: readString(row.currency ?? row.Currency, INITIAL_DEAL.currency),
      startDate: readString(row.startDate ?? row.StartDate, todayIso()),
      durationMonths: readNumber(row.durationMonths ?? row.DurationMonths, 12),
      amortization: readString(row.amortization ?? row.Amortization, INITIAL_DEAL.amortization) as Transaction['amortization'],
      repricingFreq: readString(row.repricingFreq ?? row.RepricingFreq, INITIAL_DEAL.repricingFreq) as Transaction['repricingFreq'],
      marginTarget: readNumber(row.marginTarget ?? row.MarginTarget, 0),
      riskWeight: readNumber(row.riskWeight ?? row.RiskWeight, 100),
      capitalRatio: readNumber(row.capitalRatio ?? row.CapitalRatio, 11.5),
      targetROE: readNumber(row.targetROE ?? row.TargetROE, 15),
      operationalCostBps: readNumber(row.operationalCostBps ?? row.OperationalCostBps, 40),
      lcrOutflowPct: readNumber(row.lcrOutflowPct ?? row.LCROutflowPct, 0),
      category: readString(row.category ?? row.Category, INITIAL_DEAL.category) as Transaction['category'],
      status: readString(row.status ?? row.Status, 'Pending') as Transaction['status'],
      businessLine: 'Imported',
      businessUnit: 'BU-001',
      fundingBusinessUnit: 'BU-900',
      transitionRisk: 'Neutral',
      physicalRisk: 'Low',
    },
    products,
  );

export const createNewDealDraft = (
  products: ProductDefinition[],
): Transaction =>
  normalizeDealDraft(
    {
      id: generateDealId(),
      status: 'Pending',
      amount: 1000000,
      marginTarget: 2,
      businessLine: 'Corp Fin',
    },
    products,
  );

export const formatDealCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

const serializeCsvCell = (value: unknown) =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

export const buildDealsCsv = (deals: Transaction[]) => {
  const headers = [
    'ID',
    'Client',
    'Type',
    'Product',
    'Amount',
    'Currency',
    'Tenor',
    'Margin',
    'Status',
    'BU',
    'StartDate',
    'RiskWeight',
  ];

  const rows = deals.map(deal => ([
    deal.id,
    deal.clientId,
    deal.clientType,
    deal.productType,
    deal.amount,
    deal.currency,
    `${deal.durationMonths}M`,
    deal.marginTarget?.toFixed(2),
    deal.status || DEFAULT_STATUS,
    deal.businessUnit,
    deal.startDate,
    deal.riskWeight,
  ].map(serializeCsvCell).join(',')));

  return [headers.map(serializeCsvCell).join(','), ...rows].join('\n');
};
