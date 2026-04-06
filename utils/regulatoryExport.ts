import type { Transaction } from '../types';

// ─── LCR Report ───────────────────────────────────────────────────

export interface LCRReportRow {
  category: string;
  subcategory: string;
  amount: number;
  weight: number;
  weightedAmount: number;
}

export interface LCRReport {
  entityId: string;
  referenceDate: string;
  hqlaTotal: number;
  outflowsTotal: number;
  inflowsTotal: number;
  lcrRatio: number;
  rows: LCRReportRow[];
}

export function generateLCRReport(
  deals: Transaction[],
  referenceDate: string,
  entityId: string,
): LCRReport {
  const outflowRows: LCRReportRow[] = [];
  const inflowRows: LCRReportRow[] = [];

  for (const deal of deals) {
    if (deal.category === 'Liability') {
      // Deposits — outflows
      const weight = deal.lcrOutflowPct ?? getDefaultOutflowWeight(deal);
      outflowRows.push({
        category: 'Cash Outflows',
        subcategory: classifyLiabilityForLCR(deal),
        amount: deal.amount,
        weight: weight / 100,
        weightedAmount: deal.amount * (weight / 100),
      });
    } else if (deal.category === 'Asset') {
      // Loans — potential inflows (only short-term maturing)
      const weight = deal.durationMonths <= 1 ? 0.5 : 0;
      if (weight > 0) {
        inflowRows.push({
          category: 'Cash Inflows',
          subcategory: `Maturing ${deal.productType}`,
          amount: deal.amount,
          weight,
          weightedAmount: deal.amount * weight,
        });
      }
    }
  }

  const outflowsTotal = outflowRows.reduce((s, r) => s + r.weightedAmount, 0);
  const inflowsTotal = inflowRows.reduce((s, r) => s + r.weightedAmount, 0);
  // Simplified: assume HQLA covers 110% of outflows
  const hqlaTotal = outflowsTotal * 1.1;

  const netOutflows = outflowsTotal - Math.min(inflowsTotal, outflowsTotal * 0.75);
  const lcrRatio = outflowsTotal > 0 ? (hqlaTotal / netOutflows) * 100 : 0;

  return {
    entityId,
    referenceDate,
    hqlaTotal,
    outflowsTotal,
    inflowsTotal,
    lcrRatio,
    rows: [...outflowRows, ...inflowRows],
  };
}

function getDefaultOutflowWeight(deal: Transaction): number {
  if (deal.depositStability === 'Stable') return 5;
  if (deal.depositStability === 'Semi_Stable') return 10;
  if (deal.depositStability === 'Non_Stable') return 20;
  if (deal.clientType === 'Institution') return 100;
  if (deal.clientType === 'Corporate') return 40;
  return 20;
}

function classifyLiabilityForLCR(deal: Transaction): string {
  if (deal.clientType === 'Retail' || deal.clientType === 'SME') {
    return `Retail Deposit (${deal.depositStability ?? 'Non_Stable'})`;
  }
  if (deal.clientType === 'Corporate') {
    return `Corporate Deposit (${deal.depositType ?? 'Non_Operational'})`;
  }
  return 'Institutional Deposit';
}

// ─── NSFR Report ──────────────────────────────────────────────────

export interface NSFRReportRow {
  category: string;
  subcategory: string;
  amount: number;
  factor: number;
  weightedAmount: number;
  side: 'ASF' | 'RSF';
}

export interface NSFRReport {
  entityId: string;
  referenceDate: string;
  asfTotal: number;
  rsfTotal: number;
  nsfrRatio: number;
  rows: NSFRReportRow[];
}

export function generateNSFRReport(
  deals: Transaction[],
  referenceDate: string,
  entityId: string,
): NSFRReport {
  const rows: NSFRReportRow[] = [];

  for (const deal of deals) {
    if (deal.category === 'Liability') {
      const factor = getASFFactor(deal);
      rows.push({
        category: 'Available Stable Funding',
        subcategory: `${deal.productType} (${deal.depositStability ?? 'Unknown'})`,
        amount: deal.amount,
        factor,
        weightedAmount: deal.amount * factor,
        side: 'ASF',
      });
    } else if (deal.category === 'Asset') {
      const factor = getRSFFactor(deal);
      rows.push({
        category: 'Required Stable Funding',
        subcategory: `${deal.productType} (RW: ${deal.riskWeight}%)`,
        amount: deal.amount,
        factor,
        weightedAmount: deal.amount * factor,
        side: 'RSF',
      });
    }
  }

  const asfTotal = rows
    .filter((r) => r.side === 'ASF')
    .reduce((s, r) => s + r.weightedAmount, 0);
  const rsfTotal = rows
    .filter((r) => r.side === 'RSF')
    .reduce((s, r) => s + r.weightedAmount, 0);

  return {
    entityId,
    referenceDate,
    asfTotal,
    rsfTotal,
    nsfrRatio: rsfTotal > 0 ? (asfTotal / rsfTotal) * 100 : 0,
    rows,
  };
}

