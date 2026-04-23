import { describe, it, expect } from 'vitest';
import { parseMarketBenchmarksCsv } from '../csvImport';

const VALID_HEADER = 'productType,tenorBucket,clientType,currency,rate,source,asOfDate,notes';

describe('parseMarketBenchmarksCsv', () => {
  it('parses a well-formed CSV with all optional fields', () => {
    const csv = [
      VALID_HEADER,
      'LOAN_COMM,MT,Corporate,EUR,4.22,BBG,2026-04-23,Corporate MT EUR',
      'MORTGAGE,LT,Retail,EUR,3.85%,BdE,2026-04-23,',
    ].join('\n');

    const { rows, errors } = parseMarketBenchmarksCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ productType: 'LOAN_COMM', tenorBucket: 'MT', rate: 4.22, source: 'BBG', notes: 'Corporate MT EUR' });
    // Percent suffix is accepted and stripped
    expect(rows[1].rate).toBe(3.85);
    expect(rows[1].notes).toBeNull();
  });

  it('defaults asOfDate to today when omitted', () => {
    const csv = [
      'productType,tenorBucket,clientType,currency,rate,source',
      'LOAN_COMM,MT,Corporate,EUR,4.22,BBG',
    ].join('\n');
    const { rows } = parseMarketBenchmarksCsv(csv);
    expect(rows[0].asOfDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects files missing required columns', () => {
    const csv = ['productType,tenorBucket,rate', 'LOAN_COMM,MT,4.22'].join('\n');
    const { rows, errors } = parseMarketBenchmarksCsv(csv);
    expect(rows).toEqual([]);
    expect(errors[0].message).toMatch(/missing_required_columns/);
    expect(errors[0].message).toMatch(/clientType/);
    expect(errors[0].message).toMatch(/source/);
  });

  it('flags invalid tenor, invalid rate, out-of-range rate, bad date per row', () => {
    const csv = [
      VALID_HEADER,
      'LOAN_COMM,XL,Corporate,EUR,4.22,BBG,2026-04-23,',  // bad tenor
      'LOAN_COMM,MT,Corporate,EUR,abc,BBG,2026-04-23,',    // not a number
      'LOAN_COMM,MT,Corporate,EUR,99,BBG,2026-04-23,',     // out of range
      'LOAN_COMM,MT,Corporate,EUR,4.22,BBG,23-04-2026,',   // bad date format
      'LOAN_COMM,MT,Corporate,EUR,4.22,BBG,2026-04-23,',   // valid — control
    ].join('\n');

    const { rows, errors } = parseMarketBenchmarksCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(4);
    expect(errors.map((e) => e.field)).toEqual(['tenorBucket', 'rate', 'rate', 'asOfDate']);
  });

  it('flags missing required fields per row without aborting the file', () => {
    const csv = [
      VALID_HEADER,
      ',MT,Corporate,EUR,4.22,BBG,2026-04-23,',            // missing productType
      'LOAN_COMM,MT,Corporate,EUR,4.22,BBG,2026-04-23,',   // valid
    ].join('\n');
    const { rows, errors } = parseMarketBenchmarksCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('missing_required_field');
  });

  it('handles quoted fields containing commas', () => {
    const csv = [
      VALID_HEADER,
      'LOAN_COMM,MT,Corporate,EUR,4.22,BBG,2026-04-23,"Corporate, MT, EUR"',
    ].join('\n');
    const { rows, errors } = parseMarketBenchmarksCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0].notes).toBe('Corporate, MT, EUR');
  });

  it('returns empty_csv error for empty input', () => {
    const { rows, errors } = parseMarketBenchmarksCsv('');
    expect(rows).toEqual([]);
    expect(errors[0].message).toBe('empty_csv');
  });

  it('is tolerant to CRLF line endings', () => {
    const csv = `${VALID_HEADER}\r\nLOAN_COMM,MT,Corporate,EUR,4.22,BBG,2026-04-23,\r\n`;
    const { rows, errors } = parseMarketBenchmarksCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });
});
