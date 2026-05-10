import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import { execute, query, queryOne, withTransaction, type Tx } from '../db';
import { safeError } from '../middleware/errorHandler';

const router = Router();

const SANDBOX_STATUSES = new Set(['draft', 'computing', 'ready', 'published', 'archived']);
const BACKTEST_STATUSES = new Set(['pending', 'running', 'completed', 'failed']);
const METHODOLOGY_AUTHOR_ROLES = new Set(['Admin', 'Risk_Manager', 'Methodologist', 'admin', 'risk_manager', 'methodologist']);
const TENOR_TO_BENCHMARK: Record<string, 'ST' | 'MT' | 'LT'> = {
  '0-1Y': 'ST',
  '1-3Y': 'MT',
  '3-5Y': 'LT',
  '5-10Y': 'LT',
  '10Y+': 'LT',
  ST: 'ST',
  MT: 'MT',
  LT: 'LT',
};

interface ImpactTotals {
  currentNii: number;
  projectedNii: number;
  currentRaroc: number;
  projectedRaroc: number;
  volume: number;
  volumeAtRisk: number;
}

interface CellEffect {
  ftpDeltaBps: number;
  clientRateDeltaBps: number;
  rarocDeltaPp: number;
}

interface ElasticityRow {
  id?: string;
  segment_key?: string;
  elasticity?: unknown;
  baseline_conversion?: unknown;
  sample_size?: unknown;
}

interface DealImpactRow {
  id?: string;
  product_type?: string;
  client_type?: string;
  currency?: string;
  amount?: unknown;
  duration_months?: unknown;
  pricing_snapshot?: unknown;
  approved_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
}

interface BacktestCohortTotals {
  product: string;
  segment: string;
  simulatedRateAmount: number;
  actualRateAmount: number;
  volume: number;
  dealCount: number;
}

interface BacktestPeriodTotals {
  simulatedPnl: number;
  actualPnl: number;
  dealCount: number;
}

function tenant(req: Request, res: Response) {
  if (!req.tenancy) {
    res.status(400).json({ code: 'tenancy_missing_header', message: 'x-entity-id required' });
    return null;
  }
  return req.tenancy;
}

function requireMethodologyAuthor(req: Request, res: Response): boolean {
  const role = req.tenancy?.role ?? req.user?.role ?? '';
  if (!METHODOLOGY_AUTHOR_ROLES.has(role)) {
    res.status(403).json({ code: 'forbidden', message: 'Admin, Risk_Manager or Methodologist role required' });
    return false;
  }
  return true;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? '');
}

function dateOnly(value: unknown): string {
  return isoDate(value).slice(0, 10);
}

function listParam(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => listParam(v));
  if (typeof value !== 'string') return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function addAnyFilter(filters: string[], params: unknown[], column: string, values: string[]): void {
  if (values.length === 0) return;
  params.push(values);
  filters.push(`${column} = ANY($${params.length}::text[])`);
}

function userEmail(req: Request): string {
  return req.tenancy?.userEmail ?? req.user?.email ?? 'system@n-pricing.local';
}

function userName(req: Request): string {
  return req.user?.name ?? req.tenancy?.userEmail ?? 'System';
}

async function resolveSnapshotId(entityId: string, candidate: unknown): Promise<string | null> {
  const provided = asString(candidate);
  if (provided) return provided;
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM methodology_snapshots
     WHERE entity_id = $1
     ORDER BY is_current DESC, approved_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [entityId],
  );
  return row?.id ?? null;
}

function sandboxToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: row.description == null ? undefined : String(row.description),
    baseSnapshotId: String(row.base_snapshot_id ?? ''),
    status: String(row.status ?? 'draft'),
    diffs: asJsonArray(row.diffs),
    createdAt: isoDate(row.created_at),
    createdByEmail: String(row.created_by_email ?? ''),
    createdByName: String(row.created_by_name ?? ''),
    updatedAt: isoDate(row.updated_at),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
  };
}

function gridCellToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ''),
    snapshotId: String(row.snapshot_id ?? ''),
    product: String(row.product ?? ''),
    segment: String(row.segment ?? ''),
    tenorBucket: String(row.tenor_bucket ?? ''),
    currency: String(row.currency ?? ''),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    canonicalDealInput: asJsonObject(row.canonical_deal_input),
    ftp: asNumber(row.ftp),
    liquidityPremium: row.liquidity_premium == null ? null : asNumber(row.liquidity_premium),
    capitalCharge: row.capital_charge == null ? null : asNumber(row.capital_charge),
    esgAdjustment: row.esg_adjustment == null ? null : asNumber(row.esg_adjustment),
    targetMargin: asNumber(row.target_margin),
    targetClientRate: asNumber(row.target_client_rate),
    targetRaroc: asNumber(row.target_raroc),
    components: asJsonObject(row.components),
    computedAt: isoDate(row.computed_at ?? row.created_at),
  };
}

function amountFromCell(row: Record<string, unknown>): number {
  const input = asJsonObject(row.canonical_deal_input);
  return asNumber(input.amount ?? input.principal ?? input.notional, 1_000_000);
}

function diffDeltaBps(diff: unknown): number {
  if (!diff || typeof diff !== 'object') return 0;
  const record = diff as Record<string, unknown>;
  const current = Number(record.currentValue);
  const proposed = Number(record.proposedValue);
  if (!Number.isFinite(current) || !Number.isFinite(proposed)) return 0;
  return proposed - current;
}

function includesScopeValue(scope: unknown, keys: string[], value: string): boolean {
  if (!scope || typeof scope !== 'object') return true;
  const record = scope as Record<string, unknown>;
  for (const key of keys) {
    const raw = record[key];
    const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    if (values.length === 0) continue;
    return values.map(String).includes(value);
  }
  return true;
}

function diffMatchesCell(diff: unknown, cell: ReturnType<typeof gridCellToDto>): boolean {
  if (!diff || typeof diff !== 'object') return false;
  const record = diff as Record<string, unknown>;
  const scope = record.scope ?? record.cohort ?? record.filters;
  return (
    includesScopeValue(scope, ['product', 'products', 'productType', 'productTypes'], cell.product) &&
    includesScopeValue(scope, ['segment', 'segments', 'clientType', 'clientTypes'], cell.segment) &&
    includesScopeValue(scope, ['tenorBucket', 'tenorBuckets', 'tenor_bucket', 'tenor_buckets'], cell.tenorBucket) &&
    includesScopeValue(scope, ['currency', 'currencies'], cell.currency)
  );
}

