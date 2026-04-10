import type { YieldCurvePoint } from '../../types';
import { TENOR_MONTHS } from '../pricingConstants';
import { linearInterpolate, prepareYieldCurvePoints } from './interpolation';

// ─── Curve Interpolation ────────────────────────────────────────────────────

const curveCache = new WeakMap<YieldCurvePoint[], { x: number; y: number }[]>();

/** Linear interpolation on a yield curve (tenor string → rate) */
export function interpolateYieldCurve(curve: YieldCurvePoint[], targetMonths: number): number {
  if (!curve || curve.length === 0) return 0;
  let points = curveCache.get(curve);
  if (!points) {
    points = prepareYieldCurvePoints(curve, TENOR_MONTHS);
    curveCache.set(curve, points);
  }
  return linearInterpolate(points, targetMonths);
}

// ─── Zero Coupon Bootstrap (Gap 7) ──────────────────────────────────────────

/**
 * Bootstrap zero-coupon rates from a par yield curve.
 * Short-term (<12M): zero ≈ par (simple interest)
 * Long-term: iterative bootstrap with semi-annual compounding
 */
export function bootstrapZeroRates(parCurve: YieldCurvePoint[]): YieldCurvePoint[] {
  const sorted = [...parCurve]
    .map(p => ({ tenor: p.tenor, months: TENOR_MONTHS[p.tenor] ?? 0, rate: p.rate }))
    .sort((a, b) => a.months - b.months);

  const zeroRates: { tenor: string; months: number; rate: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const { tenor, months, rate } = sorted[i];
    if (months <= 12) {
      // Short-term: zero ≈ par
      zeroRates.push({ tenor, months, rate });
    } else {
      // Bootstrap: solve for zero rate
      const periods = Math.round(months / 6); // semi-annual periods
      const coupon = rate / 2; // semi-annual coupon as % of par
      let pvCoupons = 0;

      for (let j = 1; j < periods; j++) {
        const tMonths = j * 6;
        // Interpolate known zero rates for this coupon period
        const zr = interpolateFromZeros(zeroRates, tMonths);
        const df = 1 / Math.pow(1 + zr / 200, j); // semi-annual discount
        pvCoupons += coupon * df;
      }

      // Par = sum(coupon × df) + (100 + coupon) × df_final => df_final
      const dfFinal = (100 - pvCoupons) / (100 + coupon);
      // Convert discount factor back to zero rate (semi-annual)
      const zeroRate = dfFinal > 0
        ? (Math.pow(1 / dfFinal, 1 / periods) - 1) * 200
        : rate;

      zeroRates.push({ tenor, months, rate: zeroRate });
    }
  }

  return zeroRates.map(z => ({ tenor: z.tenor, rate: z.rate }));
}

export function interpolateFromZeros(zeros: { months: number; rate: number }[], targetMonths: number): number {
  const points = zeros.map(z => ({ x: z.months, y: z.rate }));
  return linearInterpolate(points, targetMonths);
}
