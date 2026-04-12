/**
 * Regulatory Reporting Templates
 * Generates LCR and NSFR reports from portfolio data.
 */

import type { Transaction, FTPResult } from '../types';
import { LCR_OUTFLOW_TABLE, NSFR_ASF_TABLE, NSFR_RSF_TABLE } from '../constants/regulations';

// ─── LCR Report ────────────────────────────────────────────────────────────

export interface LCRReportLine {
  category: string;
  subcategory: string;
  totalAmount: number;
  weightedAmount: number;     // amount × factor
  factor: number;
  dealCount: number;
}

export interface LCRReport {
  reportDate: string;
  currency: string;
  // Outflows
  outflows: LCRReportLine[];
  totalOutflows: number;
  // Inflows (simplified)
  inflows: LCRReportLine[];
  totalInflows: number;
  // Net
  netOutflows: number;
  // HQLA (simplified)
  hqlaTotal: number;
  // Ratio
  lcrRatio: number;
}

export function generateLCRReport(
  deals: Transaction[],
  results: Map<string, FTPResult>,
  hqlaEstimate: number = 0,
  currency: string = 'USD',
): LCRReport {
  const outflowMap = new Map<string, LCRReportLine>();
  const inflowMap = new Map<string, LCRReportLine>();

  for (const deal of deals) {
    if (deal.category === 'Liability') {
      const stability = deal.depositStability || 'Non_Stable';
      const key = `${deal.productType}_${stability}`;
      const factor = LCR_OUTFLOW_TABLE[key] || 0.10;

      const existing = outflowMap.get(key) || {
        category: 'Deposit Outflows',
        subcategory: `${deal.productType} - ${stability}`,
        totalAmount: 0,
        weightedAmount: 0,
        factor,
        dealCount: 0,
      };

      existing.totalAmount += deal.amount;
      existing.weightedAmount += deal.amount * factor;
      existing.dealCount += 1;
      outflowMap.set(key, existing);
    }

    if (deal.category === 'Asset' && deal.durationMonths <= 12) {
      const key = `inflow_${deal.productType}`;
      const factor = 0.50; // simplified: 50% inflow factor for maturing assets

      const existing = inflowMap.get(key) || {
        category: 'Asset Inflows',
        subcategory: deal.productType,
        totalAmount: 0,
        weightedAmount: 0,
        factor,
        dealCount: 0,
      };

      existing.totalAmount += deal.amount;
      existing.weightedAmount += deal.amount * factor;
      existing.dealCount += 1;
      inflowMap.set(key, existing);
    }
  }

  const outflows = Array.from(outflowMap.values());
  const inflows = Array.from(inflowMap.values());
  const totalOutflows = outflows.reduce((s, l) => s + l.weightedAmount, 0);
  const totalInflows = Math.min(
    inflows.reduce((s, l) => s + l.weightedAmount, 0),
    totalOutflows * 0.75, // LCR cap: inflows capped at 75% of outflows
  );
  const netOutflows = totalOutflows - totalInflows;
  const lcrRatio = netOutflows > 0 && Number.isFinite(hqlaEstimate)
    ? (hqlaEstimate / netOutflows) * 100
    : 999;

  return {
    reportDate: new Date().toISOString().slice(0, 10),
    currency,
    outflows,
    totalOutflows,
    inflows,
    totalInflows,
    netOutflows,
    hqlaTotal: hqlaEstimate,
    lcrRatio: Math.round(lcrRatio * 100) / 100,
  };
}

// ─── NSFR Report ───────────────────────────────────────────────────────────

export interface NSFRReportLine {
  category: string;
  subcategory: string;
  totalAmount: number;
  weightedAmount: number;
  factor: number;
  dealCount: number;
}

export interface NSFRReport {
  reportDate: string;
  currency: string;
  asf: NSFRReportLine[];       // Available Stable Funding
  totalASF: number;
  rsf: NSFRReportLine[];       // Required Stable Funding
  totalRSF: number;
  nsfrRatio: number;
}

export function generateNSFRReport(
  deals: Transaction[],
  results: Map<string, FTPResult>,
  currency: string = 'USD',
): NSFRReport {
  const asfMap = new Map<string, NSFRReportLine>();
  const rsfMap = new Map<string, NSFRReportLine>();

  for (const deal of deals) {
    if (deal.category === 'Liability') {
      const stability = deal.depositStability || 'Non_Stable';
      const asfKey = stability === 'Stable' ? 'STABLE_DEPOSIT'
        : stability === 'Semi_Stable' ? 'SEMI_STABLE_DEPOSIT'
        : 'NON_STABLE_DEPOSIT';
      const factor = NSFR_ASF_TABLE[asfKey] || 0.80;

      const existing = asfMap.get(asfKey) || {
        category: 'Available Stable Funding',
        subcategory: `${deal.productType} - ${stability}`,
        totalAmount: 0,
        weightedAmount: 0,
        factor,
        dealCount: 0,
      };

      existing.totalAmount += deal.amount;
      existing.weightedAmount += deal.amount * factor;
      existing.dealCount += 1;
      asfMap.set(asfKey, existing);
    }

    if (deal.category === 'Asset') {
      const rw = deal.riskWeight || 100;
      const isLongTerm = deal.durationMonths > 12;
      let rsfKey: string;

      if (deal.productType === 'LOAN_MORT') {
        rsfKey = rw <= 35 ? 'MORTGAGE_RW_LT35' : 'MORTGAGE_RW_GT35';
      } else if (isLongTerm) {
        rsfKey = rw <= 35 ? 'LOAN_GT1Y_CORP_RW_LT35' : 'LOAN_GT1Y_CORP_RW_GT35';
      } else {
        rsfKey = 'LOAN_LT1Y_CORP';
      }

      const factor = NSFR_RSF_TABLE[rsfKey] || 0.85;

      const existing = rsfMap.get(rsfKey) || {
        category: 'Required Stable Funding',
        subcategory: `${deal.productType} (${isLongTerm ? '>1Y' : '<1Y'}, RW=${rw}%)`,
        totalAmount: 0,
        weightedAmount: 0,
        factor,
        dealCount: 0,
      };

      existing.totalAmount += deal.amount;
      existing.weightedAmount += deal.amount * factor;
      existing.dealCount += 1;
      rsfMap.set(rsfKey, existing);
    }
  }

  const asf = Array.from(asfMap.values());
  const rsf = Array.from(rsfMap.values());
  const totalASF = asf.reduce((s, l) => s + l.weightedAmount, 0);
  const totalRSF = rsf.reduce((s, l) => s + l.weightedAmount, 0);
  const nsfrRatio = totalRSF > 0 && Number.isFinite(totalASF) ? (totalASF / totalRSF) * 100 : 999;

  return {
    reportDate: new Date().toISOString().slice(0, 10),
    currency,
    asf,
    totalASF,
    rsf,
    totalRSF,
    nsfrRatio: Math.round(nsfrRatio * 100) / 100,
  };
}
