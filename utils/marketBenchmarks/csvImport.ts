/**
 * Market benchmarks CSV importer — Ola 6 Bloque D.2.
 *
 * Pure function: accepts a CSV string and returns parsed rows + per-row
 * errors. Persistence is the caller's responsibility (the server route
 * does the batched INSERTs/upserts). This mirrors the pattern established
 * in `utils/customer360/csvImport.ts` — keeps parsing deterministic and
 * unit-testable without a DB.
 *
 * CSV dialect:
 *   - Header row required.
 *   - Required columns: productType, tenorBucket, clientType, currency,
 *     rate, source.
 *   - Optional: asOfDate (defaults to today UTC), notes.
 *   - Field order is irrelevant; lookup is by header name (case-insensitive).
 *   - Rates can be supplied as "4.22" or "4.22%" — both are normalised.
 *   - Empty strings → null for nullable fields.
 *
 * Validation matches the server route guard (tenorBucket ∈ ST|MT|LT,
 * 0 ≤ rate ≤ 50). Invalid rows are collected in `errors`, valid ones in
 * `rows`. Caller decides whether partial success is acceptable.
 */

import type { MarketBenchmark } from '../marketBenchmarks';

export interface ParseError {
  rowIndex: number;
  field?: string;
  message: string;
  raw?: string;
}

export interface ParseResult<T> {
  rows: T[];
  errors: ParseError[];
}

export type ParsedBenchmark = MarketBenchmark & { notes: string | null };

const TENOR_BUCKETS = new Set<MarketBenchmark['tenorBucket']>(['ST', 'MT', 'LT']);
const REQUIRED_COLUMNS = ['productType', 'tenorBucket', 'clientType', 'currency', 'rate', 'source'] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === ',') { cells.push(cur); cur = ''; }
      else if (c === '"' && cur.length === 0) inQuotes = true;
      else cur += c;
    }
  }
  cells.push(cur);
  return cells.map((s) => s.trim());
}

function indexOf(header: string[], name: string): number {
  return header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
}

function cell(row: string[], idx: number): string | null {
  if (idx < 0 || idx >= row.length) return null;
  const v = row[idx].trim();
  return v.length === 0 ? null : v;
}

function parseRate(raw: string): number | null {
  const cleaned = raw.replace(/%$/, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseMarketBenchmarksCsv(text: string): ParseResult<ParsedBenchmark> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length > 0);
  const errors: ParseError[] = [];

  if (lines.length === 0) {
    return { rows: [], errors: [{ rowIndex: 0, message: 'empty_csv' }] };
  }

  const header = splitCsvLine(lines[0]);
  const missing = REQUIRED_COLUMNS.filter((c) => indexOf(header, c) < 0);
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ rowIndex: 0, message: `missing_required_columns: ${missing.join(',')}` }],
    };
  }

  const idx = {
    productType: indexOf(header, 'productType'),
    tenorBucket: indexOf(header, 'tenorBucket'),
    clientType:  indexOf(header, 'clientType'),
    currency:    indexOf(header, 'currency'),
    rate:        indexOf(header, 'rate'),
    source:      indexOf(header, 'source'),
    asOfDate:    indexOf(header, 'asOfDate'),
    notes:       indexOf(header, 'notes'),
  };

  const today = new Date().toISOString().slice(0, 10);
  const rows: ParsedBenchmark[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const r = splitCsvLine(raw);
    const rowIndex = i;

    const productType = cell(r, idx.productType);
    const tenorBucket = cell(r, idx.tenorBucket);
    const clientType  = cell(r, idx.clientType);
    const currency    = cell(r, idx.currency);
    const rateRaw     = cell(r, idx.rate);
    const source      = cell(r, idx.source);
    const asOfCell    = cell(r, idx.asOfDate);
    const notes       = cell(r, idx.notes);

    if (!productType || !tenorBucket || !clientType || !currency || !rateRaw || !source) {
      errors.push({ rowIndex, message: 'missing_required_field', raw });
      continue;
    }
    if (!TENOR_BUCKETS.has(tenorBucket as MarketBenchmark['tenorBucket'])) {
      errors.push({ rowIndex, field: 'tenorBucket', message: 'invalid_tenor (expected ST|MT|LT)', raw: tenorBucket });
      continue;
    }
    const rate = parseRate(rateRaw);
    if (rate == null) {
      errors.push({ rowIndex, field: 'rate', message: 'invalid_rate (not a number)', raw: rateRaw });
      continue;
    }
    if (rate < 0 || rate > 50) {
      errors.push({ rowIndex, field: 'rate', message: 'rate_out_of_range [0, 50]', raw: rateRaw });
      continue;
    }
    if (asOfCell && !DATE_RE.test(asOfCell)) {
      errors.push({ rowIndex, field: 'asOfDate', message: 'invalid_date (YYYY-MM-DD)', raw: asOfCell });
      continue;
    }
    rows.push({
      productType,
      tenorBucket: tenorBucket as MarketBenchmark['tenorBucket'],
      clientType,
      currency,
      rate,
      source,
      asOfDate: asOfCell ?? today,
      notes,
    });
  }

  return { rows, errors };
}
