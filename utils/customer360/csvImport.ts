import type {
  ClientPosition,
  ClientMetricsSnapshot,
  PositionCategory,
  PositionStatus,
  ClientMetricsSource,
} from '../../types/customer360';

/**
 * CSV importers for Customer 360 bulk loads.
 *
 * Pure functions — accept a CSV string, return parsed rows + per-row errors.
 * Persistence is the caller's responsibility (server route does the
 * batched INSERTs). Keeps parsing logic testable without DB.
 *
 * CSV dialect: comma-separated, header row required, quoted fields with
 * doubled quotes for escaping. Cells trimmed. Empty string → null for
 * nullable fields.
 */

export interface ParseError {
  rowIndex: number;          // 1-based excluding header
  field?: string;
  message: string;
  raw?: string;
}

export interface ParseResult<T> {
  rows: T[];
  errors: ParseError[];
}

// ---------------------------------------------------------------------------
// Lightweight CSV tokeniser (no external dep)
// ---------------------------------------------------------------------------

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

interface ParsedTable {
  header: string[];
  rows: string[][];
}

function parseCsv(text: string): ParsedTable {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows };
}

function indexOfHeader(header: string[], name: string): number {
  return header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
}

function getCell(row: string[], idx: number): string | null {
  if (idx < 0 || idx >= row.length) return null;
  const v = row[idx].trim();
  return v.length === 0 ? null : v;
}

function asNumber(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v.replace(/\s+/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Positions importer
// ---------------------------------------------------------------------------

const POSITION_REQUIRED = ['client_id', 'product_type', 'category', 'amount', 'currency', 'start_date'];

export type ParsedPosition = Omit<ClientPosition, 'id' | 'entityId' | 'createdAt' | 'updatedAt'>;

export function parsePositionsCsv(text: string): ParseResult<ParsedPosition> {
  const { header, rows } = parseCsv(text);
  const errors: ParseError[] = [];
  const out: ParsedPosition[] = [];

  for (const required of POSITION_REQUIRED) {
    if (indexOfHeader(header, required) < 0) {
      errors.push({ rowIndex: 0, field: required, message: `missing column '${required}'` });
    }
  }
  if (errors.length > 0) return { rows: out, errors };

  const idx = (name: string) => indexOfHeader(header, name);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ri = i + 1;
    const clientId = getCell(row, idx('client_id'));
    const productType = getCell(row, idx('product_type'));
    const category = getCell(row, idx('category'));
    const amount = asNumber(getCell(row, idx('amount')));
    const currency = getCell(row, idx('currency'));
    const startDate = getCell(row, idx('start_date'));

    if (!clientId)    { errors.push({ rowIndex: ri, field: 'client_id', message: 'required' }); continue; }
    if (!productType) { errors.push({ rowIndex: ri, field: 'product_type', message: 'required' }); continue; }
    if (!category || !['Asset','Liability','Off-Balance','Service'].includes(category)) {
      errors.push({ rowIndex: ri, field: 'category', message: 'must be Asset|Liability|Off-Balance|Service', raw: category ?? '' });
      continue;
    }
    if (amount === null) { errors.push({ rowIndex: ri, field: 'amount', message: 'must be a number' }); continue; }
    if (!currency)  { errors.push({ rowIndex: ri, field: 'currency', message: 'required' }); continue; }
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      errors.push({ rowIndex: ri, field: 'start_date', message: 'YYYY-MM-DD required' });
      continue;
    }

    const status = (getCell(row, idx('status')) ?? 'Active') as PositionStatus;
    if (!['Active','Matured','Cancelled'].includes(status)) {
      errors.push({ rowIndex: ri, field: 'status', message: 'invalid', raw: status });
      continue;
    }

    out.push({
      clientId,
      productId: getCell(row, idx('product_id')),
      productType,
      category: category as PositionCategory,
      dealId: getCell(row, idx('deal_id')),
      amount,
      currency,
      marginBps: asNumber(getCell(row, idx('margin_bps'))),
      startDate,
      maturityDate: getCell(row, idx('maturity_date')),
      status,
    });
  }
  return { rows: out, errors };
}

// ---------------------------------------------------------------------------
// Metrics importer
// ---------------------------------------------------------------------------

const METRICS_REQUIRED = ['client_id', 'period'];

export type ParsedMetrics = Omit<ClientMetricsSnapshot, 'id' | 'entityId' | 'computedAt'>;

export function parseMetricsCsv(text: string): ParseResult<ParsedMetrics> {
  const { header, rows } = parseCsv(text);
  const errors: ParseError[] = [];
  const out: ParsedMetrics[] = [];

  for (const required of METRICS_REQUIRED) {
    if (indexOfHeader(header, required) < 0) {
      errors.push({ rowIndex: 0, field: required, message: `missing column '${required}'` });
    }
  }
  if (errors.length > 0) return { rows: out, errors };

  const idx = (name: string) => indexOfHeader(header, name);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ri = i + 1;
    const clientId = getCell(row, idx('client_id'));
    const period = getCell(row, idx('period'));
    if (!clientId) { errors.push({ rowIndex: ri, field: 'client_id', message: 'required' }); continue; }
    if (!period)   { errors.push({ rowIndex: ri, field: 'period', message: 'required' });   continue; }

    const source = (getCell(row, idx('source')) ?? 'imported') as ClientMetricsSource;
    if (!['computed', 'imported', 'manual'].includes(source)) {
      errors.push({ rowIndex: ri, field: 'source', message: 'invalid', raw: source });
      continue;
    }

    out.push({
      clientId,
      period,
      nimBps:               asNumber(getCell(row, idx('nim_bps'))),
      feesEur:              asNumber(getCell(row, idx('fees_eur'))),
      evaEur:               asNumber(getCell(row, idx('eva_eur'))),
      shareOfWalletPct:     asNumber(getCell(row, idx('share_of_wallet_pct'))),
      relationshipAgeYears: asNumber(getCell(row, idx('relationship_age_years'))),
      npsScore:             (() => {
        const n = asNumber(getCell(row, idx('nps_score')));
        return n === null ? null : Math.round(n);
      })(),
      activePositionCount:  asNumber(getCell(row, idx('active_position_count'))) ?? 0,
      totalExposureEur:     asNumber(getCell(row, idx('total_exposure_eur'))) ?? 0,
      source,
      detail:               {},
    });
  }
  return { rows: out, errors };
}
