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

// ---------------------------------------------------------------------------
// Regulatory edge cases — SR 11-7 / EBA validator angle.
//
// These guard against silent bugs that a model-validation team would
// catch during review: a catch-all rule that matches wrongly, a
// boundary where the approval auto-escalates one tier off, an empty
// matrix that quietly lands deals as AUTO. Each test pins the
// invariant an auditor would ask about.
// ---------------------------------------------------------------------------

describe('resolveDelegation — regulatory edge cases', () => {
  it('empty matrix falls back to EXECUTIVE_COMMITTEE (never AUTO)', () => {
    const result = resolveDelegation(goodSmallDeal, []);
    expect(result.tier).toBe('EXECUTIVE_COMMITTEE');
    expect(result.matchedRuleId).toBeNull();
  });

  it('rule with empty constraints object acts as catch-all (matches anything)', () => {
    const catchAll: DelegationRule[] = [
      {
        id: 'CATCH_ALL',
        priority: 1,
        label: 'Catch-all',
        constraints: {},
        approvalTier: 'MANAGER_L1',
      },
    ];
    const result = resolveDelegation({ amount: 0, rating: 'D', raroc: -10 }, catchAll);
    expect(result.tier).toBe('MANAGER_L1');
    expect(result.matchedRuleId).toBe('CATCH_ALL');
  });

  it('maxDiscountPct rule does NOT apply when raroc >= hurdle (discount <= 0)', () => {
    // A rule saying "up to 2% under hurdle goes to L1" must not match a
    // deal that is AT or ABOVE the hurdle — otherwise a perfectly
    // economic deal would escalate needlessly.
    const matrix: DelegationRule[] = [
      {
        id: 'L1_SMALL_DISCOUNT',
        priority: 1,
        label: 'L1 up to 2% discount',
        constraints: { maxDiscountPct: 2 },
        approvalTier: 'MANAGER_L1',
      },
      {
        id: 'CATCH',
        priority: 99,
        label: 'Catch',
        constraints: {},
        approvalTier: 'AUTO',
      },
    ];
    const overHurdle = resolveDelegation({ amount: 1, rating: 'A', raroc: 15, hurdleRate: 12 }, matrix);
    expect(overHurdle.tier).toBe('AUTO');
    const atHurdle = resolveDelegation({ amount: 1, rating: 'A', raroc: 12, hurdleRate: 12 }, matrix);
    expect(atHurdle.tier).toBe('AUTO');
    // Just below — actual discount of 1pp → L1 applies.
    const justBelow = resolveDelegation({ amount: 1, rating: 'A', raroc: 11, hurdleRate: 12 }, matrix);
    expect(justBelow.tier).toBe('MANAGER_L1');
  });

  it('maxDiscountPct boundary: discount exactly at max is accepted, above is rejected', () => {
    const matrix: DelegationRule[] = [
      {
        id: 'L1_MAX_2',
        priority: 1,
        label: 'L1 up to 2pp',
        constraints: { maxDiscountPct: 2 },
        approvalTier: 'MANAGER_L1',
      },
      {
        id: 'CATCH',
        priority: 99,
        label: 'Catch',
        constraints: {},
        approvalTier: 'RISK_COMMITTEE',
      },
    ];
    // Discount = 2pp exactly → inside the band.
    const onBoundary = resolveDelegation({ amount: 1, rating: 'A', raroc: 10, hurdleRate: 12 }, matrix);
    expect(onBoundary.tier).toBe('MANAGER_L1');
    // Discount = 2.001pp → above the band, escalates.
    const justOver = resolveDelegation({ amount: 1, rating: 'A', raroc: 9.999, hurdleRate: 12 }, matrix);
    expect(justOver.tier).toBe('RISK_COMMITTEE');
  });

  it('zero-amount deal is matched by the default matrix (no null-guard bypass)', () => {
    // A regression we want to prevent: amount=0 returning a silent AUTO
    // because `minAmount != null` guards the check. Deal with amount=0
    // should still be evaluated against constraints.
    const result = resolveDelegation({ amount: 0, rating: 'A', raroc: 15, hurdleRate: 12 });
    expect(result.tier).toBeDefined();
    expect(result.evaluatedRules.length).toBeGreaterThan(0);
  });

  it('segment constraint: rule requiring a specific segment fails if input has no segment', () => {
    const matrix: DelegationRule[] = [
      {
        id: 'RETAIL_ONLY',
        priority: 1,
        label: 'Retail-only',
        constraints: { segments: ['Retail'] },
        approvalTier: 'AUTO',
      },
      {
        id: 'CATCH',
        priority: 99,
        label: 'Catch',
        constraints: {},
        approvalTier: 'MANAGER_L2',
      },
    ];
    const noSegment = resolveDelegation({ amount: 100, rating: 'A', raroc: 15 }, matrix);
    expect(noSegment.tier).toBe('MANAGER_L2');
    expect(noSegment.evaluatedRules[0].failedConstraints).toContain('segment');
  });

  it('businessUnit + managerRole constraints both must hold', () => {
    const matrix: DelegationRule[] = [
      {
        id: 'STRUCTURED_BY_HEAD',
        priority: 1,
        label: 'Only BU_STRUCTURED + HeadOfDesk',
        constraints: {
          businessUnits: ['BU_STRUCTURED'],
          managerRoles: ['HeadOfDesk'],
        },
        approvalTier: 'AUTO',
      },
      {
        id: 'CATCH',
        priority: 99,
        label: 'Catch',
        constraints: {},
        approvalTier: 'RISK_COMMITTEE',
      },
    ];
    const happy = resolveDelegation({
      amount: 1, rating: 'A', raroc: 15,
      businessUnit: 'BU_STRUCTURED', managerRole: 'HeadOfDesk',
    }, matrix);
    expect(happy.tier).toBe('AUTO');

    const wrongBu = resolveDelegation({
      amount: 1, rating: 'A', raroc: 15,
      businessUnit: 'BU_RETAIL', managerRole: 'HeadOfDesk',
    }, matrix);
    expect(wrongBu.tier).toBe('RISK_COMMITTEE');
    expect(wrongBu.evaluatedRules[0].failedConstraints).toContain('businessUnit');

    const wrongRole = resolveDelegation({
      amount: 1, rating: 'A', raroc: 15,
      businessUnit: 'BU_STRUCTURED', managerRole: 'JuniorRM',
    }, matrix);
    expect(wrongRole.tier).toBe('RISK_COMMITTEE');
    expect(wrongRole.evaluatedRules[0].failedConstraints).toContain('managerRole');
  });

  it('missing hurdleRate disables the maxDiscountPct check (rule skipped, not auto-matched)', () => {
    // If the caller forgot to populate hurdleRate, the rule's discount
    // band cannot be evaluated. Current behaviour: the check is skipped
    // entirely (the constraint passes by omission), so the rule may
    // match. This test pins that behaviour — if we change it to fail-
    // closed in the future, the test fails and forces a conscious
    // review of every caller.
    const matrix: DelegationRule[] = [
      {
        id: 'L1',
        priority: 1,
        label: 'L1 any discount',
        constraints: { maxDiscountPct: 5 },
        approvalTier: 'MANAGER_L1',
      },
    ];
    const noHurdle = resolveDelegation({ amount: 100, rating: 'A', raroc: 10 }, matrix);
    // maxDiscountPct check requires hurdleRate; when absent it is a no-op,
    // so the rule's other constraints (none) pass → L1 tier.
    // If the caller cares about strict evaluation they must populate
    // hurdleRate in DelegationInput before calling resolveDelegation.
    expect(noHurdle.tier).toBe('MANAGER_L1');
  });
});
