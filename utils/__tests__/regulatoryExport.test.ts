import { describe, it, expect } from 'vitest';
import {
  generateLCRReport,
  generateNSFRReport,
  generateIRRBBReport,
  exportLCRToXML,
  exportNSFRToXML,
} from '../regulatoryExport';
import type { Transaction } from '../../types';

const mockDeals: Partial<Transaction>[] = [
  {
    id: 'deal-1',
    category: 'Asset',
    productType: 'LOAN_COMM',
    amount: 10_000_000,
    durationMonths: 36,
    riskWeight: 100,
    clientType: 'Corporate',
    currency: 'EUR',
  },
  {
    id: 'deal-2',
    category: 'Liability',
    productType: 'DEP_TERM',
    amount: 8_000_000,
    durationMonths: 12,
    depositStability: 'Stable',
    clientType: 'Retail',
    currency: 'EUR',
    lcrOutflowPct: 5,
  },
  {
    id: 'deal-3',
    category: 'Liability',
    productType: 'DEP_CASA',
    amount: 5_000_000,
    durationMonths: 1,
    depositStability: 'Non_Stable',
    clientType: 'Corporate',
    depositType: 'Non_Operational',
    currency: 'EUR',
  },
];

// ─── LCR ──────────────────────────────────────────────────────────

describe('Regulatory Export — LCR', () => {
  it('generates LCR report with correct structure', () => {
    const report = generateLCRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    expect(report.entityId).toBe('ent-1');
    expect(report.referenceDate).toBe('2026-03-31');
    expect(report.rows.length).toBeGreaterThan(0);
    expect(report.lcrRatio).toBeGreaterThan(0);
  });

  it('classifies deposits by stability', () => {
    const report = generateLCRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const stableRow = report.rows.find((r) => r.subcategory.includes('Stable'));
    expect(stableRow).toBeDefined();
    expect(stableRow!.weight).toBe(0.05);
  });

  it('computes weighted outflows correctly', () => {
    const report = generateLCRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    // deal-2: 8_000_000 * 5% = 400_000
    // deal-3: 5_000_000 * 20% (Non_Stable Corporate default) = 1_000_000
    expect(report.outflowsTotal).toBeCloseTo(1_400_000, 0);
  });

  it('applies no inflows for long-tenor assets', () => {
    const report = generateLCRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const inflowRows = report.rows.filter((r) => r.category === 'Cash Inflows');
    // deal-1 has durationMonths = 36 so weight = 0 → no inflow row
    expect(inflowRows).toHaveLength(0);
  });

  it('hqla is 110% of outflows', () => {
    const report = generateLCRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    expect(report.hqlaTotal).toBeCloseTo(report.outflowsTotal * 1.1, 2);
  });

  it('exports valid XML', () => {
    const report = generateLCRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const xml = exportLCRToXML(report);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('type="LCR"');
    expect(xml).toContain('<lcrRatio>');
    expect(xml).toContain('referenceDate="2026-03-31"');
  });

  it('returns zero lcrRatio when no liabilities', () => {
    const assetsOnly = mockDeals.filter((d) => d.category === 'Asset');
    const report = generateLCRReport(assetsOnly as Transaction[], '2026-03-31', 'ent-1');
    expect(report.lcrRatio).toBe(0);
    expect(report.outflowsTotal).toBe(0);
  });
});

// ─── NSFR ─────────────────────────────────────────────────────────

