import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const SCANNED_ROOTS = ['api', 'components', 'contexts', 'hooks', 'integrations', 'server', 'utils'];

const EXCLUDED_PATH_PARTS = [
  `${path.sep}__tests__${path.sep}`,
  `${path.sep}channels${path.sep}`,
  `${path.sep}clv${path.sep}`,
  `${path.sep}customer360${path.sep}`,
  `${path.sep}targetGrid${path.sep}`,
];

const EXCLUDED_FILES = new Set([
  'utils/canonicalJson.ts',
  'utils/governance/dossierSigning.ts',
  'utils/pricingEngine.ts',
  'utils/snapshotHash.ts',
]);

const FORBIDDEN_IMPORTS = [
  {
    boundary: '@npricing/pricing-core',
    pattern: /from\s+['"][^'"]*pricingEngine['"]/,
  },
  {
    boundary: '@npricing/evidence',
    pattern: /from\s+['"][^'"]*(canonicalJson|snapshotHash)['"]/,
  },
  {
    boundary: '@npricing/commercial',
    pattern:
      /from\s+['"][^'"]*(channels\/|customer360\/relationshipAggregator|clv\/|targetGrid\/(gridCompute|synthesizer|diff))[^'"]*['"]/,
  },
];

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') return [];
        return listSourceFiles(fullPath);
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) return [];
      return [fullPath];
    })
  );
  return files.flat();
}

function shouldScan(filePath: string): boolean {
  const relative = path.relative(ROOT, filePath);
  if (relative.includes('.test.') || relative.includes('.stories.')) return false;
  if (EXCLUDED_FILES.has(relative)) return false;
  return !EXCLUDED_PATH_PARTS.some((part) => filePath.includes(part));
}

describe('package boundary imports', () => {
  it('routes runtime consumers through @npricing facades', async () => {
    const files = (await Promise.all(SCANNED_ROOTS.map((root) => listSourceFiles(path.join(ROOT, root)))))
      .flat()
      .filter(shouldScan);

    const violations: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const relative = path.relative(ROOT, file);
      for (const rule of FORBIDDEN_IMPORTS) {
        if (rule.pattern.test(source)) {
          violations.push(`${relative} should import via ${rule.boundary}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps market benchmark CRUD outside the What-If API client', async () => {
    const whatIfClient = await readFile(path.join(ROOT, 'api/whatIf.ts'), 'utf8');

    expect(whatIfClient).not.toMatch(/listBenchmarks|upsertBenchmark|\/what-if\/benchmarks(?!\/compare)/);
  });
});
