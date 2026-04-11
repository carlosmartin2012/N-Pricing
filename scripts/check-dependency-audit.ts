import { execFileSync } from 'node:child_process';

interface AuditVia {
  source?: number;
  title?: string;
  severity?: string;
  url?: string;
}

interface AuditVulnerability {
  name: string;
  severity: string;
  via: Array<AuditVia | string>;
  fixAvailable: boolean | { name: string; version: string } | undefined;
}

interface AuditReport {
  vulnerabilities?: Record<string, AuditVulnerability>;
  metadata?: {
    vulnerabilities?: Record<string, number>;
  };
}

const ALLOWLIST: Record<
  string,
  {
    advisorySources: Set<number>;
    rationale: string;
  }
> = {
  xlsx: {
    advisorySources: new Set([1108110, 1108111]),
    rationale:
      'SheetJS currently has no upstream fix available. Import parsing is size-bounded and tracked for future migration.',
  },
};

function loadAuditReport(): AuditReport {
  try {
    const stdout = execFileSync('npm', ['audit', '--json', '--omit=dev'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout) as AuditReport;
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout;
    if (typeof stdout === 'string' && stdout.trim()) {
      return JSON.parse(stdout) as AuditReport;
    }
    throw error;
  }
}

function getAdvisorySources(vulnerability: AuditVulnerability): number[] {
  return vulnerability.via
    .filter((entry): entry is AuditVia => typeof entry === 'object' && entry !== null)
    .map((entry) => entry.source)
    .filter((source): source is number => typeof source === 'number');
}

const report = loadAuditReport();
const vulnerabilities = Object.entries(report.vulnerabilities ?? {});
const blocking: Array<{ name: string; vulnerability: AuditVulnerability }> = [];
const allowlisted: Array<{ name: string; vulnerability: AuditVulnerability }> = [];

for (const [name, vulnerability] of vulnerabilities) {
  const rule = ALLOWLIST[name];
  const sources = getAdvisorySources(vulnerability);
  const isAllowlisted =
    !!rule &&
    sources.length > 0 &&
    sources.every((source) => rule.advisorySources.has(source)) &&
    vulnerability.fixAvailable === false;

  if (isAllowlisted) {
    allowlisted.push({ name, vulnerability });
    continue;
  }

  blocking.push({ name, vulnerability });
}

console.log('=== Dependency Security Audit ===');
console.log(
  `Reported vulnerabilities: ${report.metadata?.vulnerabilities?.total ?? vulnerabilities.length}`,
);

if (allowlisted.length > 0) {
  console.log('\nAllowlisted exceptions:');
  allowlisted.forEach(({ name, vulnerability }) => {
    console.log(`- ${name} (${vulnerability.severity})`);
    console.log(`  ${ALLOWLIST[name]?.rationale}`);
  });
}

if (blocking.length > 0) {
  console.error('\nBlocking vulnerabilities:');
  blocking.forEach(({ name, vulnerability }) => {
    console.error(`- ${name} (${vulnerability.severity})`);
    vulnerability.via.forEach((entry) => {
      if (typeof entry === 'string') {
        console.error(`  via: ${entry}`);
        return;
      }
      console.error(`  via: ${entry.title ?? 'unknown advisory'}${entry.url ? ` — ${entry.url}` : ''}`);
    });
  });
  process.exit(1);
}

console.log('\nPASS: No unallowlisted production dependency vulnerabilities found.');
