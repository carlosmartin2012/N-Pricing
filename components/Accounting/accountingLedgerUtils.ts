import type {
  ApprovalMatrixConfig,
  BusinessUnit,
  ProductDefinition,
  Transaction,
} from '../../types';
import { calculatePricing, type PricingContext } from '../../utils/pricingEngine';

export type LedgerEntryType = 'LOAN' | 'DEPOSIT' | 'COMMITMENT';

export interface LedgerEntry {
  id: string;
  timestamp: string;
  unit: string;
  type: LedgerEntryType;
  product: string;
  amount: number;
  clientRate: number;
  ftpRate: number;
  margin: number;
  currency: string;
  status: 'POSTED' | 'PENDING';
  ftpComponents: {
    baseRate: number;
    liquidityPrem: number;
    strategicAdj: number;
  };
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface LedgerSummary {
  assets: CurrencyAmount[];
  liabilities: CurrencyAmount[];
  commitments: CurrencyAmount[];
  ftpIncome: CurrencyAmount[];
}

function getLedgerEntryType(deal: Transaction): LedgerEntryType {
  if (deal.category === 'Liability') {
    return 'DEPOSIT';
  }

  if (deal.category === 'Off-Balance') {
    return 'COMMITMENT';
  }

  return 'LOAN';
}

function getLedgerEntryStatus(deal: Transaction): 'POSTED' | 'PENDING' {
  return deal.status === 'Booked' ? 'POSTED' : 'PENDING';
}

function buildCurrencyBreakdown(entries: Array<{ currency: string; amount: number }>) {
  const totals = new Map<string, number>();

  for (const entry of entries) {
    totals.set(entry.currency, (totals.get(entry.currency) || 0) + entry.amount);
  }

  return Array.from(totals.entries())
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

export function buildLedgerEntries(
  deals: Transaction[],
  approvalMatrix: ApprovalMatrixConfig,
  pricingContext: PricingContext,
  businessUnits: BusinessUnit[],
  products: ProductDefinition[],
) {
  return deals
    .filter(
      (deal) =>
        deal.status === 'Booked' ||
        deal.status === 'Approved' ||
        deal.status === 'Pending_Approval',
    )
    .map((deal): LedgerEntry => {
      const pricingResult = calculatePricing(deal, approvalMatrix, pricingContext);
      const businessUnitName =
        businessUnits.find((businessUnit) => businessUnit.id === deal.businessUnit)?.name ||
        deal.businessUnit;
      const productName =
        products.find((product) => product.id === deal.productType)?.name || deal.productType;

      return {
        id: deal.id || 'N/A',
        timestamp: deal.startDate || new Date().toISOString().split('T')[0],
        unit: businessUnitName,
        type: getLedgerEntryType(deal),
        product: productName,
        amount: deal.amount || 0,
        clientRate: pricingResult.finalClientRate,
        ftpRate: pricingResult.totalFTP,
        margin: pricingResult.finalClientRate - pricingResult.totalFTP,
        currency: deal.currency || 'USD',
        status: getLedgerEntryStatus(deal),
        ftpComponents: {
          baseRate: pricingResult.baseRate,
          liquidityPrem: pricingResult.liquiditySpread,
          strategicAdj: pricingResult.strategicSpread,
        },
      };
    });
}

export function summarizeLedgerEntries(entries: LedgerEntry[]): LedgerSummary {
  return {
    assets: buildCurrencyBreakdown(
      entries
        .filter((entry) => entry.type === 'LOAN')
        .map((entry) => ({ currency: entry.currency, amount: entry.amount })),
    ),
    liabilities: buildCurrencyBreakdown(
      entries
        .filter((entry) => entry.type === 'DEPOSIT')
        .map((entry) => ({ currency: entry.currency, amount: entry.amount })),
    ),
    commitments: buildCurrencyBreakdown(
      entries
        .filter((entry) => entry.type === 'COMMITMENT')
        .map((entry) => ({ currency: entry.currency, amount: entry.amount })),
    ),
    ftpIncome: buildCurrencyBreakdown(
      entries.map((entry) => ({
        currency: entry.currency,
        amount: entry.amount * (entry.margin / 100),
      })),
    ),
  };
}

export function formatCurrencyAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRate(rate: number) {
  if (!Number.isFinite(rate)) return '—%';
  return `${rate.toFixed(2)}%`;
}