function effectFromDiff(diff: unknown, cell: ReturnType<typeof gridCellToDto>): CellEffect {
  if (!diffMatchesCell(diff, cell)) {
    return { ftpDeltaBps: 0, clientRateDeltaBps: 0, rarocDeltaPp: 0 };
  }
  const record = diff as Record<string, unknown>;
  const deltaBps = diffDeltaBps(diff);
  const changeType = String(record.changeType ?? '');
  if (changeType === 'capital') {
    return { ftpDeltaBps: 0, clientRateDeltaBps: deltaBps, rarocDeltaPp: -(deltaBps / 100) };
  }
  if (changeType === 'threshold') {
    return { ftpDeltaBps: 0, clientRateDeltaBps: 0, rarocDeltaPp: deltaBps / 100 };
  }
  return {
    ftpDeltaBps: deltaBps,
    clientRateDeltaBps: deltaBps,
    rarocDeltaPp: -(deltaBps / 100),
  };
}

function effectForCell(diffs: unknown[], cell: ReturnType<typeof gridCellToDto>): CellEffect {
  return diffs.reduce<CellEffect>((acc, diff) => {
    const effect = effectFromDiff(diff, cell);
    acc.ftpDeltaBps += effect.ftpDeltaBps;
    acc.clientRateDeltaBps += effect.clientRateDeltaBps;
    acc.rarocDeltaPp += effect.rarocDeltaPp;
    return acc;
  }, { ftpDeltaBps: 0, clientRateDeltaBps: 0, rarocDeltaPp: 0 });
}

function tenorBucketFromMonths(months: number): string {
  if (months <= 12) return '0-1Y';
  if (months <= 36) return '1-3Y';
  if (months <= 60) return '3-5Y';
  if (months <= 120) return '5-10Y';
  return '10Y+';
}

function parseSegmentKey(row: ElasticityRow) {
  const [product = 'ALL', segment = 'ALL', currency = 'ALL', tenor = 'ALL'] = String(row.segment_key ?? '').split('|');
  return { product, segment, currency, tenor };
}

function tokenMatches(token: string, value: string): boolean {
  return !token || token === 'ALL' || token === value;
}

function pickElasticityModel(
  models: ElasticityRow[],
  cell: { product: string; segment: string; currency: string; tenorBucket: string },
): ElasticityRow | null {
  let best: { row: ElasticityRow; score: number } | null = null;
  for (const row of models) {
    const key = parseSegmentKey(row);
    if (!tokenMatches(key.product, cell.product)) continue;
    if (!tokenMatches(key.segment, cell.segment)) continue;
    if (!tokenMatches(key.currency, cell.currency)) continue;
    if (!tokenMatches(key.tenor, cell.tenorBucket)) continue;
    const score = [key.product, key.segment, key.currency, key.tenor].filter((v) => v !== 'ALL').length;
    if (!best || score > best.score) best = { row, score };
  }
  return best?.row ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateVolumeDeltaPct(model: ElasticityRow | null, clientRateDeltaBps: number): number {
  if (!model) return 0;
  const slope = -Math.abs(asNumber(model.elasticity));
  const intercept = asNumber(model.baseline_conversion);
  return clamp(slope * clientRateDeltaBps + intercept, -80, 200);
}

function extractPricingOutput(value: unknown): Record<string, unknown> {
  const snapshot = asJsonObject(value);
  const output = snapshot.output ?? snapshot.result ?? snapshot.pricingResult ?? snapshot;
  return asJsonObject(output);
}

function cellKeyFromDto(cell: { product: string; segment: string; tenorBucket: string; currency: string }): string {
  return `${cell.product}|${cell.segment}|${cell.tenorBucket}|${cell.currency}`;
}

function findDealCell(
  deal: DealImpactRow,
  cellsByKey: Map<string, ReturnType<typeof gridCellToDto>>,
): ReturnType<typeof gridCellToDto> | null {
  const product = String(deal.product_type ?? '');
  const segment = String(deal.client_type ?? '');
  const currency = String(deal.currency ?? 'EUR');
  const tenorBucket = tenorBucketFromMonths(asNumber(deal.duration_months, 12));
  return cellsByKey.get(`${product}|${segment}|${tenorBucket}|${currency}`) ?? null;
}

function dateKey(value: unknown): string {
  const raw = isoDate(value);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function periodKey(value: unknown): string {
  return dateKey(value).slice(0, 7);
}

function pricingRate(output: Record<string, unknown>, fallback: number): number {
  return asNumber(
    output.finalClientRate ??
      output.final_client_rate ??
      output.clientRate ??
      output.client_rate ??
      output.allInRate ??
      output.all_in_rate,
    fallback,
  );
}

function pricingRaroc(output: Record<string, unknown>, fallback: number): number {
  return asNumber(output.raroc ?? output.RAROC ?? output.rarocPct ?? output.raroc_pct, fallback);
}

function buildBacktestResult(
  runId: string,
  cells: Record<string, unknown>[],
  dealRows: DealImpactRow[],
  diffs: unknown[],
) {
  const cellsByKey = new Map(
    cells.map((row) => {
      const cell = gridCellToDto(row);
      return [cellKeyFromDto(cell), cell] as const;
    }),
  );

  const periodTotals = new Map<string, BacktestPeriodTotals>();
  const cohortTotals = new Map<string, BacktestCohortTotals>();
  let simulatedPnl = 0;
  let actualPnl = 0;
  let simulatedRaroc = 0;
  let actualRaroc = 0;
  let dealCount = 0;

  for (const deal of dealRows) {
    const cell = findDealCell(deal, cellsByKey);
    if (!cell) continue;

    const output = extractPricingOutput(deal.pricing_snapshot);
    const effect = effectForCell(diffs, cell);
    const amount = asNumber(deal.amount);
    const durationYears = Math.max(asNumber(deal.duration_months, 12), 1) / 12;
    const actualRate = pricingRate(output, cell.targetClientRate);
    const simulatedRate = cell.targetClientRate + (effect.clientRateDeltaBps / 100);
    const actualDealRaroc = pricingRaroc(output, cell.targetRaroc);
    const simulatedDealRaroc = cell.targetRaroc + effect.rarocDeltaPp;
    const actualDealPnl = amount * (actualRate / 100) * durationYears;
    const simulatedDealPnl = amount * (simulatedRate / 100) * durationYears;
    const date = deal.approved_at ?? deal.updated_at ?? deal.created_at;
    const period = periodKey(date);
    const cohortKey = `${cell.product}|${cell.segment}`;

    simulatedPnl += simulatedDealPnl;
    actualPnl += actualDealPnl;
    simulatedRaroc += simulatedDealRaroc;
    actualRaroc += actualDealRaroc;
    dealCount += 1;

    const periodEntry = periodTotals.get(period) ?? { simulatedPnl: 0, actualPnl: 0, dealCount: 0 };
    periodEntry.simulatedPnl += simulatedDealPnl;
    periodEntry.actualPnl += actualDealPnl;
    periodEntry.dealCount += 1;
    periodTotals.set(period, periodEntry);

    const cohortEntry = cohortTotals.get(cohortKey) ?? {
      product: cell.product,
      segment: cell.segment,
      simulatedRateAmount: 0,
      actualRateAmount: 0,
      volume: 0,
      dealCount: 0,
    };
    cohortEntry.simulatedRateAmount += simulatedRate * amount;
    cohortEntry.actualRateAmount += actualRate * amount;
    cohortEntry.volume += amount;
    cohortEntry.dealCount += 1;
    cohortTotals.set(cohortKey, cohortEntry);
  }

  const pnlDelta = simulatedPnl - actualPnl;
  const simulatedAvgRarocPct = dealCount === 0 ? 0 : simulatedRaroc / dealCount;
  const actualAvgRarocPct = dealCount === 0 ? 0 : actualRaroc / dealCount;

  return {
    runId,
    simulatedPnl,
    actualPnl,
    pnlDelta,
    pnlDeltaPct: actualPnl === 0 ? 0 : (pnlDelta / actualPnl) * 100,
    simulatedAvgRaroc: simulatedAvgRarocPct / 100,
    actualAvgRaroc: actualAvgRarocPct / 100,
    rarocDeltaPp: simulatedAvgRarocPct - actualAvgRarocPct,
    periodBreakdown: Array.from(periodTotals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, totals]) => ({
        period,
        simulatedPnl: totals.simulatedPnl,
        actualPnl: totals.actualPnl,
        delta: totals.simulatedPnl - totals.actualPnl,
        dealCount: totals.dealCount,
      })),
    cohortBreakdown: Array.from(cohortTotals.values())
      .sort((a, b) => b.volume - a.volume)
      .map((cohort) => {
        const simulatedAvgRatePct = cohort.volume === 0 ? 0 : cohort.simulatedRateAmount / cohort.volume;
        const actualAvgRatePct = cohort.volume === 0 ? 0 : cohort.actualRateAmount / cohort.volume;
        return {
          product: cohort.product,
          segment: cohort.segment,
          simulatedAvgRate: simulatedAvgRatePct / 100,
          actualAvgRate: actualAvgRatePct / 100,
          rateDeltaBps: (simulatedAvgRatePct - actualAvgRatePct) * 100,
          dealCount: cohort.dealCount,
          volumeEur: cohort.volume,
        };
      }),
  };
}

