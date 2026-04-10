/**
 * Nelson-Siegel-Svensson yield curve model.
 *
 * Standard curve fitting used by ECB, BdE, Bundesbank, BIS for
 * smoothed zero-coupon and par yield curves. Produces economically
 * sensible interpolations and extrapolations.
 *
 * References:
 * - Nelson & Siegel (1987), "Parsimonious Modeling of Yield Curves"
 * - Svensson (1994), "Estimating and Interpreting Forward Interest Rates"
 * - ECB methodology document on yield curve estimation
 */

export interface NSSParameters {
  beta0: number; // Long-run rate (asymptotic level)
  beta1: number; // Short-rate component
  beta2: number; // Medium-term hump
  beta3: number; // Second hump (Svensson extension)
  tau1: number; // First decay (typically 1-3 years)
  tau2: number; // Second decay (typically 5-10 years)
}

/**
 * Evaluate the NSS yield function at a given maturity (in years).
 * Handles t → 0 limit correctly.
 */
export function nssYield(params: NSSParameters, t: number): number {
  const { beta0, beta1, beta2, beta3, tau1, tau2 } = params;

  // Handle t = 0 limit
  if (t <= 0) return beta0 + beta1;

  const x1 = t / tau1;
  const x2 = t / tau2;

  // Avoid overflow for very large t
  const exp1 = Math.exp(-x1);
  const exp2 = Math.exp(-x2);

  // (1 - e^-x) / x is bounded; compute carefully
  const f1 = x1 > 1e-8 ? (1 - exp1) / x1 : 1; // limit as x→0 is 1
  const f2 = x1 > 1e-8 ? (1 - exp1) / x1 - exp1 : 0;
  const f3 = x2 > 1e-8 ? (1 - exp2) / x2 - exp2 : 0;

  return beta0 + beta1 * f1 + beta2 * f2 + beta3 * f3;
}

/**
 * Compute the instantaneous forward rate at maturity t.
 * f(t) = β₀ + β₁ exp(-t/τ₁) + β₂ × (t/τ₁) × exp(-t/τ₁) + β₃ × (t/τ₂) × exp(-t/τ₂)
 */
export function nssForwardRate(params: NSSParameters, t: number): number {
  const { beta0, beta1, beta2, beta3, tau1, tau2 } = params;
  if (t < 0) return beta0 + beta1;

  const x1 = t / tau1;
  const x2 = t / tau2;

  return (
    beta0 +
    beta1 * Math.exp(-x1) +
    beta2 * x1 * Math.exp(-x1) +
    beta3 * x2 * Math.exp(-x2)
  );
}

/**
 * Fit NSS parameters to observed (maturity, rate) points using a
 * simplified linear least-squares approach with fixed τ₁, τ₂.
 *
 * This is the ECB methodology: fix τ₁ and τ₂ based on typical term structure
 * characteristics (τ₁ ≈ 1-3Y, τ₂ ≈ 5-8Y), then solve the linear system for
 * β₀, β₁, β₂, β₃.
 *
 * For pricing context where we need daily refits, this is fast enough
 * and stable.
 */
export interface NSSObservation {
  /** Maturity in years */
  t: number;
  /** Observed rate (% or decimal — be consistent) */
  rate: number;
}

export interface NSSFitResult {
  params: NSSParameters;
  rmse: number;
  converged: boolean;
  iterations: number;
}

/**
 * Linear least-squares fit with fixed tau1, tau2.
 * Solves the normal equations for [β₀, β₁, β₂, β₃]ᵀ.
 */
export function fitNSSLinear(
  observations: NSSObservation[],
  tau1: number = 2.0,
  tau2: number = 5.0,
): NSSFitResult {
  if (observations.length < 4) {
    // Degenerate: flat curve at average rate
    const avg =
      observations.reduce((s, o) => s + o.rate, 0) /
      Math.max(1, observations.length);
    return {
      params: { beta0: avg, beta1: 0, beta2: 0, beta3: 0, tau1, tau2 },
      rmse: 0,
      converged: true,
      iterations: 0,
    };
  }

  // Build design matrix X (N × 4): each row = [1, f1(t), f2(t), f3(t)]
  const n = observations.length;
  const X: number[][] = [];
  const y: number[] = [];

  for (const obs of observations) {
    const t = obs.t;
    const x1 = t / tau1;
    const x2 = t / tau2;
    const exp1 = Math.exp(-x1);
    const exp2 = Math.exp(-x2);
    const f1 = x1 > 1e-8 ? (1 - exp1) / x1 : 1;
    const f2 = x1 > 1e-8 ? (1 - exp1) / x1 - exp1 : 0;
    const f3 = x2 > 1e-8 ? (1 - exp2) / x2 - exp2 : 0;
    X.push([1, f1, f2, f3]);
    y.push(obs.rate);
  }

  // Compute X^T X (4x4) and X^T y (4x1)
  const XTX: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const XTy: number[] = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 4; j++) {
      XTy[j] += X[i][j] * y[i];
      for (let k = 0; k < 4; k++) {
        XTX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  // Solve XTX × β = XTy via Gauss-Jordan elimination
  const augmented: number[][] = XTX.map((row, i) => [...row, XTy[i]]);
  for (let i = 0; i < 4; i++) {
    // Partial pivoting
    let maxRow = i;
    for (let k = i + 1; k < 4; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    if (Math.abs(augmented[i][i]) < 1e-12) {
      // Singular matrix — fall back to flat curve
      const avg = y.reduce((s, v) => s + v, 0) / n;
      return {
        params: { beta0: avg, beta1: 0, beta2: 0, beta3: 0, tau1, tau2 },
        rmse: 0,
        converged: false,
        iterations: 0,
      };
    }

    // Normalize pivot row
    const pivot = augmented[i][i];
    for (let j = 0; j <= 4; j++) {
      augmented[i][j] /= pivot;
    }

    // Eliminate other rows
    for (let k = 0; k < 4; k++) {
      if (k !== i) {
        const factor = augmented[k][i];
        for (let j = 0; j <= 4; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
  }

  const beta: number[] = augmented.map((row) => row[4]);
  const params: NSSParameters = {
    beta0: beta[0],
    beta1: beta[1],
    beta2: beta[2],
    beta3: beta[3],
    tau1,
    tau2,
  };

  // Compute RMSE
  let sse = 0;
  for (const obs of observations) {
    const predicted = nssYield(params, obs.t);
    sse += (predicted - obs.rate) ** 2;
  }
  const rmse = Math.sqrt(sse / n);

  return {
    params,
    rmse,
    converged: true,
    iterations: 1,
  };
}

/**
 * Convenience: interpolate a yield curve using NSS smoothing.
 * Fits the curve once, then evaluates at the target maturity.
 *
 * For repeated calls with the same observations, use fitNSSLinear() directly
 * and pass the params to nssYield().
 */
export function interpolateNSS(
  observations: NSSObservation[],
  targetYears: number,
  tau1?: number,
  tau2?: number,
): number {
  if (observations.length === 0) return 0;
  const fit = fitNSSLinear(observations, tau1, tau2);
  return nssYield(fit.params, targetYears);
}
