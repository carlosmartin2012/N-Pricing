#!/usr/bin/env tsx
/**
 * Market benchmarks seed — Ola 6 Bloque D.
 *
 * Inserts ~30 realistic reference rates across
 * productType × tenorBucket × clientType × currency tuples so the Calculator
 * "Market chip" and negotiation cockpit have non-empty data to compare
 * against. Idempotent via `ON CONFLICT (product_type, tenor_bucket,
 * client_type, currency, as_of_date) DO UPDATE` — re-running refreshes rates
 * to the seed values.
 *
 * Sources used (mixed, as expected by the table comment):
 *   - BBG = Bloomberg survey (illustrative)
 *   - BdE = Banco de España monthly stats (illustrative)
 *   - EBA = EBA Risk Dashboard snapshots (illustrative)
 *
 * Usage:
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-market-benchmarks.ts
 */

import { Pool } from 'pg';

interface Seed {
  productType: string;
  tenorBucket: 'ST' | 'MT' | 'LT';
  clientType: string;
  currency: string;
  rate: number;   // percent
  source: string;
  notes?: string;
}

// Rates chosen to be plausible for early-2026 Eurozone/US: ECB deposit 3.00,
// Fed funds 4.00, corporate spread ~80-150bp, retail mortgage 3.5-4.5.
const BENCHMARKS: Seed[] = [
  // LOAN_COMM — corporate loans EUR
  { productType: 'LOAN_COMM', tenorBucket: 'ST', clientType: 'Corporate', currency: 'EUR', rate: 4.10, source: 'BBG', notes: 'Corporate ST EUR' },
  { productType: 'LOAN_COMM', tenorBucket: 'MT', clientType: 'Corporate', currency: 'EUR', rate: 4.22, source: 'BBG', notes: 'Corporate MT EUR (3-5Y)' },
  { productType: 'LOAN_COMM', tenorBucket: 'LT', clientType: 'Corporate', currency: 'EUR', rate: 4.55, source: 'BBG', notes: 'Corporate LT EUR (>5Y)' },
  // LOAN_COMM — SME EUR (higher spread)
  { productType: 'LOAN_COMM', tenorBucket: 'ST', clientType: 'SME',       currency: 'EUR', rate: 4.65, source: 'BdE', notes: 'SME ST EUR' },
  { productType: 'LOAN_COMM', tenorBucket: 'MT', clientType: 'SME',       currency: 'EUR', rate: 4.92, source: 'BdE', notes: 'SME MT EUR' },
  { productType: 'LOAN_COMM', tenorBucket: 'LT', clientType: 'SME',       currency: 'EUR', rate: 5.25, source: 'BdE', notes: 'SME LT EUR' },
  // LOAN_COMM — USD
  { productType: 'LOAN_COMM', tenorBucket: 'ST', clientType: 'Corporate', currency: 'USD', rate: 5.35, source: 'BBG', notes: 'Corporate ST USD' },
  { productType: 'LOAN_COMM', tenorBucket: 'MT', clientType: 'Corporate', currency: 'USD', rate: 5.48, source: 'BBG', notes: 'Corporate MT USD' },
  { productType: 'LOAN_COMM', tenorBucket: 'LT', clientType: 'Corporate', currency: 'USD', rate: 5.75, source: 'BBG', notes: 'Corporate LT USD' },
  // MORTGAGE — retail EUR
  { productType: 'MORTGAGE',  tenorBucket: 'MT', clientType: 'Retail',    currency: 'EUR', rate: 3.62, source: 'BdE', notes: 'Retail mortgage MT EUR' },
  { productType: 'MORTGAGE',  tenorBucket: 'LT', clientType: 'Retail',    currency: 'EUR', rate: 3.85, source: 'BdE', notes: 'Retail mortgage LT EUR (10-20Y)' },
  // LOAN_PERS — retail consumer EUR (unsecured)
  { productType: 'LOAN_PERS', tenorBucket: 'ST', clientType: 'Retail',    currency: 'EUR', rate: 6.80, source: 'BdE', notes: 'Consumer ST EUR' },
  { productType: 'LOAN_PERS', tenorBucket: 'MT', clientType: 'Retail',    currency: 'EUR', rate: 7.15, source: 'BdE', notes: 'Consumer MT EUR' },
  // DEPOSIT — retail EUR (liability side)
  { productType: 'DEPOSIT',   tenorBucket: 'ST', clientType: 'Retail',    currency: 'EUR', rate: 2.15, source: 'BdE', notes: 'Retail term deposit ST EUR' },
  { productType: 'DEPOSIT',   tenorBucket: 'MT', clientType: 'Retail',    currency: 'EUR', rate: 2.55, source: 'BdE', notes: 'Retail term deposit MT EUR' },
  { productType: 'DEPOSIT',   tenorBucket: 'ST', clientType: 'Corporate', currency: 'EUR', rate: 2.85, source: 'BBG', notes: 'Corporate deposit ST EUR' },
  { productType: 'DEPOSIT',   tenorBucket: 'MT', clientType: 'Corporate', currency: 'EUR', rate: 3.10, source: 'BBG', notes: 'Corporate deposit MT EUR' },
  // REVOLVING — corporate EUR
  { productType: 'REVOLVING', tenorBucket: 'ST', clientType: 'Corporate', currency: 'EUR', rate: 4.35, source: 'EBA', notes: 'Corporate revolving ST EUR' },
  { productType: 'REVOLVING', tenorBucket: 'MT', clientType: 'Corporate', currency: 'EUR', rate: 4.55, source: 'EBA', notes: 'Corporate revolving MT EUR' },
  // LEASING — corporate EUR
  { productType: 'LEASING',   tenorBucket: 'MT', clientType: 'Corporate', currency: 'EUR', rate: 4.48, source: 'EBA', notes: 'Corporate leasing MT EUR' },
  { productType: 'LEASING',   tenorBucket: 'LT', clientType: 'Corporate', currency: 'EUR', rate: 4.75, source: 'EBA', notes: 'Corporate leasing LT EUR' },
  // LEASING — SME EUR
  { productType: 'LEASING',   tenorBucket: 'MT', clientType: 'SME',       currency: 'EUR', rate: 5.05, source: 'EBA', notes: 'SME leasing MT EUR' },
  // PROJECT_FIN — corporate EUR
  { productType: 'PROJECT_FIN', tenorBucket: 'LT', clientType: 'Corporate', currency: 'EUR', rate: 4.95, source: 'BBG', notes: 'Project finance LT EUR' },
  { productType: 'PROJECT_FIN', tenorBucket: 'LT', clientType: 'Corporate', currency: 'USD', rate: 6.10, source: 'BBG', notes: 'Project finance LT USD' },
];

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[seed-market-benchmarks] DATABASE_URL is required');
    process.exit(1);
  }
  const asOfDate = process.env.SEED_AS_OF_DATE ?? new Date().toISOString().slice(0, 10);
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const b of BENCHMARKS) {
      const result = await client.query<{ xmax: string }>(
        `INSERT INTO market_benchmarks (product_type, tenor_bucket, client_type, currency, rate, source, as_of_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (product_type, tenor_bucket, client_type, currency, as_of_date)
         DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, notes = EXCLUDED.notes
         RETURNING (xmax <> 0)::text AS xmax`,
        [b.productType, b.tenorBucket, b.clientType, b.currency, b.rate, b.source, asOfDate, b.notes ?? null],
      );
      // xmax = 'true' means row was updated (conflict); 'false' means inserted.
      if (result.rows[0]?.xmax === 'true') updated++;
      else inserted++;
    }
    await client.query('COMMIT');
    console.info(`[seed-market-benchmarks] ${inserted} inserted · ${updated} updated · as_of ${asOfDate}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed-market-benchmarks] failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
