import type { PipelineNbaRow } from '../../types/clv';

/**
 * Convert a list of PipelineNbaRow into a CSV string.
 *
 * Kept as a pure module (no DOM) so tests verify the exact output
 * byte-for-byte. The Blob + anchor-download dance stays in the view
 * component.
 *
 * Conventions:
 *   - Comma-separated (RFC 4180). Cells containing commas, quotes or
 *     newlines get wrapped in double quotes; internal quotes escape
 *     by doubling.
 *   - Currency is emitted as raw numbers (no locale formatting) so the
 *     file round-trips through Excel / sheets regardless of locale.
 *   - Confidence is emitted as a 0..1 fraction, not a percentage.
 *   - reasonCodes join with a pipe to avoid colliding with the CSV
 *     separator.
 */

const HEADER = [
  'id',
  'clientId',
  'clientName',
  'clientSegment',
  'clientRating',
  'recommendedProduct',
  'recommendedRateBps',
  'recommendedVolumeEur',
  'recommendedCurrency',
  'expectedClvDeltaEur',
  'confidence',
  'reasonCodes',
  'rationale',
  'source',
  'generatedAt',
  'consumedAt',
];

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'number' ? String(value) : String(value);
  if (s === '') return '';
  const needsQuote = /[",\n\r]/.test(s);
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function pipelineRowsToCsv(rows: PipelineNbaRow[]): string {
  const lines = [HEADER.join(',')];
  for (const r of rows) {
    const cells = [
      r.id,
      r.clientId,
      r.clientName,
      r.clientSegment,
      r.clientRating,
      r.recommendedProduct,
      r.recommendedRateBps,
      r.recommendedVolumeEur,
      r.recommendedCurrency,
      r.expectedClvDeltaEur,
      r.confidence,
      r.reasonCodes.join('|'),
      r.rationale,
      r.source,
      r.generatedAt,
      r.consumedAt,
    ];
    lines.push(cells.map(escapeCell).join(','));
  }
  return lines.join('\n');
}

/**
 * Build a filename that embeds the scope (status filter) and the
 * as-of-date so a RM can download snapshots at multiple moments and
 * keep them distinguishable in a folder.
 */
export function pipelineCsvFilename(status: string, now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `pipeline-${status}-${y}${m}${d}-${hh}${mm}.csv`;
}
