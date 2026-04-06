import type { LucideIcon } from 'lucide-react';
import { DollarSign, PieChart, Shield, TrendingUp } from 'lucide-react';
import type { RAROCInputs } from '../../types';
import { calculateRAROC, type RAROCResult } from '../../utils/rarocEngine';

export type NumericFieldType = 'currency' | 'percent';
export type EditableRarocField = Exclude<keyof RAROCInputs, 'transactionId'>;

export interface RarocInputFieldConfig {
  key: EditableRarocField;
  label: string;
  type: NumericFieldType;
}

export interface RarocInputSectionConfig {
  id: string;
  title: string;
  description: string;
  columns: 1 | 2;
  fields: RarocInputFieldConfig[];
}

export interface RarocMetricCardData {
  title: string;
  value: string;
  subtext: string;
  trend: 'positive' | 'negative' | 'neutral';
  tone: 'cyan' | 'emerald' | 'amber' | 'violet';
  icon: LucideIcon;
}

export interface RarocBreakdownRow {
  label: string;
  value: string;
  subtext: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

const RATE_PRECISION = 4;

export const INITIAL_RAROC_INPUTS: RAROCInputs = {
  transactionId: 'DEAL-RAROC-001',
  loanAmt: 1000000,
  osAmt: 1000000,
  ead: 1000000,
  interestRate: 6.5,
  interestSpread: 3,
  cofRate: 3.5,
  rwa: 600000,
  ecl: 5000,
  feeIncome: 10000,
  operatingCostPct: 0.5,
  riskFreeRate: 2.5,
  opRiskCapitalCharge: 0.2,
  minRegCapitalReq: 8,
  hurdleRate: 12,
  pillar2CapitalCharge: 1.5,
};

const RAROC_INPUT_KEYS = [
  'transactionId',
  'loanAmt',
  'osAmt',
  'ead',
  'interestRate',
  'interestSpread',
  'cofRate',
  'rwa',
  'ecl',
  'feeIncome',
  'operatingCostPct',
  'riskFreeRate',
  'opRiskCapitalCharge',
  'minRegCapitalReq',
  'hurdleRate',
  'pillar2CapitalCharge',
] as const satisfies Array<keyof RAROCInputs>;

export const RAROC_INPUT_SECTIONS: RarocInputSectionConfig[] = [
  {
    id: 'exposure',
    title: 'Exposure & Notionals',
    description: 'Core balances that drive annualized revenue, cost, and capital sizing.',
    columns: 1,
    fields: [
      { key: 'loanAmt', label: 'Loan Amount', type: 'currency' },
      { key: 'osAmt', label: 'Outstanding Amount', type: 'currency' },
      { key: 'ead', label: 'Exposure at Default (EAD)', type: 'currency' },
    ],
  },
  {
    id: 'funding',
    title: 'Commercial Stack',
    description: 'Client rate, FTP cost, and spread stay synchronized while you edit.',
    columns: 2,
    fields: [
      { key: 'interestRate', label: 'Client Rate', type: 'percent' },
      { key: 'cofRate', label: 'FTP / COF Rate', type: 'percent' },
      { key: 'interestSpread', label: 'Commercial Spread', type: 'percent' },
      { key: 'feeIncome', label: 'Fee Income', type: 'currency' },
      { key: 'operatingCostPct', label: 'Operating Cost', type: 'percent' },
    ],
  },
  {
    id: 'capital',
    title: 'Risk & Capital',
    description: 'Capital charges and expected loss feed the regulatory capital stack.',
    columns: 2,
    fields: [
      { key: 'rwa', label: 'Risk Weighted Assets', type: 'currency' },
      { key: 'ecl', label: 'Expected Credit Loss', type: 'currency' },
      { key: 'minRegCapitalReq', label: 'Minimum Reg. Capital', type: 'percent' },
      { key: 'hurdleRate', label: 'Hurdle Rate', type: 'percent' },
      { key: 'riskFreeRate', label: 'Risk-Free Rate', type: 'percent' },
      { key: 'pillar2CapitalCharge', label: 'Pillar 2 Charge', type: 'percent' },
      { key: 'opRiskCapitalCharge', label: 'Operational Risk Charge', type: 'percent' },
    ],
  },
];

function roundRate(value: number) {
  return Number(value.toFixed(RATE_PRECISION));
}

export function normalizeRarocInputs(inputs: RAROCInputs | null | undefined): RAROCInputs {
  return { ...INITIAL_RAROC_INPUTS, ...inputs };
}

export function areRarocInputsEqual(left: RAROCInputs, right: RAROCInputs) {
  return RAROC_INPUT_KEYS.every((key) => left[key] === right[key]);
}

export function buildUpdatedRarocInputs(
  current: RAROCInputs,
  key: EditableRarocField,
  nextValue: number,
) {
  const sanitizedValue = Number.isFinite(nextValue) ? nextValue : 0;
  const nextInputs: RAROCInputs = { ...current, [key]: sanitizedValue };

  if (key === 'interestRate') {
    nextInputs.interestSpread = roundRate(sanitizedValue - current.cofRate);
  }

  if (key === 'cofRate') {
    nextInputs.interestSpread = roundRate(current.interestRate - sanitizedValue);
  }

  if (key === 'interestSpread') {
    nextInputs.interestRate = roundRate(current.cofRate + sanitizedValue);
  }

  return nextInputs;
}

export function formatRarocCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatRarocPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function buildRarocResults(inputs: RAROCInputs): RAROCResult {
  return calculateRAROC(inputs);
}

export function buildRarocMetricCards(
  inputs: RAROCInputs,
  results: RAROCResult,
): RarocMetricCardData[] {
  return [
    {
      title: 'RAROC',
      value: formatRarocPercent(results.raroc),
      subtext: `Hurdle ${formatRarocPercent(inputs.hurdleRate)}`,
      trend: results.raroc >= inputs.hurdleRate ? 'positive' : 'negative',
      tone: 'cyan',
      icon: TrendingUp,
    },
    {
      title: 'Economic Profit (EVA)',
      value: formatRarocPercent(results.eva),
      subtext: 'RAROC minus hurdle rate',
      trend: results.eva >= 0 ? 'positive' : 'negative',
      tone: 'emerald',
      icon: Shield,
    },
    {
      title: 'Risk-Adjusted Return',
      value: formatRarocCurrency(results.riskAdjustedReturn),
      subtext: 'Annualized net return',
      trend: results.riskAdjustedReturn >= 0 ? 'positive' : 'negative',
      tone: 'amber',
      icon: DollarSign,
    },
    {
      title: 'Regulatory Capital',
      value: formatRarocCurrency(results.totalRegCapital),
      subtext: 'Credit + Pillar 2 + Operational',
      trend: 'neutral',
      tone: 'violet',
      icon: PieChart,
    },
  ];
}

export function buildRevenueBreakdown(inputs: RAROCInputs, results: RAROCResult): RarocBreakdownRow[] {
  return [
    {
      label: 'Gross Revenue',
      value: formatRarocCurrency(results.grossRevenue),
      subtext: `Spread ${formatRarocPercent(inputs.interestSpread)} over EAD + fees`,
      tone: 'positive',
    },
    {
      label: 'Cost of Funds',
      value: formatRarocCurrency(results.costOfFunds),
      subtext: `${formatRarocPercent(inputs.cofRate)} FTP applied to EAD`,
      tone: 'negative',
    },
    {
      label: 'Expected Credit Loss',
      value: formatRarocCurrency(inputs.ecl),
      subtext: 'Expected provisioning charge',
      tone: 'negative',
    },
    {
      label: 'Operating Cost',
      value: formatRarocCurrency(results.operatingCost),
      subtext: `${formatRarocPercent(inputs.operatingCostPct)} applied to outstanding`,
      tone: 'negative',
    },
    {
      label: 'Capital Income',
      value: formatRarocCurrency(results.capitalIncome),
      subtext: `${formatRarocPercent(inputs.riskFreeRate)} on regulatory capital`,
      tone: 'positive',
    },
  ];
}

export function buildCapitalBreakdown(inputs: RAROCInputs, results: RAROCResult): RarocBreakdownRow[] {
  return [
    {
      label: 'Credit Risk Capital',
      value: formatRarocCurrency(results.creditRiskCapital),
      subtext: `${formatRarocPercent(inputs.minRegCapitalReq)} of RWA`,
    },
    {
      label: 'Pillar 2 Charge',
      value: formatRarocCurrency(results.pillar2Capital),
      subtext: `${formatRarocPercent(inputs.pillar2CapitalCharge)} of EAD`,
    },
    {
      label: 'Operational Risk Charge',
      value: formatRarocCurrency(results.opRiskCapital),
      subtext: `${formatRarocPercent(inputs.opRiskCapitalCharge)} of EAD`,
    },
  ];
}

export function buildCommercialBreakdown(inputs: RAROCInputs, results: RAROCResult): RarocBreakdownRow[] {
  const feeYield = inputs.ead > 0 ? (inputs.feeIncome / inputs.ead) * 100 : 0;
  const capitalDensity = inputs.ead > 0 ? (results.totalRegCapital / inputs.ead) * 100 : 0;

  return [
    {
      label: 'Client Rate',
      value: formatRarocPercent(inputs.interestRate),
      subtext: 'All-in commercial offer',
    },
    {
      label: 'FTP / COF',
      value: formatRarocPercent(inputs.cofRate),
      subtext: 'Funding transfer cost',
    },
    {
      label: 'Commercial Spread',
      value: formatRarocPercent(inputs.interestSpread),
      subtext: 'Client rate minus FTP',
      tone: inputs.interestSpread >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Fee Yield',
      value: formatRarocPercent(feeYield),
      subtext: 'Fee income relative to EAD',
    },
    {
      label: 'Capital Density',
      value: formatRarocPercent(capitalDensity),
      subtext: 'Regulatory capital relative to EAD',
    },
  ];
}
