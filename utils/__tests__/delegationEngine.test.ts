import { describe, it, expect } from 'vitest';
import {
  resolveDelegation,
  tierToLegacyApprovalLevel,
  DEFAULT_DELEGATION_MATRIX,
  type DelegationRule,
  type DelegationInput,
} from '../pricing/delegationEngine';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const goodSmallDeal: DelegationInput = {
  amount: 150_000,
  segment: 'Retail',
  rating: 'A',
  ltvPct: 70,
  raroc: 18,
  hurdleRate: 12,
};

// ---------------------------------------------------------------------------
// Default matrix behaviour
// ---------------------------------------------------------------------------

describe('resolveDelegation — default matrix', () => {
  it('small healthy deal is auto-approved', () => {
    const result = resolveDelegation(goodSmallDeal);
    expect(result.tier).toBe('AUTO');
    expect(result.matchedRuleId).toBe('AUTO_SMALL_GOOD');
  });

  it('medium deal routes to MANAGER_L1', () => {
    const result = resolveDelegation({
      amount: 800_000,
      rating: 'BBB',
      ltvPct: 85,
      raroc: 12,
      hurdleRate: 12,
    });
    expect(result.tier).toBe('MANAGER_L1');
    expect(result.matchedRuleId).toBe('L1_MEDIUM');
  });

  it('large deal routes to MANAGER_L2', () => {
    const result = resolveDelegation({
      amount: 4_000_000,
      rating: 'BB',
      ltvPct: 92,
      raroc: 9,
      hurdleRate: 12,
    });
    expect(result.tier).toBe('MANAGER_L2');
    expect(result.matchedRuleId).toBe('L2_LARGE');
  });

  it('deal just below hurdle routes to RISK_COMMITTEE', () => {
    // amount too large for L2 tier so it falls through until discount rule
    const result = resolveDelegation({
      amount: 10_000_000,
      rating: 'BBB',
      ltvPct: 70,
      raroc: 9, // 3pp below hurdle of 12
      hurdleRate: 12,
    });
    expect(result.tier).toBe('RISK_COMMITTEE');
    expect(result.matchedRuleId).toBe('RISK_COMMITTEE_BELOW_HURDLE');
  });

  it('severe underpricing (>5pp below hurdle) falls through to EXECUTIVE_COMMITTEE', () => {
    const result = resolveDelegation({
      amount: 10_000_000,
      rating: 'BBB',
      ltvPct: 70,
      raroc: 2, // 10pp below hurdle of 12
      hurdleRate: 12,
    });
    expect(result.tier).toBe('EXECUTIVE_COMMITTEE');
    // Last rule in the matrix has empty constraints so it matches as the fallback
    expect(result.matchedRuleId).toBe('EXEC_COMMITTEE_SEVERE');
  });

  it('deal below hurdle by 3% still within 5% discount tolerance → RISK_COMMITTEE', () => {
    const result = resolveDelegation({
      amount: 8_000_000,
      rating: 'A',
      ltvPct: 75,
      raroc: 9, // 3pp below hurdle
      hurdleRate: 12,
    });
    expect(result.tier).toBe('RISK_COMMITTEE');
  });

  it('no-op severe-case matrix (drop fallback rule) falls back to EXECUTIVE_COMMITTEE', () => {
    const strippedMatrix: DelegationRule[] = DEFAULT_DELEGATION_MATRIX.filter(
      (r) => r.id !== 'EXEC_COMMITTEE_SEVERE',
    );
    const result = resolveDelegation(
      {
        amount: 50_000_000,
        rating: 'CCC',
        ltvPct: 110,
        raroc: -5,
        hurdleRate: 12,
      },
      strippedMatrix,
    );
    expect(result.tier).toBe('EXECUTIVE_COMMITTEE');
    expect(result.matchedRuleId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Constraint evaluation edge cases
// ---------------------------------------------------------------------------

describe('resolveDelegation — constraint evaluation', () => {
  it('missing LTV causes maxLtvPct constraint to fail', () => {
    const result = resolveDelegation({
      amount: 150_000,
      rating: 'A',
      raroc: 18,
      hurdleRate: 12,
      // ltvPct intentionally omitted
    });
    // Should not match AUTO_SMALL_GOOD because LTV constraint failed
    const autoEval = result.evaluatedRules.find((r) => r.ruleId === 'AUTO_SMALL_GOOD');
    expect(autoEval?.matched).toBe(false);
    expect(autoEval?.failedConstraints).toContain('maxLtvPct');
  });

  it('rating A passes a minRating:BBB constraint', () => {
    const result = resolveDelegation({
      amount: 150_000,
      rating: 'A',
      ltvPct: 70,
      raroc: 18,
      hurdleRate: 12,
    });
    expect(result.tier).toBe('AUTO');
  });

  it('rating B fails a minRating:BBB constraint', () => {
    const result = resolveDelegation({
      amount: 150_000,
      rating: 'B',
      ltvPct: 70,
      raroc: 18,
      hurdleRate: 12,
    });
    const autoEval = result.evaluatedRules.find((r) => r.ruleId === 'AUTO_SMALL_GOOD');
    expect(autoEval?.matched).toBe(false);
    expect(autoEval?.failedConstraints).toContain('minRating');
  });

  it('evaluatedRules includes all rules checked before match', () => {
    const result = resolveDelegation({
      amount: 4_000_000,
      rating: 'BB',
      ltvPct: 92,
      raroc: 9,
      hurdleRate: 12,
    });
    // Matched L2_LARGE at priority 30 so AUTO and L1 must have been evaluated first
    const ids = result.evaluatedRules.map((r) => r.ruleId);
    expect(ids).toContain('AUTO_SMALL_GOOD');
    expect(ids).toContain('L1_MEDIUM');
    expect(ids).toContain('L2_LARGE');
    // Should stop after first match — no RISK_COMMITTEE check
    expect(ids).not.toContain('RISK_COMMITTEE_BELOW_HURDLE');
  });

  it('failedConstraints lists each specific reason a rule did not match', () => {
    const result = resolveDelegation({
      amount: 500_000_000, // too large for every limited rule
      rating: 'CCC',       // too low for BBB/BB rules
      ltvPct: 120,         // above every cap
      raroc: -10,          // below every minimum
      hurdleRate: 12,
    });
    const autoEval = result.evaluatedRules.find((r) => r.ruleId === 'AUTO_SMALL_GOOD');
    expect(autoEval?.failedConstraints).toEqual(
      expect.arrayContaining(['maxAmount', 'minRating', 'maxLtvPct', 'minRaroc']),
    );
  });
});

// ---------------------------------------------------------------------------
// Custom matrix + priority ordering
// ---------------------------------------------------------------------------

describe('resolveDelegation — custom matrices', () => {
  it('custom matrix is respected (bespoke rule wins)', () => {
    const customMatrix: DelegationRule[] = [
      {
        id: 'PRIVATE_BANKING_VIP',
        priority: 1,
        label: 'Banca privada — cliente VIP',
        constraints: {
          segments: ['PrivateBanking'],
          minRating: 'A',
        },
        approvalTier: 'AUTO',
      },
      {
        id: 'EVERYONE_ELSE',
        priority: 99,
        label: 'Resto',
        constraints: {},
        approvalTier: 'RISK_COMMITTEE',
      },
    ];

    const vipResult = resolveDelegation(
      {
        amount: 20_000_000,
        segment: 'PrivateBanking',
        rating: 'AA',
        raroc: 20,
      },
      customMatrix,
    );
    expect(vipResult.tier).toBe('AUTO');
    expect(vipResult.matchedRuleId).toBe('PRIVATE_BANKING_VIP');

    const nonVip = resolveDelegation(
      {
        amount: 100_000,
        segment: 'Retail',
        rating: 'A',
        raroc: 20,
      },
      customMatrix,
    );
    expect(nonVip.tier).toBe('RISK_COMMITTEE');
    expect(nonVip.matchedRuleId).toBe('EVERYONE_ELSE');
  });

  it('lower priority number is evaluated first', () => {
    // Two rules that would both match — the one with the lower priority must win
    const matrix: DelegationRule[] = [
      {
        id: 'SECOND',
        priority: 50,
        label: 'Segunda prioridad',
        constraints: { maxAmount: 1_000_000 },
        approvalTier: 'MANAGER_L2',
      },
      {
        id: 'FIRST',
        priority: 10,
        label: 'Primera prioridad',
        constraints: { maxAmount: 1_000_000 },
        approvalTier: 'MANAGER_L1',
      },
    ];
    const result = resolveDelegation({ amount: 500_000, raroc: 15 }, matrix);
    expect(result.matchedRuleId).toBe('FIRST');
    expect(result.tier).toBe('MANAGER_L1');
  });
});

// ---------------------------------------------------------------------------
// Legacy mapping
// ---------------------------------------------------------------------------

describe('tierToLegacyApprovalLevel', () => {
  it('maps each tier to the legacy approvalLevel string', () => {
    expect(tierToLegacyApprovalLevel('AUTO')).toBe('Auto');
    expect(tierToLegacyApprovalLevel('MANAGER_L1')).toBe('L1_Manager');
    expect(tierToLegacyApprovalLevel('MANAGER_L2')).toBe('L2_Committee');
    expect(tierToLegacyApprovalLevel('RISK_COMMITTEE')).toBe('L2_Committee');
    expect(tierToLegacyApprovalLevel('EXECUTIVE_COMMITTEE')).toBe('Rejected');
  });
});
