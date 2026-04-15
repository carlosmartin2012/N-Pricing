import { calculatePricing } from '../../utils/pricingEngine';
import { canonicalJson } from '../../utils/canonicalJson';
import { sha256Hex } from '../../utils/snapshotHash';
import type {
  Transaction,
  ApprovalMatrixConfig,
  FTPResult,
} from '../../types';
import type {
  PricingContext,
  PricingShocks,
} from '../../utils/pricingEngine';

/**
 * Re-executes a stored pricing snapshot with the current engine version.
 * Pure module — no DB, no network. The route handler loads the snapshot row
 * and feeds `replaySnapshot` with the stored JSONB payloads.
 */

export interface SnapshotInput {
  deal: Transaction;
  approvalMatrix?: ApprovalMatrixConfig;
  shocks?: { interestRate?: number; liquiditySpread?: number };
}

export interface SnapshotPayload {
  input: SnapshotInput;
  context: unknown;          // JSONB — cast to PricingContext at the boundary
  output: Record<string, unknown>;
  outputHash: string;
  engineVersion: string;
}

export interface ReplayDiffEntry {
  field: string;
  original: unknown;
  current: unknown;
  deltaAbs?: number;
  deltaBps?: number;
}

export interface ReplayResult {
  matches: boolean;
  engineVersionOriginal: string;
  engineVersionNow: string;
  originalOutputHash: string;
  currentOutputHash: string;
  diff: ReplayDiffEntry[];
}

const DEFAULT_APPROVAL: ApprovalMatrixConfig = {
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
};

/**
 * Fields on FTPResult that we compare numerically. Anything not on this list
 * falls back to JSON equality. The explicit list lets us report deltas in the
 * units callers care about (rates in absolute decimal + bps).
 */
const NUMERIC_FIELDS: Array<keyof FTPResult> = [
  'baseRate',
  'liquiditySpread',
  'strategicSpread',
  'capitalCharge',
  'totalFTP',
  'finalClientRate',
  'raroc',
  'economicProfit',
];

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

function computeDiff(original: Record<string, unknown>, current: Record<string, unknown>): ReplayDiffEntry[] {
  const entries: ReplayDiffEntry[] = [];
  for (const field of NUMERIC_FIELDS) {
    const o = asNumber(original[field]);
    const c = asNumber(current[field]);
    if (o === null && c === null) continue;
    if (o === c) continue;
    if (o !== null && c !== null) {
      const deltaAbs = c - o;
      entries.push({
        field: String(field),
        original: o,
        current: c,
        deltaAbs,
        deltaBps: deltaAbs * 10_000,
      });
    } else {
      entries.push({ field: String(field), original: original[field], current: current[field] });
    }
  }
  // Catch any new/removed top-level keys — useful when the engine grows a field.
  const keys = new Set([...Object.keys(original), ...Object.keys(current)]);
  for (const k of keys) {
    if (NUMERIC_FIELDS.includes(k as keyof FTPResult)) continue;
    const o = original[k];
    const c = current[k];
    if (JSON.stringify(o) !== JSON.stringify(c)) {
      entries.push({ field: k, original: o, current: c });
    }
  }
  return entries;
}

/**
 * Execute the engine against the stored input/context and compare to the
 * stored output. `currentEngineVersion` is threaded in from the caller (env)
 * so this module stays pure.
 */
export async function replaySnapshot(
  snapshot: SnapshotPayload,
  currentEngineVersion: string,
): Promise<ReplayResult> {
  const { input, context, output, outputHash, engineVersion } = snapshot;
  const approval = input.approvalMatrix ?? DEFAULT_APPROVAL;
  const shocks: PricingShocks = {
    interestRate: input.shocks?.interestRate ?? 0,
    liquiditySpread: input.shocks?.liquiditySpread ?? 0,
  };

  // Boundary cast — the context JSONB is structurally the same as PricingContext
  // but typed as unknown by the DB layer. Runtime shape is what the engine
  // validated when it ran the first time, so we trust it here.
  const ctx = context as PricingContext;

  const currentOutput = calculatePricing(input.deal, approval, ctx, shocks) as unknown as Record<string, unknown>;
  const currentOutputHash = await sha256Hex(canonicalJson(currentOutput));

  const hashMatches = currentOutputHash === outputHash;
  const diff = hashMatches ? [] : computeDiff(output, currentOutput);

  return {
    matches: hashMatches,
    engineVersionOriginal: engineVersion,
    engineVersionNow: currentEngineVersion,
    originalOutputHash: outputHash,
    currentOutputHash,
    diff,
  };
}

// Exposed for tests that want to build expected diffs against a known shape.
export { computeDiff };
