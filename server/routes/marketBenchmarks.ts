import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, queryOne } from '../db';
import { safeError } from '../middleware/errorHandler';
import { parseMarketBenchmarksCsv } from '../../utils/marketBenchmarks/csvImport';

const router = Router();

const TENOR_BUCKETS = new Set(['ST', 'MT', 'LT']);

interface MarketBenchmarkRow {
  id: string;
  product_type: string;
  tenor_bucket: string;
  client_type: string;
  currency: string;
  rate: string | number;
  source: string;
  as_of_date: string | Date;
  notes: string | null;
}

interface MarketBenchmarkDTO {
  id: string;
  productType: string;
  tenorBucket: 'ST' | 'MT' | 'LT';
  clientType: string;
  currency: string;
  rate: number;
  source: string;
  asOfDate: string;
  notes: string | null;
}

function mapRow(row: MarketBenchmarkRow): MarketBenchmarkDTO {
  const asOf = row.as_of_date instanceof Date
    ? row.as_of_date.toISOString().slice(0, 10)
    : String(row.as_of_date).slice(0, 10);
  return {
    id:          row.id,
    productType: row.product_type,
    tenorBucket: row.tenor_bucket as 'ST' | 'MT' | 'LT',
    clientType:  row.client_type,
    currency:    row.currency,
    rate:        Number(row.rate),
    source:      row.source,
    asOfDate:    asOf,
    notes:       row.notes,
  };
}

function requireAdmin(req: Parameters<Parameters<typeof router.post>[1]>[0]): string | null {
  if (req.user?.role !== 'Admin') return 'admin_required';
  return null;
}

router.get('/', async (req, res) => {
  try {
    const products  = typeof req.query.products   === 'string' ? req.query.products.split(',').filter(Boolean) : [];
    const currencies = typeof req.query.currencies === 'string' ? req.query.currencies.split(',').filter(Boolean) : [];
    const clients   = typeof req.query.clients    === 'string' ? req.query.clients.split(',').filter(Boolean) : [];
    const filters: string[] = [];
    const params: Array<string | string[]> = [];
    if (products.length)   { params.push(products);   filters.push(`product_type = ANY($${params.length})`); }
    if (currencies.length) { params.push(currencies); filters.push(`currency = ANY($${params.length})`); }
    if (clients.length)    { params.push(clients);    filters.push(`client_type = ANY($${params.length})`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query<MarketBenchmarkRow>(
      `SELECT * FROM market_benchmarks ${where} ORDER BY as_of_date DESC, product_type ASC LIMIT 500`,
      params,
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await queryOne<MarketBenchmarkRow>(
      'SELECT * FROM market_benchmarks WHERE id = $1 LIMIT 1',
      [req.params.id],
    );
    if (!row) { res.status(404).json({ code: 'not_found' }); return; }
    res.json(mapRow(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const guard = requireAdmin(req);
    if (guard) { res.status(403).json({ code: guard }); return; }
    const body = req.body as Record<string, unknown> | undefined;
    if (!body) { res.status(400).json({ code: 'invalid_payload' }); return; }
    const productType = String(body.productType ?? '');
    const tenorBucket = String(body.tenorBucket ?? '');
    const clientType  = String(body.clientType ?? '');
    const currency    = String(body.currency ?? '');
    const source      = String(body.source ?? '');
    const rate        = Number(body.rate);
    const asOfDate    = typeof body.asOfDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.asOfDate)
      ? body.asOfDate
      : new Date().toISOString().slice(0, 10);
    if (!productType || !TENOR_BUCKETS.has(tenorBucket) || !clientType || !currency || !source) {
      res.status(400).json({ code: 'invalid_payload', message: 'productType, tenorBucket (ST|MT|LT), clientType, currency, source required' });
      return;
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      res.status(400).json({ code: 'invalid_rate', message: 'rate must be a finite number in [0, 50]' });
      return;
    }
    const id = typeof body.id === 'string' && body.id ? body.id : randomUUID();
    const row = await queryOne<MarketBenchmarkRow>(
      `INSERT INTO market_benchmarks (id, product_type, tenor_bucket, client_type, currency, rate, source, as_of_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (product_type, tenor_bucket, client_type, currency, as_of_date)
       DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, notes = EXCLUDED.notes
       RETURNING *`,
      [id, productType, tenorBucket, clientType, currency, rate, source, asOfDate, body.notes ?? null],
    );
    res.status(201).json(row ? mapRow(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/import/csv', async (req, res) => {
  try {
    const guard = requireAdmin(req);
    if (guard) { res.status(403).json({ code: guard }); return; }
    const body = req.body as { csv?: unknown } | undefined;
    const csv = typeof body?.csv === 'string' ? body.csv : '';
    if (!csv) { res.status(400).json({ code: 'missing_csv' }); return; }

    const { rows, errors } = parseMarketBenchmarksCsv(csv);
    if (rows.length === 0) {
      res.status(400).json({ code: 'no_valid_rows', errors });
      return;
    }

    let inserted = 0;
    let updated = 0;
    for (const r of rows) {
      const result = await queryOne<{ inserted: boolean }>(
        `INSERT INTO market_benchmarks (product_type, tenor_bucket, client_type, currency, rate, source, as_of_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (product_type, tenor_bucket, client_type, currency, as_of_date)
         DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, notes = EXCLUDED.notes
         RETURNING (xmax = 0) AS inserted`,
        [r.productType, r.tenorBucket, r.clientType, r.currency, r.rate, r.source, r.asOfDate, r.notes],
      );
      if (result?.inserted) inserted++;
      else updated++;
    }
    res.status(200).json({ inserted, updated, errors });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const guard = requireAdmin(req);
    if (guard) { res.status(403).json({ code: guard }); return; }
    const deleted = await query<{ id: string }>(
      'DELETE FROM market_benchmarks WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (deleted.length === 0) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
