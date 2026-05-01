/**
 * EBA GL 2018/02 Annex III shock presets — Ola 6 Bloque B.2.
 *
 * Computes per-tenor bps shifts for the 6 regulatory interest-rate scenarios
 * that Treasury / pricing uses for **stress pricing** (price-testing).
 *
 * IMPORTANT: These presets feed the pricing motor as curve-shift inputs,
 * NOT as inputs to a ΔEVE / SOT IRRBB engine. Units are bps. Direction
 * follows EBA convention (up = +bps, down = -bps; floored only where
 * documented — we do not apply the post-floor curve here, the motor does).
 *
 * Reference: EBA/GL/2018/02 Annex III §§ 113-115. Shock magnitudes for
 * EUR per Table 1 (parallel ±200, short ±250). Steepener/flattener use
 * the closed-form weightings of §115:
 *
 *   S_short(t) = α_s × exp(-t / 4)
 *   S_long(t)  = α_l × (1 - exp(-t / 4))
 *   Steepener  = -0.65 × S_short + 0.90 × S_long
 *   Flattener  = +0.80 × S_short - 0.60 × S_long
 *
 * where t is tenor in years, α_s = short-shock magnitude, α_l = long-shock
 * magnitude (= 60% of parallel shock per EBA). We keep the formula in code
 * so reviewers can see the calibration, rather than hard-coding numeric
 * arrays that obscure where they came from.
 */

import type {
  ShockScenario,
  ShockScenarioId,
  ShockTenor,
} from '../../types/pricingShocks';

// EBA Table 1 (EUR, 2018) — magnitudes in bps.
const PARALLEL_MAGNITUDE_BPS = 200;
const SHORT_SHOCK_MAGNITUDE_BPS = 250;

// EBA §115 weightings for the slope scenarios.
const STEEPENER_SHORT_WEIGHT = -0.65;
const STEEPENER_LONG_WEIGHT = 0.90;
const FLATTENER_SHORT_WEIGHT = 0.80;
const FLATTENER_LONG_WEIGHT = -0.60;

// Ordered tenors we ship shifts for. Keep monotonic in tenor-years so the
// motor can interpolate between adjacent entries if the deal's repricing
// tenor falls between two buckets.
const TENORS: ReadonlyArray<{ tenor: ShockTenor; years: number }> = [
  { tenor: '1M',  years: 1 / 12 },
  { tenor: '3M',  years: 0.25   },
  { tenor: '6M',  years: 0.5    },
  { tenor: '1Y',  years: 1      },
  { tenor: '2Y',  years: 2      },
  { tenor: '5Y',  years: 5      },
  { tenor: '10Y', years: 10     },
  { tenor: '20Y', years: 20     },
];

const DECAY_CONSTANT_YEARS = 4;

/** EBA short-rate scaling factor: exp(-t / 4). */
export function ebaShortScaling(tenorYears: number): number {
  return Math.exp(-tenorYears / DECAY_CONSTANT_YEARS);
}

/** EBA long-rate scaling factor: 1 - exp(-t / 4). */
export function ebaLongScaling(tenorYears: number): number {
  return 1 - Math.exp(-tenorYears / DECAY_CONSTANT_YEARS);
}

type CurveShifts = Partial<Record<ShockTenor, number>>;

function buildCurve(fn: (tenorYears: number) => number): CurveShifts {
  const out: CurveShifts = {};
  for (const { tenor, years } of TENORS) {
    out[tenor] = Math.round(fn(years));
  }
  return out;
}

/**
 * Computes the per-tenor bps shift for a named EBA scenario. Exported so
 * the adapter layer can reuse the same math against a customer-provided
 * shock magnitude (if a bank wants to stress at ±300 instead of ±200).
 */
export function computeEbaCurveShift(id: ShockScenarioId, params?: {
  parallelBps?: number;
  shortBps?: number;
  longBps?: number;
}): CurveShifts {
  const parallel = params?.parallelBps ?? PARALLEL_MAGNITUDE_BPS;
  const shortAmp = params?.shortBps    ?? SHORT_SHOCK_MAGNITUDE_BPS;
  const longAmp  = params?.longBps     ?? Math.round(0.6 * parallel);

  switch (id) {
    case 'parallel_up_200':
      return buildCurve(() => +parallel);
    case 'parallel_down_200':
      return buildCurve(() => -parallel);
    case 'short_up_250':
      return buildCurve((t) => +shortAmp * ebaShortScaling(t));
    case 'short_down_250':
      return buildCurve((t) => -shortAmp * ebaShortScaling(t));
    case 'steepener':
      return buildCurve((t) =>
        STEEPENER_SHORT_WEIGHT * shortAmp * ebaShortScaling(t) +
        STEEPENER_LONG_WEIGHT  * longAmp  * ebaLongScaling(t),
      );
    case 'flattener':
      return buildCurve((t) =>
        FLATTENER_SHORT_WEIGHT * shortAmp * ebaShortScaling(t) +
        FLATTENER_LONG_WEIGHT  * longAmp  * ebaLongScaling(t),
      );
    case 'base':
    case 'custom':
      return {};
  }
}