async function computeImpactReport(sandboxId: string, entityId: string, markReady: boolean) {
  const sandbox = await queryOne<Record<string, unknown>>(
    `SELECT * FROM sandbox_methodologies
     WHERE id = $1 AND entity_id = $2
     LIMIT 1`,
    [sandboxId, entityId],
  );
  if (!sandbox) return null;

  const diffs = asJsonArray(sandbox.diffs);
  const baseSnapshotId = String(sandbox.base_snapshot_id ?? '');
  const [rows, elasticityRows, dealRows] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT * FROM target_grid_cells
       WHERE snapshot_id = $1 AND entity_id = $2
       ORDER BY product, segment, tenor_bucket, currency`,
      [baseSnapshotId, entityId],
    ),
    query<ElasticityRow>(
      `SELECT * FROM elasticity_models
       WHERE is_active = true AND (entity_id IS NULL OR entity_id = $1)
       ORDER BY calibrated_at DESC`,
      [entityId],
    ),
    query<DealImpactRow>(
      `SELECT id, product_type, client_type, currency, amount, duration_months, pricing_snapshot
       FROM deals
       WHERE entity_id = $1 AND status IN ('Booked', 'Approved', 'Pending_Approval')
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1000`,
      [entityId],
    ),
  ]);

  const cellImpacts = rows.map((row) => {
    const currentCell = gridCellToDto(row);
    const effect = effectForCell(diffs, currentCell);
    const rateDeltaPct = effect.clientRateDeltaBps / 100;
    const ftpDeltaPct = effect.ftpDeltaBps / 100;
    const model = pickElasticityModel(elasticityRows, currentCell);
    const estimatedVolumeDeltaPct = estimateVolumeDeltaPct(model, effect.clientRateDeltaBps);
    const amount = amountFromCell(row);
    const proposedCell = {
      ...currentCell,
      ftp: currentCell.ftp + ftpDeltaPct,
      targetClientRate: currentCell.targetClientRate + rateDeltaPct,
      targetRaroc: currentCell.targetRaroc + effect.rarocDeltaPp,
    };
    return {
      product: currentCell.product,
      segment: currentCell.segment,
      tenorBucket: currentCell.tenorBucket,
      currency: currentCell.currency,
      currentCell,
      proposedCell,
      ftpDeltaBps: effect.ftpDeltaBps,
      rarocDeltaPp: effect.rarocDeltaPp,
      clientRateDeltaBps: effect.clientRateDeltaBps,
      estimatedVolumeDelta: amount * (estimatedVolumeDeltaPct / 100),
      estimatedVolumeDeltaPct,
      elasticityModelId: model?.id ?? null,
    };
  });

  const totals = rows.reduce<ImpactTotals>((acc, row, index) => {
    const amount = amountFromCell(row);
    const impact = cellImpacts[index];
    const projectedAmount = amount + asNumber(impact.estimatedVolumeDelta);
    const currentRate = asNumber(row.target_client_rate);
    const projectedRate = currentRate + (impact.clientRateDeltaBps / 100);
    const currentRaroc = asNumber(row.target_raroc);
    acc.currentNii += amount * (currentRate / 100);
    acc.projectedNii += projectedAmount * (projectedRate / 100);
    acc.currentRaroc += currentRaroc;
    acc.projectedRaroc += currentRaroc + impact.rarocDeltaPp;
    acc.volume += amount;
    if (Math.abs(impact.clientRateDeltaBps) > 25 || Math.abs(asNumber(impact.estimatedVolumeDeltaPct)) >= 2) {
      acc.volumeAtRisk += amount;
    }
    return acc;
  }, {
    currentNii: 0,
    projectedNii: 0,
    currentRaroc: 0,
    projectedRaroc: 0,
    volume: 0,
    volumeAtRisk: 0,
  });

  const cellsByKey = new Map(
    cellImpacts.map((impact) => [cellKeyFromDto(impact.currentCell), impact.currentCell]),
  );
  const effectsByKey = new Map(
    cellImpacts.map((impact) => [cellKeyFromDto(impact.currentCell), impact]),
  );
  const dealPortfolio = dealRows.reduce<ImpactTotals & { dealCount: number; affectedDealCount: number }>((acc, deal) => {
    const matchedCell = findDealCell(deal, cellsByKey);
    if (!matchedCell) return acc;
    const effect = effectsByKey.get(cellKeyFromDto(matchedCell));
    if (!effect) return acc;
    const output = extractPricingOutput(deal.pricing_snapshot);
    const amount = asNumber(deal.amount);
    const durationYears = Math.max(asNumber(deal.duration_months, 12), 1) / 12;
    const currentRate = asNumber(
      output.finalClientRate ?? output.final_client_rate ?? output.clientRate ?? output.client_rate,
      matchedCell.targetClientRate,
    );
    const currentRaroc = asNumber(output.raroc ?? output.RAROC, matchedCell.targetRaroc);
    const projectedRate = currentRate + (effect.clientRateDeltaBps / 100);
    const projectedAmount = amount + amount * (asNumber(effect.estimatedVolumeDeltaPct) / 100);
    acc.currentNii += amount * (currentRate / 100) * durationYears;
    acc.projectedNii += projectedAmount * (projectedRate / 100) * durationYears;
    acc.currentRaroc += currentRaroc;
    acc.projectedRaroc += currentRaroc + effect.rarocDeltaPp;
    acc.volume += amount;
    acc.dealCount += 1;
    if (Math.abs(effect.clientRateDeltaBps) > 0.0001 || Math.abs(effect.rarocDeltaPp) > 0.0001) {
      acc.affectedDealCount += 1;
    }
    if (Math.abs(effect.clientRateDeltaBps) > 25 || Math.abs(asNumber(effect.estimatedVolumeDeltaPct)) >= 2) {
      acc.volumeAtRisk += amount;
    }
    return acc;
  }, {
    currentNii: 0,
    projectedNii: 0,
    currentRaroc: 0,
    projectedRaroc: 0,
    volume: 0,
    volumeAtRisk: 0,
    dealCount: 0,
    affectedDealCount: 0,
  });

  const niiDelta = totals.projectedNii - totals.currentNii;
  const avgFtpChangeBps = cellImpacts.length === 0
    ? 0
    : cellImpacts.reduce((sum, impact) => sum + impact.ftpDeltaBps, 0) / cellImpacts.length;
  const avgRarocChangePp = cellImpacts.length === 0
    ? 0
    : cellImpacts.reduce((sum, impact) => sum + impact.rarocDeltaPp, 0) / cellImpacts.length;
  const dealNiiDelta = dealPortfolio.projectedNii - dealPortfolio.currentNii;
  const portfolioSource = dealPortfolio.dealCount > 0 ? dealPortfolio : {
    ...totals,
    dealCount: rows.length,
    affectedDealCount: cellImpacts.filter((impact) => (
      Math.abs(impact.clientRateDeltaBps) > 0.0001 || Math.abs(impact.rarocDeltaPp) > 0.0001
    )).length,
  };
  const portfolioNiiDelta = dealPortfolio.dealCount > 0 ? dealNiiDelta : niiDelta;
  const portfolioCount = Math.max(portfolioSource.dealCount, 1);
  const report = {
    sandboxId,
    baseSnapshotId,
    computedAt: new Date().toISOString(),
    summary: {
      totalCellsAffected: cellImpacts.filter((impact) => (
        Math.abs(impact.ftpDeltaBps) > 0.0001 ||
        Math.abs(impact.clientRateDeltaBps) > 0.0001 ||
        Math.abs(impact.rarocDeltaPp) > 0.0001
      )).length,
      avgFtpChangeBps,
      avgRarocChangePp,
      estimatedNiiDelta: niiDelta,
      estimatedNiiDeltaPct: totals.currentNii === 0 ? 0 : (niiDelta / totals.currentNii) * 100,
      volumeAtRisk: totals.volumeAtRisk,
      volumeAtRiskPct: totals.volume === 0 ? 0 : (totals.volumeAtRisk / totals.volume) * 100,
    },
    cellImpacts,
    portfolioImpact: {
      currentNii: portfolioSource.currentNii,
      projectedNii: portfolioSource.projectedNii,
      niiDelta: portfolioNiiDelta,
      currentAvgRaroc: portfolioSource.currentRaroc / portfolioCount,
      projectedAvgRaroc: portfolioSource.projectedRaroc / portfolioCount,
      rarocDelta: (portfolioSource.projectedRaroc - portfolioSource.currentRaroc) / portfolioCount,
      dealCount: portfolioSource.dealCount,
      affectedDealCount: portfolioSource.affectedDealCount,
    },
  };

  if (markReady) {
    await execute(
      `UPDATE sandbox_methodologies
       SET status = 'ready', updated_at = now()
       WHERE id = $1 AND entity_id = $2`,
      [sandboxId, entityId],
    );
  }

  return report;
}

function backtestToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: row.description == null ? undefined : String(row.description),
    sandboxId: row.sandbox_id == null ? undefined : String(row.sandbox_id),
    snapshotId: String(row.snapshot_id ?? ''),
    dateFrom: dateOnly(row.date_from),
    dateTo: dateOnly(row.date_to),
    status: String(row.status ?? 'pending'),
    dealCount: asNumber(row.deal_count),
    filters: row.filters == null ? undefined : asJsonObject(row.filters),
    startedAt: isoDate(row.started_at),
    completedAt: row.completed_at == null ? undefined : isoDate(row.completed_at),
    durationMs: row.duration_ms == null ? undefined : asNumber(row.duration_ms),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    createdByEmail: String(row.created_by_email ?? ''),
  };
}

function emptyBacktestResult(runId: string) {
  return {
    runId,
    simulatedPnl: 0,
    actualPnl: 0,
    pnlDelta: 0,
    pnlDeltaPct: 0,
    simulatedAvgRaroc: 0,
    actualAvgRaroc: 0,
    rarocDeltaPp: 0,
    periodBreakdown: [],
    cohortBreakdown: [],
  };
}

function governanceIdSuffix(id: string): string {
  const clean = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return (clean || 'SANDBOX').slice(0, 12);
}

function upsertById<T extends Record<string, unknown>>(items: unknown[], item: T): unknown[] {
  const id = String(item.id ?? '');
  let replaced = false;
  const next = items.map((existing) => {
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return existing;
    if (String((existing as Record<string, unknown>).id ?? '') !== id) return existing;
    replaced = true;
    return item;
  });
  return replaced ? next : [item, ...next];
}

function findById(items: unknown[], id: string): Record<string, unknown> | null {
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (String(record.id ?? '') === id) return record;
  }
  return null;
}

function buildSandboxGovernanceArtifacts(
  req: Request,
  sandbox: Record<string, unknown>,
  publishedSandbox: Record<string, unknown>,
) {
  const sandboxId = String(sandbox.id);
  const suffix = governanceIdSuffix(sandboxId);
  const requestId = `MCR-WHATIF-${suffix}`;
  const approvalTaskId = `ATK-WHATIF-${suffix}`;
  const name = asString(sandbox.name, sandboxId);
  const submittedAt = new Date().toISOString();
  const correlation = {
    correlationId: `${requestId}:publish`,
    changeRequestId: requestId,
    approvalTaskId,
  };
  const currentSnapshot = sandboxToDto(sandbox) as unknown as Record<string, unknown>;
  const proposedSnapshot = sandboxToDto(publishedSandbox) as unknown as Record<string, unknown>;
  const diffCount = asJsonArray(sandbox.diffs).length;
  const reason = `Review What-If sandbox ${name} before applying the methodology decision.`;
  const request = {
    id: requestId,
    title: `Publish sandbox: ${name}`,
    reason,
    target: 'SANDBOX',
    action: 'IMPORT',
    status: 'Pending_Review',
    submittedByEmail: userEmail(req),
    submittedByName: userName(req),
    submittedAt,
    correlation,
    operations: [
      {
        entityType: 'SANDBOX',
        entityId: sandboxId,
        action: 'IMPORT',
        summary: `Publish What-If sandbox ${name}`,
        currentValue: {
          status: String(sandbox.status ?? 'ready'),
          baseSnapshotId: String(sandbox.base_snapshot_id ?? ''),
          diffCount,
        },
        proposedValue: {
          status: 'published',
          baseSnapshotId: String(publishedSandbox.base_snapshot_id ?? ''),
          diffCount,
          diffs: asJsonArray(publishedSandbox.diffs),
        },
        currentSnapshot,
        proposedSnapshot,
      },
    ],
  };
  const task = {
    id: approvalTaskId,
    scope: 'METHODOLOGY_CHANGE',
    status: 'Pending',
    title: `Review sandbox: ${name}`,
    description: reason,
    requiredRole: 'Risk_Manager',
    submittedByEmail: userEmail(req),
    submittedByName: userName(req),
    submittedAt,
    subject: {
      type: 'METHOD_CHANGE',
      id: requestId,
      label: `Publish sandbox: ${name}`,
    },
    correlation,
  };
  return { request, task };
}

async function readConfigArray(tx: Tx, key: string): Promise<unknown[]> {
  const row = await tx.queryOne<{ value: unknown }>(
    'SELECT value FROM system_config WHERE key = $1 FOR UPDATE',
    [key],
  );
  return asJsonArray(row?.value);
}

async function saveConfigArray(tx: Tx, key: string, value: unknown[]): Promise<void> {
  await tx.execute(
    `INSERT INTO system_config (key, value, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, JSON.stringify(value)],
  );
}

function benchmarkToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    productType: String(row.product_type ?? ''),
    tenorBucket: String(row.tenor_bucket ?? ''),
    clientType: String(row.client_type ?? ''),
    currency: String(row.currency ?? ''),
    rate: asNumber(row.rate),
    source: String(row.source ?? ''),
    asOfDate: dateOnly(row.as_of_date),
    notes: row.notes == null ? undefined : String(row.notes),
  };
}

function budgetToDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    product: String(row.product ?? ''),
    segment: String(row.segment ?? ''),
    currency: String(row.currency ?? ''),
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    period: String(row.period ?? ''),
    targetNii: asNumber(row.target_nii),
    targetVolume: asNumber(row.target_volume),
    targetRaroc: asNumber(row.target_raroc),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

function elasticityToDto(row: Record<string, unknown>) {
  const [product = '', segment = ''] = String(row.segment_key ?? '').split('|');
  const method = String(row.method ?? '');
  return {
    id: String(row.id),
    product,
    segment,
    entityId: row.entity_id == null ? undefined : String(row.entity_id),
    slope: -Math.abs(asNumber(row.elasticity)),
    intercept: asNumber(row.baseline_conversion),
    rSquared: null,
    source: method === 'FREQUENTIST' ? 'empirical' : 'hybrid',
    sampleSize: asNumber(row.sample_size),
    calibratedAt: isoDate(row.calibrated_at),
    calibratedByEmail: 'system@n-pricing.local',
    validFrom: isoDate(row.calibrated_at),
    notes: `confidence=${String(row.confidence ?? 'LOW')}; method=${method || 'BAYESIAN'}`,
  };
}

