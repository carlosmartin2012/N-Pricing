/**
 * check-bundle-size.ts
 *
 * Reads dist/assets/ after a Vite build and checks each chunk against
 * size budgets defined in budgets.json at the repo root.
 *
 * Runs with: npx tsx scripts/check-bundle-size.ts
 * Exit 0 = all budgets met, Exit 1 = at least one budget exceeded.
 */

import { readdirSync, statSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Budgets {
  maxTotalSize: number;
  defaultMaxChunkSize: number;
  overrides: Record<string, number>;
}

interface ChunkResult {
  file: string;
  sizeBytes: number;
  budgetBytes: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str;
}

/**
 * Determine which budget applies to a given filename.
 * Checks if the file's base name (before the hash) matches any override key.
 */
function getBudget(fileName: string, budgets: Budgets): number {
  for (const [pattern, limit] of Object.entries(budgets.overrides)) {
    if (fileName.startsWith(pattern + '-') || fileName === pattern) {
      return limit;
    }
  }
  return budgets.defaultMaxChunkSize;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const root = resolve(import.meta.dirname ?? '.', '..');
  const distAssetsDir = resolve(root, 'dist', 'assets');
  const budgetsPath = resolve(root, 'budgets.json');

  // Load budgets
  let budgets: Budgets;
  try {
    budgets = JSON.parse(readFileSync(budgetsPath, 'utf-8')) as Budgets;
  } catch {
    console.error(`ERROR: Could not read ${budgetsPath}`);
    process.exit(1);
  }

  // Read dist/assets directory
  let files: string[];
  try {
    files = readdirSync(distAssetsDir);
  } catch {
    console.error(`ERROR: Could not read ${distAssetsDir}`);
    console.error('Make sure to run "npm run build" first.');
    process.exit(1);
  }

  // Filter to JS and CSS files only (skip source maps, images, fonts)
  const assetFiles = files.filter(
    (f) =>
      (f.endsWith('.js') || f.endsWith('.css')) && !f.endsWith('.map'),
  );

  if (assetFiles.length === 0) {
    console.error('ERROR: No JS/CSS files found in dist/assets/.');
    process.exit(1);
  }

  // Gather results
  const results: ChunkResult[] = [];
  let totalSize = 0;

  for (const file of assetFiles) {
    const fullPath = join(distAssetsDir, file);
    const sizeBytes = statSync(fullPath).size;
    totalSize += sizeBytes;

    const budgetBytes = getBudget(file, budgets);
    results.push({
      file,
      sizeBytes,
      budgetBytes,
      passed: sizeBytes <= budgetBytes,
    });
  }

  // Sort by size descending for readability
  results.sort((a, b) => b.sizeBytes - a.sizeBytes);

  // ---------------------------------------------------------------------------
  // Output table
  // ---------------------------------------------------------------------------

  const COL_FILE = 48;
  const COL_SIZE = 12;
  const COL_BUDGET = 12;
  const COL_STATUS = 8;

  console.log('\n=== Bundle Size Budget Check ===\n');

  const header =
    padRight('Chunk', COL_FILE) +
    padLeft('Size', COL_SIZE) +
    padLeft('Budget', COL_BUDGET) +
    padLeft('Status', COL_STATUS);
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const line =
      padRight(r.file, COL_FILE) +
      padLeft(formatBytes(r.sizeBytes), COL_SIZE) +
      padLeft(formatBytes(r.budgetBytes), COL_BUDGET) +
      padLeft(status, COL_STATUS);
    console.log(line);
  }

  console.log('-'.repeat(header.length));

  // Total check
  const totalPassed = totalSize <= budgets.maxTotalSize;
  const totalLine =
    padRight('TOTAL', COL_FILE) +
    padLeft(formatBytes(totalSize), COL_SIZE) +
    padLeft(formatBytes(budgets.maxTotalSize), COL_BUDGET) +
    padLeft(totalPassed ? 'PASS' : 'FAIL', COL_STATUS);
  console.log(totalLine);

  console.log();

  // Summary
  const failedChunks = results.filter((r) => !r.passed);
  const totalFailed = !totalPassed;

  if (failedChunks.length === 0 && !totalFailed) {
    console.log(
      `PASS: All ${results.length} chunks within budget. Total: ${formatBytes(totalSize)} / ${formatBytes(budgets.maxTotalSize)}.`,
    );
    process.exit(0);
  } else {
    if (failedChunks.length > 0) {
      console.log(
        `FAIL: ${failedChunks.length} chunk(s) exceeded their budget:`,
      );
      for (const r of failedChunks) {
        const over = r.sizeBytes - r.budgetBytes;
        console.log(
          `  - ${r.file}: ${formatBytes(r.sizeBytes)} (${formatBytes(over)} over ${formatBytes(r.budgetBytes)} budget)`,
        );
      }
    }
    if (totalFailed) {
      const over = totalSize - budgets.maxTotalSize;
      console.log(
        `FAIL: Total dist size ${formatBytes(totalSize)} exceeds ${formatBytes(budgets.maxTotalSize)} budget by ${formatBytes(over)}.`,
      );
    }
    process.exit(1);
  }
}

main();
