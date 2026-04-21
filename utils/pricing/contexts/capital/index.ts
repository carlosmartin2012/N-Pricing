/**
 * Capital bounded context — public surface (Ola C-3).
 *
 * Groups Basel III / CRR3 capital calculation primitives:
 *   - Output floor schedule (phase-in 50% → 72.5%)
 *   - Capital buffers (CCB + CCyB + G-SII + D-SII + Systemic Risk)
 *   - Standardised vs IRB RWA with output floor binding logic
 *
 * Strategy: re-export from the existing `capitalEngineCRR3.ts` until the
 * flat file is physically moved here. See contexts/README.md for the
 * sequence — market (C-2) and governance (C-1) already use this barrel
 * pattern so the migration is consistent.
 *
 * Consumers: pricingEngine (orchestrator), capital-related UI panels,
 * regulatory reporting.
 */

export {
  CRR3_OUTPUT_FLOOR_SCHEDULE,
  getOutputFloorFactor,
  CAPITAL_BUFFERS_DEFAULT,
  calculateCapitalWithOutputFloor,
  calculateBufferedCapitalCharge,
} from '../../capitalEngineCRR3';

export type {
  CapitalBufferConfig,
  CapitalCalculationInput,
  CapitalCalculationResult,
} from '../../capitalEngineCRR3';