// ---------------------------------------------------------------------------
// Sandboxes
// ---------------------------------------------------------------------------

router.get('/sandboxes', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM sandbox_methodologies
       WHERE entity_id = $1
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 200`,
      [tenancy.entityId],
    );
    res.json(rows.map(sandboxToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/sandboxes/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const row = await queryOne<Record<string, unknown>>(
      `SELECT * FROM sandbox_methodologies
       WHERE id = $1 AND entity_id = $2
       LIMIT 1`,
      [req.params.id, tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(sandboxToDto(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/sandboxes', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    if (!name) {
      res.status(400).json({ code: 'invalid_payload', message: 'name required' });
      return;
    }
    const baseSnapshotId = await resolveSnapshotId(tenancy.entityId, body.baseSnapshotId);
    if (!baseSnapshotId) {
      res.status(400).json({ code: 'base_snapshot_required', message: 'No methodology snapshot exists for this entity' });
      return;
    }
    const status = SANDBOX_STATUSES.has(String(body.status)) ? String(body.status) : 'draft';
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO sandbox_methodologies
         (id, name, description, base_snapshot_id, status, diffs,
          created_by_email, created_by_name, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
       RETURNING *`,
      [
        asString(body.id, randomUUID()),
        name,
        body.description ?? null,
        baseSnapshotId,
        status,
        JSON.stringify(Array.isArray(body.diffs) ? body.diffs : []),
        asString(body.createdByEmail, userEmail(req)),
        asString(body.createdByName, userName(req)),
        tenancy.entityId,
      ],
    );
    res.status(201).json(row ? sandboxToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.patch('/sandboxes/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (column: string, value: unknown, cast = '') => {
      params.push(value);
      sets.push(`${column} = $${params.length}${cast}`);
    };

    if (body.name !== undefined) add('name', asString(body.name));
    if (body.description !== undefined) add('description', body.description ?? null);
    if (body.status !== undefined && SANDBOX_STATUSES.has(String(body.status))) add('status', String(body.status));
    if (body.diffs !== undefined) add('diffs', JSON.stringify(Array.isArray(body.diffs) ? body.diffs : []), '::jsonb');

    if (sets.length === 0) {
      const current = await queryOne<Record<string, unknown>>(
        `SELECT * FROM sandbox_methodologies WHERE id = $1 AND entity_id = $2 LIMIT 1`,
        [req.params.id, tenancy.entityId],
      );
      if (!current) {
        res.status(404).json({ code: 'not_found' });
        return;
      }
      res.json(sandboxToDto(current));
      return;
    }

    params.push(req.params.id, tenancy.entityId);
    const row = await queryOne<Record<string, unknown>>(
      `UPDATE sandbox_methodologies
       SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length - 1} AND entity_id = $${params.length}
       RETURNING *`,
      params,
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(sandboxToDto(row));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/sandboxes/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const rows = await query<{ id: string }>(
      `DELETE FROM sandbox_methodologies
       WHERE id = $1 AND entity_id = $2
       RETURNING id`,
      [req.params.id, tenancy.entityId],
    );
    if (rows.length === 0) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/sandboxes/:id/impact', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const report = await computeImpactReport(req.params.id, tenancy.entityId, true);
    if (!report) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/sandboxes/:id/impact', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const report = await computeImpactReport(req.params.id, tenancy.entityId, false);
    if (!report) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/sandboxes/:id/publish', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;

    const result = await withTransaction(async (tx) => {
      const sandbox = await tx.queryOne<Record<string, unknown>>(
        `SELECT * FROM sandbox_methodologies
         WHERE id = $1 AND entity_id = $2
         LIMIT 1
         FOR UPDATE`,
        [req.params.id, tenancy.entityId],
      );
      if (!sandbox) return null;

      const status = String(sandbox.status ?? 'draft');
      if (!['ready', 'published'].includes(status)) {
        return { blocked: true, status };
      }

      const publishedSandbox = await tx.queryOne<Record<string, unknown>>(
        `UPDATE sandbox_methodologies
         SET status = 'published', updated_at = now()
         WHERE id = $1 AND entity_id = $2
         RETURNING *`,
        [req.params.id, tenancy.entityId],
      );
      if (!publishedSandbox) return null;

      const { request, task } = buildSandboxGovernanceArtifacts(req, sandbox, publishedSandbox);
      const currentRequests = await readConfigArray(tx, 'methodology_change_requests');
      const currentTasks = await readConfigArray(tx, 'approval_tasks');
      const requestToPersist = status === 'published'
        ? findById(currentRequests, String(request.id)) ?? request
        : request;
      const taskToPersist = status === 'published'
        ? findById(currentTasks, String(task.id)) ?? task
        : task;
      const requests = upsertById(currentRequests, requestToPersist);
      const tasks = upsertById(currentTasks, taskToPersist);

      await saveConfigArray(tx, 'methodology_change_requests', requests);
      await saveConfigArray(tx, 'approval_tasks', tasks);

      return { request: requestToPersist, task: taskToPersist, sandbox: sandboxToDto(publishedSandbox) };
    });

    if (!result) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    if ('blocked' in result) {
      res.status(409).json({
        code: 'impact_not_ready',
        message: 'Compute impact before publishing a sandbox to Governance',
        status: result.status,
      });
      return;
    }
    res.json({
      governance_request_id: result.request.id,
      governanceRequestId: result.request.id,
      approval_task_id: result.task.id,
      approvalTaskId: result.task.id,
      request: result.request,
      approvalTask: result.task,
      sandbox: result.sandbox,
    });
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Elasticity
// ---------------------------------------------------------------------------

router.get('/elasticity', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM elasticity_models
       WHERE is_active = true AND (entity_id IS NULL OR entity_id = $1)
       ORDER BY calibrated_at DESC
       LIMIT 200`,
      [tenancy.entityId],
    );
    res.json(rows.map(elasticityToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/elasticity', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = asString(body.product);
    const segment = asString(body.segment);
    if (!product || !segment) {
      res.status(400).json({ code: 'invalid_payload', message: 'product and segment required' });
      return;
    }
    const segmentKey = `${product}|${segment}|ALL|ALL`;
    const source = asString(body.source, 'expert');
    const method = source === 'empirical' ? 'FREQUENTIST' : 'BAYESIAN';
    const sampleSize = Math.max(0, asNumber(body.sampleSize, 0));
    const confidence = sampleSize >= 100 ? 'HIGH' : sampleSize >= 30 ? 'MEDIUM' : 'LOW';
    const row = await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE elasticity_models
         SET is_active = false
         WHERE segment_key = $1 AND COALESCE(entity_id, '') = $2`,
        [segmentKey, tenancy.entityId],
      );
      return tx.queryOne<Record<string, unknown>>(
        `INSERT INTO elasticity_models
           (id, segment_key, elasticity, baseline_conversion, anchor_rate,
            sample_size, confidence, method, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          asString(body.id, randomUUID()),
          segmentKey,
          Math.abs(asNumber(body.slope, -0.05)),
          asNumber(body.intercept, 0),
          0,
          sampleSize,
          confidence,
          method,
          tenancy.entityId,
        ],
      );
    });
    res.status(201).json(row ? elasticityToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/elasticity/calibrate', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = asString(body.product);
    const segment = asString(body.segment);
    if (!product || !segment) {
      res.status(400).json({ code: 'invalid_payload', message: 'product and segment required' });
      return;
    }
    const segmentKey = `${product}|${segment}|ALL|ALL`;
    const row = await withTransaction(async (tx) => {
      await tx.execute(
        `UPDATE elasticity_models
         SET is_active = false
         WHERE segment_key = $1 AND COALESCE(entity_id, '') = $2`,
        [segmentKey, tenancy.entityId],
      );
      return tx.queryOne<Record<string, unknown>>(
        `INSERT INTO elasticity_models
           (id, segment_key, elasticity, baseline_conversion, anchor_rate,
            sample_size, confidence, method, entity_id)
         VALUES ($1, $2, $3, 0, 0, 0, 'LOW', 'BAYESIAN', $4)
         RETURNING *`,
        [randomUUID(), segmentKey, 0.05, tenancy.entityId],
      );
    });
    res.status(201).json(row ? elasticityToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.delete('/elasticity/:id', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const rows = await query<{ id: string }>(
      `UPDATE elasticity_models
       SET is_active = false
       WHERE id = $1 AND (entity_id IS NULL OR entity_id = $2)
       RETURNING id`,
      [req.params.id, tenancy.entityId],
    );
    if (rows.length === 0) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Backtests
// ---------------------------------------------------------------------------

router.get('/backtests', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM backtesting_runs
       WHERE entity_id = $1
       ORDER BY started_at DESC
       LIMIT 200`,
      [tenancy.entityId],
    );
    res.json(rows.map(backtestToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/backtests', async (req, res) => {
  try {
    const startedAt = Date.now();
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    if (!name) {
      res.status(400).json({ code: 'invalid_payload', message: 'name required' });
      return;
    }
    const snapshotId = await resolveSnapshotId(tenancy.entityId, body.snapshotId);
    if (!snapshotId) {
      res.status(400).json({ code: 'snapshot_required', message: 'snapshotId required' });
      return;
    }
    const id = asString(body.id, randomUUID());
    const sandboxId = asString(body.sandboxId);
    const sandbox = sandboxId
      ? await queryOne<Record<string, unknown>>(
        `SELECT * FROM sandbox_methodologies
         WHERE id = $1 AND entity_id = $2
         LIMIT 1`,
        [sandboxId, tenancy.entityId],
      )
      : null;
    if (sandboxId && !sandbox) {
      res.status(404).json({ code: 'sandbox_not_found' });
      return;
    }
    const cells = await query<Record<string, unknown>>(
      `SELECT * FROM target_grid_cells
       WHERE snapshot_id = $1 AND entity_id = $2
       ORDER BY product, segment, tenor_bucket, currency`,
      [snapshotId, tenancy.entityId],
    );
    const dateFrom = asString(body.dateFrom, new Date().toISOString().slice(0, 10));
    const dateTo = asString(body.dateTo, new Date().toISOString().slice(0, 10));
    const dealRows = await query<DealImpactRow>(
      `SELECT id, product_type, client_type, currency, amount, duration_months,
              pricing_snapshot, approved_at, created_at, updated_at
       FROM deals
       WHERE entity_id = $1
         AND COALESCE(approved_at::date, created_at::date) BETWEEN $2::date AND $3::date
         AND status IN ('Booked', 'Approved', 'Pending_Approval', 'Pending', 'Draft')
       ORDER BY COALESCE(approved_at, created_at) ASC
       LIMIT 10000`,
      [tenancy.entityId, dateFrom, dateTo],
    );
    const result = buildBacktestResult(id, cells, dealRows, asJsonArray(sandbox?.diffs));
    const durationMs = Date.now() - startedAt;
    const status = BACKTEST_STATUSES.has(String(body.status)) ? String(body.status) : 'completed';
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO backtesting_runs
         (id, name, description, sandbox_id, snapshot_id, date_from, date_to,
          status, deal_count, filters, completed_at, duration_ms, entity_id,
          created_by_email, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now(), $11, $12, $13, $14::jsonb)
       RETURNING *`,
      [
        id,
        name,
        body.description ?? null,
        sandboxId || null,
        snapshotId,
        dateFrom,
        dateTo,
        status,
        result.periodBreakdown.reduce((sum, period) => sum + period.dealCount, 0),
        JSON.stringify(body.filters ?? {}),
        durationMs,
        tenancy.entityId,
        asString(body.createdByEmail, userEmail(req)),
        JSON.stringify(result),
      ],
    );
    res.status(201).json(row ? backtestToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/backtests/:runId/result', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const row = await queryOne<Record<string, unknown>>(
      `SELECT result FROM backtesting_runs
       WHERE id = $1 AND entity_id = $2
       LIMIT 1`,
      [req.params.runId, tenancy.entityId],
    );
    if (!row) {
      res.status(404).json({ code: 'not_found' });
      return;
    }
    res.json(asJsonObject(row.result).runId ? asJsonObject(row.result) : emptyBacktestResult(req.params.runId));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

router.get('/benchmarks', async (req, res) => {
  try {
    const products = listParam(req.query.products);
    const currencies = listParam(req.query.currencies);
    const filters: string[] = [];
    const params: unknown[] = [];
    addAnyFilter(filters, params, 'product_type', products);
    addAnyFilter(filters, params, 'currency', currencies);
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM market_benchmarks ${where}
       ORDER BY as_of_date DESC, product_type ASC
       LIMIT 500`,
      params,
    );
    res.json(rows.map(benchmarkToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/benchmarks', async (req, res) => {
  try {
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const productType = asString(body.productType);
    const tenorBucket = asString(body.tenorBucket);
    const clientType = asString(body.clientType);
    const currency = asString(body.currency);
    const source = asString(body.source);
    const rate = asNumber(body.rate, Number.NaN);
    if (!productType || !tenorBucket || !clientType || !currency || !source || !Number.isFinite(rate)) {
      res.status(400).json({ code: 'invalid_payload' });
      return;
    }
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO market_benchmarks
         (id, product_type, tenor_bucket, client_type, currency, rate, source, as_of_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (product_type, tenor_bucket, client_type, currency, as_of_date)
       DO UPDATE SET rate = EXCLUDED.rate, source = EXCLUDED.source, notes = EXCLUDED.notes
       RETURNING *`,
      [
        asString(body.id, randomUUID()),
        productType,
        tenorBucket,
        clientType,
        currency,
        rate,
        source,
        asString(body.asOfDate, new Date().toISOString().slice(0, 10)),
        body.notes ?? null,
      ],
    );
    res.status(201).json(row ? benchmarkToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/benchmarks/compare', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const snapshotId = asString(req.query.snapshot_id);
    if (!snapshotId) {
      res.status(400).json({ code: 'invalid_params', message: 'snapshot_id required' });
      return;
    }
    const cells = await query<Record<string, unknown>>(
      `SELECT * FROM target_grid_cells
       WHERE snapshot_id = $1 AND entity_id = $2
       ORDER BY product, segment, tenor_bucket, currency`,
      [snapshotId, tenancy.entityId],
    );
    const benchmarks = await query<Record<string, unknown>>(
      `SELECT * FROM market_benchmarks
       ORDER BY as_of_date DESC`,
    );
    const comparisons = cells.flatMap((cell) => {
      const targetTenor = TENOR_TO_BENCHMARK[String(cell.tenor_bucket ?? '')] ?? 'MT';
      const match = benchmarks.find((benchmark) => (
        String(benchmark.product_type) === String(cell.product) &&
        String(benchmark.tenor_bucket) === targetTenor &&
        String(benchmark.client_type) === String(cell.segment) &&
        String(benchmark.currency) === String(cell.currency)
      ));
      if (!match) return [];
      const targetRate = asNumber(cell.target_client_rate);
      const benchmarkRate = asNumber(match.rate);
      return [{
        product: String(cell.product),
        segment: String(cell.segment),
        tenorBucket: String(cell.tenor_bucket),
        currency: String(cell.currency),
        targetRate,
        benchmarkRate,
        deltaBps: (targetRate - benchmarkRate) * 100,
        source: String(match.source ?? ''),
        asOfDate: dateOnly(match.as_of_date),
      }];
    });
    res.json(comparisons);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

// ---------------------------------------------------------------------------
// Budget targets
// ---------------------------------------------------------------------------

router.get('/budget', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM budget_targets
       WHERE entity_id = $1
       ORDER BY period DESC, product, segment, currency
       LIMIT 500`,
      [tenancy.entityId],
    );
    res.json(rows.map(budgetToDto));
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.post('/budget', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    if (!requireMethodologyAuthor(req, res)) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const product = asString(body.product);
    const segment = asString(body.segment);
    const currency = asString(body.currency);
    const period = asString(body.period);
    if (!product || !segment || !currency || !period) {
      res.status(400).json({ code: 'invalid_payload' });
      return;
    }
    const row = await withTransaction(async (tx) => {
      const updated = await tx.queryOne<Record<string, unknown>>(
        `UPDATE budget_targets
         SET target_nii = $1, target_volume = $2, target_raroc = $3, updated_at = now()
         WHERE product = $4 AND segment = $5 AND currency = $6 AND entity_id = $7 AND period = $8
         RETURNING *`,
        [
          asNumber(body.targetNii),
          asNumber(body.targetVolume),
          asNumber(body.targetRaroc),
          product,
          segment,
          currency,
          tenancy.entityId,
          period,
        ],
      );
      if (updated) return updated;
      return tx.queryOne<Record<string, unknown>>(
        `INSERT INTO budget_targets
           (id, product, segment, currency, entity_id, period,
            target_nii, target_volume, target_raroc)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          asString(body.id, randomUUID()),
          product,
          segment,
          currency,
          tenancy.entityId,
          period,
          asNumber(body.targetNii),
          asNumber(body.targetVolume),
          asNumber(body.targetRaroc),
        ],
      );
    });
    res.status(201).json(row ? budgetToDto(row) : null);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

router.get('/budget/consistency', async (req, res) => {
  try {
    const tenancy = tenant(req, res);
    if (!tenancy) return;
    const snapshotId = asString(req.query.snapshot_id);
    if (!snapshotId) {
      res.status(400).json({ code: 'invalid_params', message: 'snapshot_id required' });
      return;
    }
    const [budgets, cells] = await Promise.all([
      query<Record<string, unknown>>(
        `SELECT * FROM budget_targets WHERE entity_id = $1 ORDER BY product, segment, currency`,
        [tenancy.entityId],
      ),
      query<Record<string, unknown>>(
        `SELECT * FROM target_grid_cells WHERE snapshot_id = $1 AND entity_id = $2`,
        [snapshotId, tenancy.entityId],
      ),
    ]);
    const comparisons = budgets.map((budget) => {
      const match = cells.find((cell) => (
        String(cell.product) === String(budget.product) &&
        String(cell.segment) === String(budget.segment) &&
        String(cell.currency) === String(budget.currency)
      ));
      const budgetNii = asNumber(budget.target_nii);
      const budgetVolume = asNumber(budget.target_volume);
      const gridRate = match ? asNumber(match.target_client_rate) : 0;
      const gridImpliedNii = budgetVolume * (gridRate / 100);
      const niiGap = gridImpliedNii - budgetNii;
      return {
        product: String(budget.product),
        segment: String(budget.segment),
        currency: String(budget.currency),
        budgetNii,
        gridImpliedNii,
        niiGap,
        niiGapPct: budgetNii === 0 ? 0 : (niiGap / budgetNii) * 100,
        budgetVolume,
        gridImpliedVolume: budgetVolume,
        volumeGap: 0,
        volumeGapPct: 0,
      };
    });
    res.json(comparisons);
  } catch (err) {
    res.status(500).json({ error: safeError(err) });
  }
});

export default router;
