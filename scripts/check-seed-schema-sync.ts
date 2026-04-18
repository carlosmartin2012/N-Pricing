/**
 * check-seed-schema-sync.ts
 *
 * Validates that seed data fields in utils/seedData.ts match the column names
 * defined in the Postgres schema. The authoritative source is the ordered
 * sequence of files under supabase/migrations/; supabase/schema_v2.sql is
 * kept as a fallback for tables still only defined there (legacy baseline).
 * supabase/schema.sql is LEGACY and is NOT read by this script — see the
 * warning inside that file.
 *
 * Runs with: npx tsx scripts/check-seed-schema-sync.ts
 * Exit 0 = all good, Exit 1 = mismatches found.
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert camelCase to snake_case */
function camelToSnake(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

// ---------------------------------------------------------------------------
// 1. Parse SQL schema -- extract column names per table
// ---------------------------------------------------------------------------

function parseSchemaColumns(sql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();

  // Match CREATE TABLE blocks
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql)) !== null) {
    const tableName = m[1].toLowerCase();
    const body = m[2];
    const cols = new Set<string>();

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      // Skip constraints, indexes, empty lines
      if (
        !trimmed ||
        /^(PRIMARY\s+KEY|UNIQUE|CHECK|CONSTRAINT|FOREIGN\s+KEY)/i.test(trimmed)
      ) {
        continue;
      }
      // Column definition starts with an identifier followed by a SQL type.
      // Covers the types actually used across schema.sql + migrations; extend
      // when new types are introduced.
      const colMatch = trimmed.match(
        /^(\w+)\s+(TEXT|INTEGER|INT|NUMERIC|BOOLEAN|BIGSERIAL|SERIAL|TIMESTAMPTZ|TIMESTAMP|DATE|JSONB|JSON|BIGINT|UUID|DECIMAL|REAL|DOUBLE|BYTEA|SMALLINT|VARCHAR|CHAR)/i,
      );
      if (colMatch) {
        cols.add(colMatch[1].toLowerCase());
      }
    }
    if (cols.size > 0) {
      // Merge with existing — migrations + schema_v2 can each define the same table
      const existing = tables.get(tableName);
      if (existing) {
        for (const c of cols) existing.add(c);
      } else {
        tables.set(tableName, cols);
      }
    }
  }

  // Also pick up ALTER TABLE ... ADD COLUMN (schema_v2 and migrations use these for deals + tenancy)
  // Must consume optional IF NOT EXISTS before capturing the column name —
  // otherwise we register "if" as a phantom column on every tenancy migration.
  const alterRe = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s+/gi;
  while ((m = alterRe.exec(sql)) !== null) {
    const tableName = m[1].toLowerCase();
    const colName = m[2].toLowerCase();
    let cols = tables.get(tableName);
    if (!cols) {
      cols = new Set<string>();
      tables.set(tableName, cols);
    }
    cols.add(colName);
  }

  return tables;
}

// ---------------------------------------------------------------------------
// 2. Parse seed data -- extract field names from each exported array/object
// ---------------------------------------------------------------------------

interface SeedExport {
  exportName: string;
  fields: Set<string>;
}

/**
 * Extract only the top-level property names from an array of object literals
 * or a single object literal. "Top-level" means properties of the items in
 * the array (depth 1 inside the array brackets, depth 0 inside each object),
 * NOT properties of nested sub-objects or JSONB arrays.
 *
 * Strategy: for array exports like `[{ a: 1, b: [{ x: 2 }] }, ...]` we want
 * only `a` and `b`, not `x`. We do this by tracking brace/bracket depth and
 * only capturing property names at the correct depth.
 */
