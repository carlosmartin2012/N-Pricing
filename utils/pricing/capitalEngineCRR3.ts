/**
 * CRR3 Capital Engine — Output Floor & Basel III Buffer Stack
 *
 * Implements:
 *  - CRR3 output floor phase-in (EU timeline 2025 → 2030)
 *  - Basel III / CRD V buffer stack (P1, P2R, CCB, CCyB, SyB, G-SII, O-SII, management)
 *  - Effective RWA calculation for IRB banks (max of IRB vs floor × SA)
 *  - Capital charge per unit of EAD given target ROE and risk-free rate
 *
 * Regulatory basis:
 *  - CRR3 Art. 92(3) — output floor
 *  - CRD V Art. 128–131 — combined buffer requirement
 *  - CRR Art. 131(14) — SIFI buffer interaction (max of G-SII, O-SII, SyB)
 *  - EBA GL 2018/02 — SREP / Pillar 2 guidance
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** CRR3 output floor phase-in (EU timeline) */
export const CRR3_OUTPUT_FLOOR_SCHEDULE: Record<number, number> = {
  2025: 0.500,
  2026: 0.550,
  2027: 0.600,
  2028: 0.650,
  2029: 0.700,
  2030: 0.725, // steady state
};

/** Get the applicable output floor factor for a given year */
export function getOutputFloorFactor(year: number): number {
  if (year < 2025) return 0;
  if (year >= 2030) return CRR3_OUTPUT_FLOOR_SCHEDULE[2030];
  return CRR3_OUTPUT_FLOOR_SCHEDULE[year] ?? CRR3_OUTPUT_FLOOR_SCHEDULE[2030];
}

/** Basel III / CRR3 capital buffer defaults (% RWA) */
export const CAPITAL_BUFFERS_DEFAULT = {
  pillar1: 8.0,                // P1 minimum
  pillar2Requirement: 2.0,     // P2R (SREP)
  conservationBuffer: 2.5,     // CCB
  countercyclicalBuffer: 1.0,  // CCyB — dynamic per jurisdiction (BdE 1% Spain 2026)
  systemicRiskBuffer: 0.0,     // SyB
  gSIIBuffer: 0.0,             // G-SII surcharge (1-2.5% for G-SIIs)
  oSIIBuffer: 0.0,             // O-SII surcharge (0-2%)
  managementBuffer: 1.5,       // Internal management cushion
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CapitalBufferConfig {
  pillar1: number;
  pillar2Requirement: number;
  conservationBuffer: number;
  countercyclicalBuffer: number;
  systemicRiskBuffer: number;
  gSIIBuffer: number;
  oSIIBuffer: number;
  managementBuffer: number;
}

export interface CapitalCalculationInput {
  ead: number;
  rwaStandardized: number;  // SA RWA
  rwaIrb?: number;          // IRB RWA (if bank is IRB-authorized)
  year: number;             // Calculation year for output floor phase-in
  buffers?: Partial<CapitalBufferConfig>;
  isGSII?: boolean;
  isOSII?: boolean;
}

export interface CapitalCalculationResult {
  effectiveRwa: number;         // Max(IRB, outputFloor × SA)
  outputFloorBinding: boolean;  // True if output floor binds
  outputFloorFactor: number;    // Current phase-in %
  totalCapitalRatio: number;    // Total % RWA required
  totalCapitalRequired: number; // Absolute amount €
  buffersBreakdown: {
    pillar1: number;
    pillar2Requirement: number;
    conservationBuffer: number;
    countercyclicalBuffer: number;
    systemicRiskBuffer: number;
    sifiBuffer: number;  // max(G-SII, O-SII) per CRR
    managementBuffer: number;
  };
}

// ── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculate effective RWA applying CRR3 output floor and return full buffer stack.
 *
 * Output floor: for banks using IRB, the floor is max(RWA_IRB, factor × RWA_SA)
 * where factor phases in 50% (2025) → 72.5% (2030).
 *
 * Buffer stack (CRD V / CRR3):
 *   Total = P1(8%) + P2R + CCB(2.5%) + CCyB + max(SyB, G-SII, O-SII) + management
 */
export function calculateCapitalWithOutputFloor(
  input: CapitalCalculationInput,
): CapitalCalculationResult {
  const buffers = { ...CAPITAL_BUFFERS_DEFAULT, ...input.buffers };
  const floorFactor = getOutputFloorFactor(input.year);

  // Effective RWA: if IRB provided, apply output floor
  let effectiveRwa = input.rwaStandardized;
  let outputFloorBinding = false;

  if (input.rwaIrb != null && input.rwaIrb > 0 && floorFactor > 0) {
    const flooredRwa = floorFactor * input.rwaStandardized;
    if (flooredRwa > input.rwaIrb) {
      effectiveRwa = flooredRwa;
      outputFloorBinding = true;
    } else {
      effectiveRwa = input.rwaIrb;
      outputFloorBinding = false;
    }
  }

  // SIFI buffer: max of G-SII and O-SII and SyB (per CRR Art 131(14))
  const sifiBuffer = Math.max(
    buffers.systemicRiskBuffer,
    buffers.gSIIBuffer,
    buffers.oSIIBuffer,
  );

  const totalCapitalRatio =
    buffers.pillar1 +
    buffers.pillar2Requirement +
    buffers.conservationBuffer +
    buffers.countercyclicalBuffer +
    sifiBuffer +
    buffers.managementBuffer;

  const totalCapitalRequired = effectiveRwa * (totalCapitalRatio / 100);

  return {
    effectiveRwa,
    outputFloorBinding,
    outputFloorFactor: floorFactor,
    totalCapitalRatio,
    totalCapitalRequired,
    buffersBreakdown: {
      pillar1: buffers.pillar1,
      pillar2Requirement: buffers.pillar2Requirement,
      conservationBuffer: buffers.conservationBuffer,
      countercyclicalBuffer: buffers.countercyclicalBuffer,
      systemicRiskBuffer: buffers.systemicRiskBuffer,
      sifiBuffer,
      managementBuffer: buffers.managementBuffer,
    },
  };
}

/**
 * Convert total capital requirement to an annualized charge (% of EAD)
 * given a target ROE and risk-free rate.
 *
 * capitalCharge = (capitalRequired / EAD) × (targetROE - riskFreeRate)
 */
export function calculateBufferedCapitalCharge(
  capital: CapitalCalculationResult,
  ead: number,
  targetROE: number,
  riskFreeRate: number,
): number {
  if (ead <= 0) return 0;
  const allocatedCapitalPerUnit = capital.totalCapitalRequired / ead;
  return allocatedCapitalPerUnit * Math.max(0, targetROE - riskFreeRate);
}