describe('Regulatory Export — NSFR', () => {
  it('generates NSFR report with ASF and RSF', () => {
    const report = generateNSFRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    expect(report.asfTotal).toBeGreaterThan(0);
    expect(report.rsfTotal).toBeGreaterThan(0);
    expect(report.nsfrRatio).toBeGreaterThan(0);
  });

  it('applies correct ASF factor for Stable deposits', () => {
    const report = generateNSFRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const stableRow = report.rows.find(
      (r) => r.side === 'ASF' && r.subcategory.includes('Stable'),
    );
    expect(stableRow?.factor).toBe(0.95);
  });

  it('applies correct ASF factor for Non_Stable deposits', () => {
    const report = generateNSFRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const nonStableRow = report.rows.find(
      (r) => r.side === 'ASF' && r.subcategory.includes('Non_Stable'),
    );
    expect(nonStableRow?.factor).toBe(0.80);
  });

  it('applies 50% RSF for asset with duration ≤ 12 months', () => {
    const shortAsset: Partial<Transaction>[] = [
      {
        id: 'deal-short',
        category: 'Asset',
        productType: 'LOAN',
        amount: 1_000_000,
        durationMonths: 6,
        riskWeight: 100,
        clientType: 'Corporate',
        currency: 'EUR',
      },
    ];
    const report = generateNSFRReport(shortAsset as Transaction[], '2026-03-31', 'ent-1');
    const row = report.rows.find((r) => r.side === 'RSF');
    expect(row?.factor).toBe(0.50);
  });

  it('applies 85% RSF for long-tenor high-risk-weight asset', () => {
    const report = generateNSFRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const rsf = report.rows.find((r) => r.side === 'RSF');
    // deal-1: durationMonths=36 > 12, riskWeight=100 > 35 → 0.85
    expect(rsf?.factor).toBe(0.85);
  });

  it('exports valid XML', () => {
    const report = generateNSFRReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const xml = exportNSFRToXML(report);
    expect(xml).toContain('type="NSFR"');
    expect(xml).toContain('<nsfrRatio>');
    expect(xml).toContain('<asf>');
    expect(xml).toContain('<rsf>');
  });

  it('returns zero nsfrRatio when no assets', () => {
    const liabsOnly = mockDeals.filter((d) => d.category === 'Liability');
    const report = generateNSFRReport(liabsOnly as Transaction[], '2026-03-31', 'ent-1');
    expect(report.nsfrRatio).toBe(0);
    expect(report.rsfTotal).toBe(0);
  });
});

// ─── IRRBB ────────────────────────────────────────────────────────

describe('Regulatory Export — IRRBB', () => {
  it('generates 6 EBA standard scenarios', () => {
    const report = generateIRRBBReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    expect(report.scenarios).toHaveLength(6);
  });

  it('first scenario is Parallel Up', () => {
    const report = generateIRRBBReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    expect(report.scenarios[0].name).toContain('Parallel Up');
    expect(report.scenarios[0].shockBps).toBe(200);
  });

  it('includes Parallel Down, Short Rate Up/Down, Steepener, Flattener', () => {
    const report = generateIRRBBReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    const names = report.scenarios.map((s) => s.name);
    expect(names).toContain('Parallel Down -200bp');
    expect(names).toContain('Short Rate Up +250bp');
    expect(names).toContain('Short Rate Down -250bp');
    expect(names).toContain('Steepener');
    expect(names).toContain('Flattener');
  });

  it('calculates totalAssets and totalLiabilities correctly', () => {
    const report = generateIRRBBReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    expect(report.totalAssets).toBe(10_000_000);
    expect(report.totalLiabilities).toBe(13_000_000);
  });

  it('durationGap is a number', () => {
    const report = generateIRRBBReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    expect(typeof report.durationGap).toBe('number');
  });

  it('NII and EVE impacts are integers (Math.round applied)', () => {
    const report = generateIRRBBReport(mockDeals as Transaction[], '2026-03-31', 'ent-1');
    for (const s of report.scenarios) {
      expect(s.niiImpact).toBe(Math.round(s.niiImpact));
      expect(s.eveImpact).toBe(Math.round(s.eveImpact));
    }
  });

  it('handles empty deal list gracefully', () => {
    const report = generateIRRBBReport([], '2026-03-31', 'ent-1');
    expect(report.totalAssets).toBe(0);
    expect(report.totalLiabilities).toBe(0);
    expect(report.durationGap).toBe(0);
    expect(report.scenarios).toHaveLength(6);
    for (const s of report.scenarios) {
      expect(s.niiImpact).toBeCloseTo(0, 0);
      expect(s.eveImpact).toBeCloseTo(0, 0);
    }
  });
});
