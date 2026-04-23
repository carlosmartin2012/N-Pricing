/**
 * Pricing shock types — Ola 6 Bloque B.1.
 *
 * Extends the historical `PricingShocks` `{interestRate, liquiditySpread}`
 * (both bps, uniform-curve) into a richer `ShockScenario` that carries
 * per-tenor curve shifts for the 6 EBA GL 2018/02 Annex III scenarios,
 * plus metadata for audit/snapshot tracking.
 *
 * Backward compatibility: `PricingShocks` is now a subset type; any caller
 * that only touched `interestRate` + `liquiditySpread` keeps compiling.
 * The motor change to honour `curveShiftBps` per tenor is B.4 (follow-up).
 */

/** Canonical EBA GL 2018/02 Annex III scenarios + a `custom` escape hatch. */
export type ShockScenarioId =
  | 'base'
  | 'parallel_up_200'
  | 'parallel_down_200'
  | 'short_up_250'
  | 'short_down_250'
  | 'steepener'
  | 'flattener'
  | 'custom';

/** Standard tenor buckets used for the per-tenor curve shift catalogue. */
export type ShockTenor = '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | '10Y' | '20Y';

/**
 * Full metadata for a scenario applied to pricing. When `curveShiftBps` is
 * provided, the motor must interpolate shifts per tenor; when `null`, the
 * motor falls back to `interestRate` uniform shift (legacy path).
 */
export interface ShockScenario {
  id: ShockScenarioId;
  /** Human label shown in Calculator + stress pricing grid. */
  label: string;
  /** Per-tenor shift in bps. `null` = use uniform `interestRate`. */
  curveShiftBps: Partial<Record<ShockTenor, number>> | null;
  /** Legacy uniform-rate shift in bps. Kept so existing motor path works. */
  interestRate: number;
  /** Liquidity spread shift in bps. Orthogonal to the curve shift. */
  liquiditySpread: number;
  /** Where this scenario came from. Snapshotted for audit. */
  source: 'preset_eba_2018_02' | 'market_adapter' | 'user_custom';
}

/**
 * Minimal shock shape expected by the current motor (`utils/pricingEngine.ts`
 * — `calculatePricing(deal, matrix, ctx, shocks)`). `ShockScenario` is a
 * superset, so a `ShockScenario` object satisfies `PricingShocks` directly.
 */
export type PricingShocks = Pick<ShockScenario, 'interestRate' | 'liquiditySpread'>;

/** Convenient base scenario constant (no shift). */
export const BASE_SHOCK_SCENARIO: ShockScenario = {
  id: 'base',
  label: 'Base',
  curveShiftBps: null,
  interestRate: 0,
  liquiditySpread: 0,
  source: 'preset_eba_2018_02',
};

/** Type guard: narrows a value to `ShockScenario`. */
export function isShockScenario(value: unknown): value is ShockScenario {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string'
    && typeof v.label === 'string'
    && typeof v.interestRate === 'number'
    && typeof v.liquiditySpread === 'number'
    && (v.curveShiftBps === null || typeof v.curveShiftBps === 'object')
    && typeof v.source === 'string';
}
