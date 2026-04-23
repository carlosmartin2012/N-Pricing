import { describe, expect, it } from 'vitest';
import { buildStressPricingCsv, type StressRow } from '../stressPricingCsv';

const baseRow: StressRow = {
  scenarioId: 'base',
  scenarioLabel: 'Base',
  ftpPct: 3.1234,
  deltaFtpBps: 0,
  marginPct: 1.5,
  deltaMarginBps: 0,
  rarocPct: 15.2,
  deltaRarocPp: 0,
};

const upRow: StressRow = {
  scenarioId: 'parallel_up_200',
  scenarioLabel: 'Parallel +200 bp',
  ftpPct: 5.1234,
  deltaFtpBps: 200,
  marginPct: 1.1,
  deltaMarginBps: -40,
  rarocPct: 12.2,
  deltaRarocPp: -3,
};

describe('buildStressPricingCsv', () => {
  it('emits header + one line per scenario', () => {
    const csv = buildStressPricingCsv('DEAL-1', [baseRow, upRow]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].split(',')).toEqual([
      'deal_id',
      'scenario_id',
      'scenario_label',
      'ftp_pct',
      'delta_ftp_bps',
      'margin_pct',
      'delta_margin_bps',
      'raroc_pct',
      'delta_raroc_pp',
    ]);
  });

  it('leaves delta columns empty for the base row', () => {
    const csv = buildStressPricingCsv('DEAL-1', [baseRow]);
    const fields = csv.split('\n')[1].split(',');
    expect(fields[4]).toBe(''); // delta_ftp_bps
    expect(fields[6]).toBe(''); // delta_margin_bps
    expect(fields[8]).toBe(''); // delta_raroc_pp
  });

  it('formats numeric fields with fixed decimals', () => {
    const csv = buildStressPricingCsv('DEAL-1', [upRow]);
    const fields = csv.split('\n')[1].split(',');
    expect(fields[3]).toBe('5.1234');  // ftp_pct
    expect(fields[4]).toBe('200.00');  // delta_ftp_bps
    expect(fields[8]).toBe('-3.0000'); // delta_raroc_pp
  });

  it('escapes commas and quotes in string fields', () => {
    const csv = buildStressPricingCsv('DEAL,WITH"QUOTE', [
      { ...upRow, scenarioLabel: 'Custom, label' },
    ]);
    const line = csv.split('\n')[1];
    expect(line).toContain('"DEAL,WITH""QUOTE"');
    expect(line).toContain('"Custom, label"');
  });

  it('guards against non-finite numbers', () => {
    const csv = buildStressPricingCsv('DEAL-1', [
      { ...upRow, ftpPct: Number.NaN, rarocPct: Number.POSITIVE_INFINITY },
    ]);
    const fields = csv.split('\n')[1].split(',');
    expect(fields[3]).toBe('0'); // NaN → '0'
    expect(fields[7]).toBe('0'); // Infinity → '0'
  });
});
