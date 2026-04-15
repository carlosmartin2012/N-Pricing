import { describe, it, expect } from 'vitest';
import { parsePositionsCsv, parseMetricsCsv } from '../customer360/csvImport';

describe('parsePositionsCsv', () => {
  it('parses a well-formed CSV', () => {
    const csv = [
      'client_id,product_type,category,amount,currency,start_date,margin_bps,status',
      'c-1,MORTGAGE,Asset,180000,EUR,2024-05-01,180,Active',
      'c-2,DEPOSIT,Liability,50000,EUR,2025-01-15,,Active',
    ].join('\n');
    const { rows, errors } = parsePositionsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].productType).toBe('MORTGAGE');
    expect(rows[0].marginBps).toBe(180);
    expect(rows[1].marginBps).toBeNull();
  });

  it('reports missing required columns at row 0', () => {
    const csv = 'client_id,product_type\nc-1,MORTGAGE';
    const { errors } = parsePositionsCsv(csv);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].rowIndex).toBe(0);
  });

  it('rejects rows with invalid category', () => {
    const csv = [
      'client_id,product_type,category,amount,currency,start_date',
      'c-1,MORTGAGE,WrongCat,100,EUR,2024-01-01',
    ].join('\n');
    const { rows, errors } = parsePositionsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].field).toBe('category');
  });

  it('accepts comma-as-decimal for amount (Spanish locale, no thousand separator)', () => {
    const csv = [
      'client_id,product_type,category,amount,currency,start_date',
      'c-1,MORTGAGE,Asset,"180000,55",EUR,2024-01-01',
    ].join('\n');
    const { rows } = parsePositionsCsv(csv);
    expect(rows[0].amount).toBeCloseTo(180000.55, 2);
  });

  it('rejects malformed start_date', () => {
    const csv = [
      'client_id,product_type,category,amount,currency,start_date',
      'c-1,MORTGAGE,Asset,100,EUR,01/01/2024',
    ].join('\n');
    const { rows, errors } = parsePositionsCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].field).toBe('start_date');
  });
});

describe('parseMetricsCsv', () => {
  it('parses required + optional fields', () => {
    const csv = [
      'client_id,period,nim_bps,fees_eur,eva_eur,share_of_wallet_pct,nps_score,source',
      'c-1,2026-Q1,180,500,1200,0.35,65,imported',
    ].join('\n');
    const { rows, errors } = parseMetricsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      clientId: 'c-1',
      period: '2026-Q1',
      nimBps: 180,
      feesEur: 500,
      shareOfWalletPct: 0.35,
      npsScore: 65,
      source: 'imported',
    });
  });

  it('defaults source to imported when missing', () => {
    const csv = ['client_id,period', 'c-1,2026-Q1'].join('\n');
    const { rows } = parseMetricsCsv(csv);
    expect(rows[0].source).toBe('imported');
  });

  it('rounds decimal nps_score to integer', () => {
    const csv = ['client_id,period,nps_score', 'c-1,2026-Q1,65.4'].join('\n');
    const { rows } = parseMetricsCsv(csv);
    expect(rows[0].npsScore).toBe(65);
  });
});
