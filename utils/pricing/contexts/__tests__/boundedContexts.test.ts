import { describe, it, expect } from 'vitest';
import * as pricing from '../..';

/**
 * Smoke tests for the bounded-context barrels (Ola C-1 to C-6).
 *
 * Goal: catch regressions where a refactor accidentally breaks the public
 * surface of a context (renames an export, moves a symbol, drops a type).
 * This is cheap to run and fails loudly when any `contexts/<name>/index.ts`
 * stops compiling or stops exposing a key symbol.
 */

describe('utils/pricing root barrel exposes bounded contexts', () => {
  it('exposes the 7 bounded contexts as namespace exports', () => {
    expect(pricing.market).toBeDefined();
    expect(pricing.governance).toBeDefined();
    expect(pricing.capital).toBeDefined();
    expect(pricing.liquidity).toBeDefined();
    expect(pricing.credit).toBeDefined();
    expect(pricing.analytics).toBeDefined();
    expect(pricing.core).toBeDefined();
  });
});

describe('governance context', () => {
  it('exports resolveApprovalLevel + bands + mode', () => {
    expect(typeof pricing.governance.resolveApprovalLevel).toBe('function');
    expect(typeof pricing.governance.computeEvaBp).toBe('function');
    expect(typeof pricing.governance.getGovernanceMode).toBe('function');
    expect(pricing.governance.DEFAULT_EVA_BANDS).toBeDefined();
  });

  it('resolveApprovalLevel returns a valid ApprovalLevel', () => {
    const matrix = {
      autoApprovalThreshold: 15,
      l1Threshold: 10,
      l2Threshold: 5,
      autoApprovalEvaBp: 200,
      l1EvaBp: 0,
      l2EvaBp: -100,
    };
    const level = pricing.governance.resolveApprovalLevel(20, 10, matrix, 'EVA');
    expect(['Auto', 'L1_Manager', 'L2_Committee', 'Rejected']).toContain(level);
  });
});

describe('market context', () => {
  it('exports curve + interpolation + NSS helpers', () => {
    expect(typeof pricing.market.interpolateYieldCurve).toBe('function');
    expect(typeof pricing.market.linearInterpolate).toBe('function');
    expect(typeof pricing.market.nssYield).toBe('function');
  });
});

describe('capital context', () => {
  it('exports output floor schedule + factor + buffered calc', () => {
    expect(pricing.capital.CRR3_OUTPUT_FLOOR_SCHEDULE).toBeDefined();
    expect(typeof pricing.capital.getOutputFloorFactor).toBe('function');
    expect(typeof pricing.capital.calculateBufferedCapitalCharge).toBe('function');
  });
});

describe('liquidity context', () => {
  it('exports LCR + NSFR + SDR + deposit classification', () => {
    expect(typeof pricing.liquidity.calculateLCRCharge).toBe('function');
    expect(typeof pricing.liquidity.calculateNSFRCharge).toBe('function');
    expect(typeof pricing.liquidity.applySDRModulation).toBe('function');
    expect(typeof pricing.liquidity.classifyDepositStability).toBe('function');
  });
});

describe('credit context', () => {
  it('exports Anejo + IFRS9 + delegation primitives', () => {
    expect(typeof pricing.credit.classifyAnejoSegment).toBe('function');
    expect(typeof pricing.credit.calculateAnejoCreditRisk).toBe('function');
    expect(typeof pricing.credit.detectSICR).toBe('function');
    expect(typeof pricing.credit.resolveDelegation).toBe('function');
    expect(pricing.credit.DEFAULT_DELEGATION_MATRIX).toBeDefined();
  });
});

describe('analytics context', () => {
  it('exports expostRaroc + rarocRealization + elasticity', () => {
    expect(typeof pricing.analytics.compareExpectedVsRealized).toBe('function');
    expect(typeof pricing.analytics.computeMapeRaroc).toBe('function');
    expect(typeof pricing.analytics.fitElasticityModel).toBe('function');
    expect(pricing.analytics.DEFAULT_EXPERT_PRIOR).toBeDefined();
  });
});

describe('core context', () => {
  it('exposes the orchestrator + formula + bitemporal + model inventory', () => {
    expect(typeof pricing.core.calculatePricing).toBe('function');
    expect(typeof pricing.core.batchReprice).toBe('function');
    expect(typeof pricing.core.resolveEffectiveTenors).toBe('function');
    expect(pricing.core.DEFAULT_PRICING_SHOCKS).toBeDefined();
    expect(typeof pricing.core.inferFormulaFromProduct).toBe('function');
    expect(pricing.core.bitemporal).toBeDefined();
    expect(pricing.core.modelInventory).toBeDefined();
  });
});
