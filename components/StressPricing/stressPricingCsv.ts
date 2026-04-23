/**
 * Pure CSV builder for the Stress Pricing grid — Ola 6 Bloque B.5.
 * Kept pure (no DOM, no side effects) so it can be unit-tested without jsdom
 * and reused from any export path (server-side report, future PDF, etc.).
 */

export interface StressRow {
  scenarioId: string;
  scenarioLabel: string;
  ftpPct: number;
  deltaFtpBps: number;
  marginPct: number;
  deltaMarginBps: number;
  rarocPct: number;
  deltaRarocPp: number;
}

const HEADER = [
  'deal_id',
  'scenario_id',
  'scenario_label',
  'ftp_pct',
  'delta_ftp_bps',
  'margin_pct',
  'delta_margin_bps',
  'raroc_pct',
  'delta_raroc_pp',
];

const escape = (v: string): string =>
  /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;

const num = (v: number, decimals: number): string =>
  Number.isFinite(v) ? v.toFixed(decimals) : '0';

export function buildStressPricingCsv(dealId: string, rows: StressRow[]): string {
  const lines = [HEADER.join(',')];
  for (const row of rows) {
    const isBase = row.scenarioId === 'base';
    lines.push([
      escape(dealId),
      escape(row.scenarioId),
      escape(row.scenarioLabel),
      num(row.ftpPct, 4),
      isBase ? '' : num(row.deltaFtpBps, 2),
      num(row.marginPct, 4),
      isBase ? '' : num(row.deltaMarginBps, 2),
      num(row.rarocPct, 4),
      isBase ? '' : num(row.deltaRarocPp, 4),
    ].join(','));
  }
  return lines.join('\n');
}
