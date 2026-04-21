import { describe, it, expect } from 'vitest';
import type { PipelineNbaRow } from '../../../types/clv';
import { pipelineRowsToCsv, pipelineCsvFilename } from '../pipelineCsv';

function row(overrides: Partial<PipelineNbaRow> = {}): PipelineNbaRow {
  return {
    id: 'p-1',
    entityId: 'e-1',
    clientId: 'c-1',
    clientName: 'Client A',
    clientSegment: 'Large',
    clientRating: 'A',
    recommendedProduct: 'FX_Hedging',
    recommendedRateBps: 40,
    recommendedVolumeEur: 1_500_000,
    recommendedCurrency: 'EUR',
    expectedClvDeltaEur: 320_000,
    confidence: 0.82,
    reasonCodes: ['product_gap_core', 'renewal_window_open'],
    rationale: 'Hello',
    source: 'engine',
    generatedAt: '2026-04-22T10:00:00Z',
    consumedAt: null,
    consumedBy: null,
    ...overrides,
  };
}

describe('pipelineRowsToCsv', () => {
  it('renders only the header when given zero rows', () => {
    const out = pipelineRowsToCsv([]);
    expect(out.split('\n')).toHaveLength(1);
    expect(out).toMatch(/^id,clientId,/);
  });

  it('emits one data line per row and preserves numeric values raw (no locale)', () => {
    const csv = pipelineRowsToCsv([row()]);
    const [header, line] = csv.split('\n');
    expect(header.split(',')).toContain('expectedClvDeltaEur');
    expect(line).toContain('320000');
    expect(line).toContain('0.82');
  });

  it('joins reasonCodes with pipe (not comma) so the column does not split', () => {
    const csv = pipelineRowsToCsv([row()]);
    const [, line] = csv.split('\n');
    expect(line).toContain('product_gap_core|renewal_window_open');
  });

  it('quotes a cell containing commas and escapes internal quotes', () => {
    const csv = pipelineRowsToCsv([row({
      rationale: 'Bank, "top-tier", EUR book',
    })]);
    const [, line] = csv.split('\n');
    // Expected escape of internal quotes: " → ""
    expect(line).toContain('"Bank, ""top-tier"", EUR book"');
  });

  it('renders null fields as empty cells (no "null" literal)', () => {
    const csv = pipelineRowsToCsv([row({ clientSegment: null, consumedAt: null })]);
    const [, line] = csv.split('\n');
    expect(line).not.toContain('null');
    // Empty cells between commas — detect by the `,,` signature at the
    // position where consumedAt is emitted (last column).
    expect(line.endsWith(',')).toBe(true);
  });
});

describe('pipelineCsvFilename', () => {
  it('embeds status and UTC timestamp for snapshot distinguishability', () => {
    const fake = new Date('2026-04-23T14:05:00Z');
    expect(pipelineCsvFilename('open', fake)).toBe('pipeline-open-20260423-1405.csv');
    expect(pipelineCsvFilename('consumed', fake)).toBe('pipeline-consumed-20260423-1405.csv');
    expect(pipelineCsvFilename('all', fake)).toBe('pipeline-all-20260423-1405.csv');
  });
});
