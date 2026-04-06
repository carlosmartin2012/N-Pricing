import type { YieldCurvePoint } from '../../types';
import { TENOR_MONTHS } from '../pricingConstants';

// ─── Curve Interpolation ────────────────────────────────────────────────────

/** Linear interpolation on a yield curve (tenor string → rate) */
export function interpolateYieldCurve(curve: YieldCurvePoint[], targetMonths: number): number {
  if (!curve || curve.length === 0) return 0;
  const points = curve
    .map(p => ({ months: TENOR_MONTHS[p.tenor] ?? 0, rate: p.rate }))
    .sort((a, b) => a.months - b.months);

  if (targetMonths <= points[0].months) return points[0].rate;
  if (targetMonths >= points[points.length - 1].months) return points[points.length - 1].rate;

  const upperIdx = points.findIndex(p => p.months >= targetMonths);
  if (upperIdx <= 0) return points[0].rate;

  const lower = points[upperIdx - 1];
  const upper = points[upperIdx];
  const denom = upper.months - lower.months;
  if (denom === 0) return upper.rate;
  const ratio = (targetMonths - lower.months) / denom;
  return lower.rate + ratio * (upper.rate - lower.rate);
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
  if (zeros.length === 0) return 0;
  if (targetMonths <= zeros[0].months) return zeros[0].rate;
  if (targetMonths >= zeros[zeros.length - 1].months) return zeros[zeros.length - 1].rate;

  const upperIdx = zeros.findIndex(z => z.months >= targetMonths);
  if (upperIdx <= 0) return zeros[0].rate;

  const lower = zeros[upperIdx - 1];
  const upper = zeros[upperIdx];
  const denom = upper.months - lower.months;
  if (denom === 0) return upper.rate;
  const ratio = (targetMonths - lower.months) / denom;
  return lower.rate + ratio * (upper.rate - lower.rate);
}
