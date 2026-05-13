import { existsSync } from 'node:fs';

type Status = 'ready' | 'blocked' | 'not_requested';

interface Gate {
  id: string;
  label: string;
  status: Status;
  evidence: string[];
  missing: string[];
}

const requireAll = process.argv.includes('--require-all');
const json = process.argv.includes('--json');

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function adapterGate(
  id: string,
  label: string,
  selectorName: string,
  expectedSelector: string,
  requiredEnv: string[],
  implementationNote: string,
): Gate {
  const selected = env(selectorName).toLowerCase();
  if (!selected || selected === 'in-memory') {
    return {
      id,
      label,
      status: requireAll ? 'blocked' : 'not_requested',
      evidence: [`${selectorName}=${selected || 'in-memory'}`],
      missing: [`set ${selectorName}=${expectedSelector}`, ...requiredEnv],
    };
  }
  const missing = requiredEnv.filter((name) => !env(name));
  return {
    id,
    label,
    status: selected === expectedSelector && missing.length === 0 ? 'ready' : 'blocked',
    evidence: [`${selectorName}=${selected}`, implementationNote],
    missing: selected === expectedSelector ? missing : [`expected ${selectorName}=${expectedSelector}`],
  };
}

const gates: Gate[] = [
  adapterGate(
    'crm-salesforce',
    'Salesforce FSC CRM adapter',
    'ADAPTER_CRM',
    'salesforce',
    ['SALESFORCE_INSTANCE_URL', 'SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'],
    'Code surface exists as a Result-returning adapter; HTTP/SOQL implementation remains bank-contract dependent.',
  ),
  adapterGate(
    'marketdata-bloomberg',
    'Bloomberg market-data adapter',
    'ADAPTER_MARKET_DATA',
    'bloomberg',
    ['BLOOMBERG_APP_NAME'],
    'Code surface exists as a Result-returning adapter; BLPAPI session and ticker contract are external.',
  ),
  adapterGate(
    'corebanking-bm-host',
    'BM HOST core-banking reconciliation',
    'ADAPTER_CORE_BANKING',
    'bm-host',
    ['BM_HOST_SFTP_HOST', 'BM_HOST_SFTP_USER', 'BM_HOST_SFTP_PRIVATE_KEY_PEM'],
    'Code surface exists as a batch adapter; SFTP layout and credentials are external.',
  ),
  adapterGate(
    'admission-puzzle',
    'PUZZLE admission adapter',
    'ADAPTER_ADMISSION',
    'puzzle',
    ['PUZZLE_BASE_URL', 'PUZZLE_CLIENT_ID', 'PUZZLE_CLIENT_SECRET'],
    'Code surface exists as an admission adapter; endpoint contract is external.',
  ),
  adapterGate(
    'budget-alquid',
    'ALQUID budget adapter',
    'ADAPTER_BUDGET',
    'alquid',
    ['ALQUID_BASE_URL', 'ALQUID_CLIENT_ID', 'ALQUID_CLIENT_SECRET'],
    'Code surface exists as read-only budget adapter; endpoint contract is external.',
  ),
];

const datasetPath = env('HISTORICAL_BACKTEST_DATASET_PATH');
gates.push({
  id: 'historical-backtesting',
  label: 'Historical backtesting dataset',
  status: datasetPath ? (existsSync(datasetPath) ? 'ready' : 'blocked') : requireAll ? 'blocked' : 'not_requested',
  evidence: datasetPath ? [`HISTORICAL_BACKTEST_DATASET_PATH=${datasetPath}`] : ['HISTORICAL_BACKTEST_DATASET_PATH unset'],
  missing: datasetPath
    ? existsSync(datasetPath) ? [] : ['dataset path does not exist']
    : ['set HISTORICAL_BACKTEST_DATASET_PATH to a bank-approved historical dataset'],
});

const strictRequired =
  requireAll || env('NODE_ENV') === 'production' || env('REQUIRE_PROD_TENANCY') === 'true';
const strictReady = env('TENANCY_ENFORCE') === 'on' && env('TENANCY_STRICT') === 'on';
gates.push({
  id: 'prod-tenancy-strict',
  label: 'Production tenancy strict flip',
  status: strictReady ? 'ready' : strictRequired ? 'blocked' : 'not_requested',
  evidence: [`TENANCY_ENFORCE=${env('TENANCY_ENFORCE') || 'off'}`, `TENANCY_STRICT=${env('TENANCY_STRICT') || 'off'}`],
  missing: [
    ...(env('TENANCY_ENFORCE') === 'on' ? [] : ['TENANCY_ENFORCE=on']),
    ...(env('TENANCY_STRICT') === 'on' ? [] : ['TENANCY_STRICT=on']),
  ],
});

const summary = {
  ready: gates.filter((gate) => gate.status === 'ready').length,
  blocked: gates.filter((gate) => gate.status === 'blocked').length,
  notRequested: gates.filter((gate) => gate.status === 'not_requested').length,
  requireAll,
};

if (json) {
  console.log(JSON.stringify({ summary, gates }, null, 2));
} else {
  console.log(`External readiness: ${summary.ready} ready · ${summary.blocked} blocked · ${summary.notRequested} not requested`);
  for (const gate of gates) {
    const icon = gate.status === 'ready' ? 'OK' : gate.status === 'blocked' ? 'BLOCKED' : 'SKIP';
    console.log(`\n[${icon}] ${gate.label}`);
    for (const evidence of gate.evidence) console.log(`  evidence: ${evidence}`);
    for (const missing of gate.missing) console.log(`  missing: ${missing}`);
  }
}

if (requireAll && gates.some((gate) => gate.status !== 'ready')) {
  process.exitCode = 1;
}