function extractTopLevelFields(block: string, isArray: boolean): Set<string> {
  const fields = new Set<string>();

  // The target depth for property capture:
  // - For arrays: we want properties inside the first-level objects, so
  //   when we are at brace depth 1 (inside an item object, but not deeper).
  //   The array brackets add bracket depth but we track brace depth separately.
  // - For plain objects: brace depth 0 means the top-level object body.
  const targetBraceDepth = isArray ? 1 : 1;

  let braceDepth = 0;
  let bracketDepth = 0;
  let i = 0;

  while (i < block.length) {
    const ch = block[i];

    // Skip string literals
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < block.length && block[i] !== quote) {
        if (block[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }

    // Skip single-line comments
    if (ch === '/' && i + 1 < block.length && block[i + 1] === '/') {
      while (i < block.length && block[i] !== '\n') i++;
      continue;
    }

    // Skip multi-line comments
    if (ch === '/' && i + 1 < block.length && block[i + 1] === '*') {
      i += 2;
      while (i + 1 < block.length && !(block[i] === '*' && block[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if (ch === '{') { braceDepth++; i++; continue; }
    if (ch === '}') { braceDepth--; i++; continue; }
    if (ch === '[') { bracketDepth++; i++; continue; }
    if (ch === ']') { bracketDepth--; i++; continue; }

    // Only try to capture property names at the right depth
    // For arrays: braceDepth === 1 means we are inside an item object (top level)
    //             bracketDepth === 1 means we are inside the outer array
    // For objects: braceDepth === 1 means top-level properties
    const atTargetDepth = isArray
      ? braceDepth === targetBraceDepth && bracketDepth === 1
      : braceDepth === targetBraceDepth;

    if (atTargetDepth) {
      // Try to match a property key: word followed by :
      const rest = block.slice(i);
      const propMatch = rest.match(/^(\w+)\s*:/);
      if (propMatch) {
        const field = propMatch[1];
        if (!/^\d+$/.test(field)) {
          fields.add(field);
        }
        i += propMatch[0].length;
        continue;
      }
    }

    i++;
  }

  return fields;
}

function parseSeedFields(ts: string): SeedExport[] {
  const exports: SeedExport[] = [];

  // Match exported constants that are arrays or objects
  const exportRe = /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*([[ {])/g;
  let m: RegExpExecArray | null;

  while ((m = exportRe.exec(ts)) !== null) {
    const name = m[1];
    const opener = m[2];
    const closer = opener === '[' ? ']' : '}';
    const isArray = opener === '[';
    const startIdx = m.index + m[0].length - 1; // position of opener

    // Find matching closer (simple bracket counting)
    let depth = 0;
    let endIdx = startIdx;
    for (let i = startIdx; i < ts.length; i++) {
      const ch = ts[i];
      if (ch === opener) depth++;
      else if (ch === closer) {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
      // Skip string literals
      if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch;
        i++;
        while (i < ts.length && ts[i] !== quote) {
          if (ts[i] === '\\') i++;
          i++;
        }
      }
    }

    const block = ts.slice(startIdx, endIdx + 1);
    const fields = extractTopLevelFields(block, isArray);

    if (fields.size > 0) {
      exports.push({ exportName: name, fields });
    }
  }

  return exports;
}

// ---------------------------------------------------------------------------
// 3. Mapping: seed export name -> SQL table name
// ---------------------------------------------------------------------------

const SEED_TO_TABLE: Record<string, string> = {
  MOCK_CLIENTS: 'clients',
  MOCK_PRODUCT_DEFS: 'products',
  MOCK_BUSINESS_UNITS: 'business_units',
  MOCK_DEALS: 'deals',
  MOCK_USERS: 'users',
  MOCK_TRANSITION_GRID: 'esg_transition_grid',
  MOCK_PHYSICAL_GRID: 'esg_physical_grid',
  MOCK_FTP_RATE_CARDS: 'ftp_rate_cards',
  MOCK_BEHAVIOURAL_MODELS: 'behavioural_models',
  MOCK_LIQUIDITY_CURVES: 'liquidity_curves',
  MOCK_RULES: 'rules',
  MOCK_INCENTIVISATION_RULES: 'incentivisation_rules',
  INITIAL_DEAL: 'deals',
  EMPTY_DEAL: 'deals',
};

// Fields that exist only in the TypeScript layer (UI/engine concerns, not persisted columns).
// These are intentionally NOT in the SQL schema.
const IGNORED_SEED_FIELDS: Record<string, Set<string>> = {
  deals: new Set([
    'desk',                      // alias for businessLine in UI
    'drawnAmount',               // computed from amount - undrawnAmount
    'isCommitted',               // app-layer flag
    'lcrClassification',         // app-layer classification
    'depositType',               // app-layer classification
    'depositStability',          // app-layer classification
    'behavioralMaturityOverride',// app-layer override
    'liquiditySpread',           // pricing result, not deal input
    '_liquidityPremiumDetails',  // internal pricing memo
    '_clcChargeDetails',         // internal pricing memo
    'ead',                       // derived in pricing engine
    'feeIncome',                 // derived in pricing engine
    'repricingMonths',           // derived from repricingFreq
    'collateralType',            // future gap, no column yet
    'haircutPct',                // future gap, no column yet
    'description',               // UI-only label for demo identification
  ]),
  liquidity_curves: new Set([
    'curveType',                 // legacy alias, schema_v2 uses column name "curve_type" which camelToSnake maps correctly; kept here for old seeds
    'lastUpdate',                // legacy alias — schema uses as_of_date
  ]),
  rules: new Set([
    'formulaSpec',               // JSONB stored differently or not persisted
    'version',                   // stored in rule_versions, not in rules table
    'effectiveFrom',             // not in current schema
    'effectiveTo',               // not in current schema
    'isActive',                  // not in current schema
  ]),
};

// ---------------------------------------------------------------------------
// 4. Run the check
// ---------------------------------------------------------------------------

// Load every migration file in sorted order plus schema_v2.sql as fallback.
// Explicitly skips supabase/schema.sql: that file is legacy and its column
// set is incomplete (pre-tenancy, pre-workflow, pre-Olas). The concatenation
// order matters: later migrations can add columns to tables declared earlier.
function loadCanonicalSchemaSql(root: string): string {
  const migrationsDir = resolve(root, 'supabase/migrations');
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const parts: string[] = [];
  for (const file of migrationFiles) {
    parts.push(`-- ${file}`);
    parts.push(readFileSync(resolve(migrationsDir, file), 'utf-8'));
  }
  // Fallback: schema_v2.sql still declares a handful of tables (clients,
  // products, business_units, deal_versions…) that were baselined before
  // the first migration. Including it makes the column set complete without
  // forcing a retroactive migration rewrite.
  parts.push('-- schema_v2.sql (fallback for baseline tables)');
  parts.push(readFileSync(resolve(root, 'supabase/schema_v2.sql'), 'utf-8'));
  return parts.join('\n');
}

function main(): void {
  const root = resolve(import.meta.dirname ?? '.', '..');

  const schemaSql = loadCanonicalSchemaSql(root);
  const seedSrc = readFileSync(resolve(root, 'utils/seedData.ts'), 'utf-8');

  // Parse
  const schemaCols = parseSchemaColumns(schemaSql);
  const seedExports = parseSeedFields(seedSrc);

  // Safety net: the script used to silently regress when the schema source
  // files moved around. If we suddenly know about fewer than 15 tables,
  // something is badly wrong — fail loudly instead of PASSing with a false
  // sense of security.
  const MIN_EXPECTED_TABLES = 15;
  if (schemaCols.size < MIN_EXPECTED_TABLES) {
    console.error(
      `FAIL: parsed only ${schemaCols.size} tables from migrations + schema_v2.sql ` +
        `(expected ≥ ${MIN_EXPECTED_TABLES}). ` +
        `Check that supabase/migrations/ is present and non-empty.`,
    );
    process.exit(1);
  }

  console.log('=== Seed / Schema Sync Check ===\n');
  console.log(`Schema source:       supabase/migrations/* + supabase/schema_v2.sql`);
  console.log(`Tables parsed:       ${schemaCols.size}`);
  console.log(`Seed exports found:  ${seedExports.map((e) => e.exportName).join(', ')}\n`);

  let hasErrors = false;

  for (const seed of seedExports) {
    const tableName = SEED_TO_TABLE[seed.exportName];
    if (!tableName) {
      // Not mapped -- skip (e.g. MOCK_YIELD_CURVE, dashboard data, configs)
      continue;
    }

    const tableCols = schemaCols.get(tableName);
    if (!tableCols) {
      console.log(
        `[WARN] Table "${tableName}" not found in schema for export ${seed.exportName}`,
      );
      hasErrors = true;
      continue;
    }

    const ignored = IGNORED_SEED_FIELDS[tableName] ?? new Set<string>();

    // Check: seed fields that have no matching schema column
    const extraInSeed: string[] = [];
    for (const field of seed.fields) {
      if (ignored.has(field)) continue;
      const snaked = camelToSnake(field);
      if (!tableCols.has(snaked)) {
        extraInSeed.push(`${field} (-> ${snaked})`);
      }
    }

    // Check: important schema columns missing from seed data (informational)
    const seedSnaked = new Set([...seed.fields].map(camelToSnake));
    const autoManaged = new Set(['created_at', 'updated_at', 'created_by']);
    const missingInSeed: string[] = [];
    for (const col of tableCols) {
      if (autoManaged.has(col)) continue;
      if (!seedSnaked.has(col)) {
        missingInSeed.push(col);
      }
    }

    if (extraInSeed.length > 0 || missingInSeed.length > 0) {
      if (extraInSeed.length > 0) {
        console.log(`[MISMATCH] ${seed.exportName} <-> ${tableName}`);
        console.log(`  Seed fields NOT in schema: ${extraInSeed.join(', ')}`);
        hasErrors = true;
      } else {
        console.log(`[OK] ${seed.exportName} <-> ${tableName}`);
      }
      if (missingInSeed.length > 0) {
        console.log(`  Schema cols not in seed (info): ${missingInSeed.join(', ')}`);
      }
      console.log();
    } else {
      console.log(`[OK] ${seed.exportName} <-> ${tableName}`);
    }
  }

  console.log();
  if (hasErrors) {
    console.log('FAIL: Mismatches detected. Please review seed data vs schema.');
    process.exit(1);
  } else {
    console.log('PASS: All seed data fields match the schema. No drift detected.');
    process.exit(0);
  }
}

main();