function getASFFactor(deal: Transaction): number {
  if (deal.depositStability === 'Stable') return 0.95;
  if (deal.depositStability === 'Semi_Stable') return 0.90;
  if (deal.depositStability === 'Non_Stable') return 0.80;
  if (deal.durationMonths < 6) return 0;
  return 0.50;
}

function getRSFFactor(deal: Transaction): number {
  if (deal.durationMonths <= 12) return 0.50;
  if (deal.riskWeight <= 35) return 0.65;
  return 0.85;
}

// ─── IRRBB Report ─────────────────────────────────────────────────

export interface IRRBBScenario {
  name: string;
  shockBps: number;
  niiImpact: number;
  eveImpact: number;
}

export interface IRRBBReport {
  entityId: string;
  referenceDate: string;
  scenarios: IRRBBScenario[];
  totalAssets: number;
  totalLiabilities: number;
  durationGap: number;
}

export function generateIRRBBReport(
  deals: Transaction[],
  referenceDate: string,
  entityId: string,
): IRRBBReport {
  const assets = deals.filter((d) => d.category === 'Asset');
  const liabilities = deals.filter((d) => d.category === 'Liability');

  const totalAssets = assets.reduce((s, d) => s + d.amount, 0);
  const totalLiabilities = liabilities.reduce((s, d) => s + d.amount, 0);

  // Simplified duration gap: weighted average maturity difference (in years)
  const avgAssetDuration =
    assets.length > 0 && totalAssets > 0
      ? assets.reduce((s, d) => s + d.durationMonths * d.amount, 0) / totalAssets / 12
      : 0;
  const avgLiabDuration =
    liabilities.length > 0 && totalLiabilities > 0
      ? liabilities.reduce((s, d) => s + d.durationMonths * d.amount, 0) / totalLiabilities / 12
      : 0;
  const durationGap = avgAssetDuration - avgLiabDuration;

  // EBA GL 2018/02 — 6 standard scenarios
  const ebaScenarios = [
    { name: 'Parallel Up +200bp', shockBps: 200 },
    { name: 'Parallel Down -200bp', shockBps: -200 },
    { name: 'Short Rate Up +250bp', shockBps: 250 },
    { name: 'Short Rate Down -250bp', shockBps: -250 },
    { name: 'Steepener', shockBps: 150 },
    { name: 'Flattener', shockBps: -100 },
  ];

  const scenarios: IRRBBScenario[] = ebaScenarios.map((s) => {
    const niiImpact = totalAssets * (s.shockBps / 10000) * avgAssetDuration * -0.3;
    const eveImpact =
      (totalAssets - totalLiabilities) * durationGap * (s.shockBps / 10000) * -1;
    return {
      name: s.name,
      shockBps: s.shockBps,
      niiImpact: Math.round(niiImpact),
      eveImpact: Math.round(eveImpact),
    };
  });

  return {
    entityId,
    referenceDate,
    scenarios,
    totalAssets,
    totalLiabilities,
    durationGap: Math.round(durationGap * 100) / 100,
  };
}

// ─── XML Export (simplified COREP format) ─────────────────────────

export function exportLCRToXML(report: LCRReport): string {
  const rows = report.rows
    .map(
      (r) =>
        `    <row category="${escapeXml(r.category)}" subcategory="${escapeXml(r.subcategory)}" amount="${r.amount}" weight="${r.weight}" weighted="${r.weightedAmount}" />`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<COREPReport type="LCR" referenceDate="${report.referenceDate}" entityId="${report.entityId}">
  <summary>
    <hqla>${report.hqlaTotal.toFixed(2)}</hqla>
    <outflows>${report.outflowsTotal.toFixed(2)}</outflows>
    <inflows>${report.inflowsTotal.toFixed(2)}</inflows>
    <lcrRatio>${report.lcrRatio.toFixed(2)}</lcrRatio>
  </summary>
  <details>
${rows}
  </details>
</COREPReport>`;
}

export function exportNSFRToXML(report: NSFRReport): string {
  const rows = report.rows
    .map(
      (r) =>
        `    <row side="${r.side}" category="${escapeXml(r.category)}" subcategory="${escapeXml(r.subcategory)}" amount="${r.amount}" factor="${r.factor}" weighted="${r.weightedAmount}" />`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<COREPReport type="NSFR" referenceDate="${report.referenceDate}" entityId="${report.entityId}">
  <summary>
    <asf>${report.asfTotal.toFixed(2)}</asf>
    <rsf>${report.rsfTotal.toFixed(2)}</rsf>
    <nsfrRatio>${report.nsfrRatio.toFixed(2)}</nsfrRatio>
  </summary>
  <details>
${rows}
  </details>
</COREPReport>`;
}

export function exportIRRBBToJSON(report: IRRBBReport): string {
  return JSON.stringify(report, null, 2);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
