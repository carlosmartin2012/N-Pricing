import type { EntryPair } from '../../types/reconciliation';

/**
 * RFC 4180 CSV export of reconciliation entries. Pure module — no DOM,
 * no Blob; the caller wraps the string in a download. Same pattern as
 * pipelineCsv.ts so future controller export needs reuse the helper.
 */

const HEADER = [
  'dealId',
  'clientId',
  'clientName',
  'businessUnit',
  'productType',
  'matchStatus',
  'amountDeltaEur',
  'rateDeltaPct',
  'buAmountEur',
  'buCurrency',
  'buRatePct',
  'buPostedAt',
  'treasuryAmountEur',
  'treasuryCurrency',
  'treasuryRatePct',
  'treasuryPostedAt',
  'hint',
];

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : String(value);
  if (s === '') return '';
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function reconciliationPairsToCsv(pairs: EntryPair[]): string {
  const lines = [HEADER.join(',')];
  for (const p of pairs) {
    const cells = [
      p.dealId,
      p.clientId,
      p.clientName,
      p.businessUnit,
      p.productType,
      p.matchStatus,
      p.amountDeltaEur,
      p.rateDeltaPct,
      p.bu?.amountEur ?? null,
      p.bu?.currency ?? null,
      p.bu?.ratePct ?? null,
      p.bu?.postedAt ?? null,
      p.treasury?.amountEur ?? null,
      p.treasury?.currency ?? null,
      p.treasury?.ratePct ?? null,
      p.treasury?.postedAt ?? null,
      p.hint,
    ];
    lines.push(cells.map(escapeCell).join(','));
  }
  return lines.join('\n');
}

export function reconciliationCsvFilename(period: string, status: string, now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `reconciliation-${period}-${status}-${y}${m}${d}.csv`;
}
