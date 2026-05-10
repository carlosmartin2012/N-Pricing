import { readFileSync } from 'node:fs';

const SPEC_PATH = 'docs/api-spec.yaml';

const text = readFileSync(SPEC_PATH, 'utf8');
const lines = text.split(/\r?\n/);

function fail(message: string): never {
  console.error(`[openapi] ${message}`);
  process.exit(1);
}

function collectTopLevelKeys(): Map<string, number[]> {
  const keys = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const match = line.match(/^([A-Za-z][\w-]*):(?:\s|$)/);
    if (!match) return;
    const name = match[1];
    keys.set(name, [...(keys.get(name) ?? []), index + 1]);
  });
  return keys;
}

const topLevelKeys = collectTopLevelKeys();
for (const key of ['openapi', 'info', 'servers', 'security', 'tags', 'paths', 'components']) {
  const occurrences = topLevelKeys.get(key) ?? [];
  if (occurrences.length !== 1) {
    fail(`expected one top-level "${key}" key, found ${occurrences.length} at lines ${occurrences.join(', ') || 'n/a'}`);
  }
}

const duplicateTopLevel = [...topLevelKeys.entries()].filter(([, occurrences]) => occurrences.length > 1);
if (duplicateTopLevel.length > 0) {
  fail(`duplicate top-level keys: ${duplicateTopLevel.map(([key, occurrences]) => `${key}@${occurrences.join('/')}`).join(', ')}`);
}

const pathKeys = new Map<string, number[]>();
let insidePaths = false;
for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i];
  if (line === 'paths:') {
    insidePaths = true;
    continue;
  }
  if (insidePaths && line.match(/^[A-Za-z][\w-]*:(?:\s|$)/)) break;
  if (!insidePaths) continue;
  const pathMatch = line.match(/^ {2}(\/[^:]+):\s*$/);
  if (!pathMatch) continue;
  const route = pathMatch[1];
  pathKeys.set(route, [...(pathKeys.get(route) ?? []), i + 1]);
}

const duplicatePaths = [...pathKeys.entries()].filter(([, occurrences]) => occurrences.length > 1);
if (duplicatePaths.length > 0) {
  fail(`duplicate path entries: ${duplicatePaths.map(([route, occurrences]) => `${route}@${occurrences.join('/')}`).join(', ')}`);
}

const requiredPaths = [
  '/deals/{dealId}/timeline',
  '/copilot/ask',
  '/market-benchmarks',
  '/target-grid/snapshots/{snapshotId}/export/xlsx',
  '/target-grid/snapshots/{snapshotId}/export/pdf',
  '/what-if/sandboxes',
  '/what-if/sandboxes/{sandboxId}/impact',
  '/what-if/sandboxes/{sandboxId}/publish',
  '/what-if/backtests',
  '/what-if/backtests/{runId}/result',
  '/what-if/benchmarks/compare',
  '/clv/clients/{clientId}/timeline',
  '/attributions/matrix',
  '/admission/health',
  '/core-banking/reconciliation',
  '/budget/comparison',
  '/notifications/push/subscribe',
];

const missingPaths = requiredPaths.filter((route) => !pathKeys.has(route));
if (missingPaths.length > 0) {
  fail(`missing required path entries: ${missingPaths.join(', ')}`);
}

const operationIds = new Map<string, number[]>();
lines.forEach((line, index) => {
  const match = line.match(/^\s+operationId:\s*([A-Za-z0-9_ -]+)\s*$/);
  if (!match) return;
  const id = match[1].trim();
  operationIds.set(id, [...(operationIds.get(id) ?? []), index + 1]);
});
const duplicateOperations = [...operationIds.entries()].filter(([, occurrences]) => occurrences.length > 1);
if (duplicateOperations.length > 0) {
  fail(`duplicate operationId entries: ${duplicateOperations.map(([id, occurrences]) => `${id}@${occurrences.join('/')}`).join(', ')}`);
}

const componentSchemas = new Set<string>();
let insideSchemas = false;
for (const line of lines) {
  if (line === '  schemas:') {
    insideSchemas = true;
    continue;
  }
  if (!insideSchemas) continue;
  if (line.match(/^ {2}[A-Za-z][\w-]*:\s*$/)) break;
  const schemaMatch = line.match(/^ {4}([A-Za-z][A-Za-z0-9_]*):\s*$/);
  if (schemaMatch) componentSchemas.add(schemaMatch[1]);
}

for (const schema of ['PricingRequest', 'FTPResult', 'ClientEvent', 'AttributionMatrix', 'AdmissionContext', 'BudgetVarianceItem']) {
  if (!componentSchemas.has(schema)) fail(`missing component schema ${schema}`);
}

console.info(`[openapi] ${pathKeys.size} paths, ${componentSchemas.size} schemas, ${operationIds.size} operationIds`);