/**
 * Representative-rate helper for the legacy `interestRate` field (the motor
 * currently uses this single value when `curveShiftBps` is not honoured).
 * Uses the 2Y point, a reasonable midpoint for retail/corporate pricing.
 */
function representativeRateFromCurve(shifts: CurveShifts): number {
  return shifts['2Y'] ?? shifts['1Y'] ?? shifts['5Y'] ?? 0;
}

/** Ready-to-use catalogue of the 6 EBA presets + base. */
export const EBA_SHOCK_PRESETS: Record<Exclude<ShockScenarioId, 'custom'>, ShockScenario> = {
  base: {
    id: 'base',
    label: 'Base',
    curveShiftBps: null,
    interestRate: 0,
    liquiditySpread: 0,
    source: 'preset_eba_2018_02',
  },
  parallel_up_200: {
    id: 'parallel_up_200',
    label: 'Parallel +200 bp',
    curveShiftBps: computeEbaCurveShift('parallel_up_200'),
    interestRate: +PARALLEL_MAGNITUDE_BPS,
    liquiditySpread: 0,
    source: 'preset_eba_2018_02',
  },
  parallel_down_200: {
    id: 'parallel_down_200',
    label: 'Parallel -200 bp',
    curveShiftBps: computeEbaCurveShift('parallel_down_200'),
    interestRate: -PARALLEL_MAGNITUDE_BPS,
    liquiditySpread: 0,
    source: 'preset_eba_2018_02',
  },
  short_up_250: {
    id: 'short_up_250',
    label: 'Short +250 bp',
    curveShiftBps: computeEbaCurveShift('short_up_250'),
    interestRate: representativeRateFromCurve(computeEbaCurveShift('short_up_250')),
    liquiditySpread: 0,
    source: 'preset_eba_2018_02',
  },
  short_down_250: {
    id: 'short_down_250',
    label: 'Short -250 bp',
    curveShiftBps: computeEbaCurveShift('short_down_250'),
    interestRate: representativeRateFromCurve(computeEbaCurveShift('short_down_250')),
    liquiditySpread: 0,
    source: 'preset_eba_2018_02',
  },
  steepener: {
    id: 'steepener',
    label: 'Steepener',
    curveShiftBps: computeEbaCurveShift('steepener'),
    interestRate: representativeRateFromCurve(computeEbaCurveShift('steepener')),
    liquiditySpread: 0,
    source: 'preset_eba_2018_02',
  },
  flattener: {
    id: 'flattener',
    label: 'Flattener',
    curveShiftBps: computeEbaCurveShift('flattener'),
    interestRate: representativeRateFromCurve(computeEbaCurveShift('flattener')),
    liquiditySpread: 0,
    source: 'preset_eba_2018_02',
  },
};

/** Iteration helper — returns the 6 non-base presets in their stress grid order. */
export const EBA_STRESS_PRESETS: ShockScenario[] = [
  EBA_SHOCK_PRESETS.parallel_up_200,
  EBA_SHOCK_PRESETS.parallel_down_200,
  EBA_SHOCK_PRESETS.short_up_250,
  EBA_SHOCK_PRESETS.short_down_250,
  EBA_SHOCK_PRESETS.steepener,
  EBA_SHOCK_PRESETS.flattener,
];

// Months-to-tenor mapping used for interpolating per-tenor shifts at a
// deal's effective repricing horizon. Kept local (not imported from
// pricingConstants.TENOR_MONTHS) because this subset is the contract the
// EBA presets ship — extending the shock grid to extra tenors is a
// roadmap decision, not an incidental lookup.
const TENOR_MONTHS: Record<ShockTenor, number> = {
  '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '2Y': 24, '5Y': 60, '10Y': 120, '20Y': 240,
};

/**
 * Interpolate a per-tenor shock (bps) at an arbitrary month count.
 *
 * Used by the motor when it needs the shift at the deal's effective
 * repricing tenor (`RM` months) rather than at one of the 8 preset buckets.
 * Returns 0 when the shifts dict is empty (base / custom scenarios) so the
 * caller can always apply the result without null-checks.
 *
 * Linear interpolation between adjacent buckets; flat extrapolation
 * outside the min/max tenor (shorter than 1M uses the 1M shift, longer
 * than 20Y uses the 20Y shift) — consistent with how `interpolateYieldCurve`
 * handles out-of-range queries.
 */
export function interpolateShockShiftBps(
  shifts: Partial<Record<ShockTenor, number>>,
  targetMonths: number,
): number {
  const ordered = (Object.keys(shifts) as ShockTenor[])
    .filter((t) => shifts[t] !== undefined)
    .map((t) => ({ months: TENOR_MONTHS[t], bps: shifts[t] as number }))
    .sort((a, b) => a.months - b.months);
  if (ordered.length === 0) return 0;
  if (targetMonths <= ordered[0].months) return ordered[0].bps;
  const last = ordered[ordered.length - 1];
  if (targetMonths >= last.months) return last.bps;
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1];
    const b = ordered[i];
    if (targetMonths <= b.months) {
      const t = (targetMonths - a.months) / (b.months - a.months);
      return a.bps + t * (b.bps - a.bps);
    }
  }
  return last.bps;
}
