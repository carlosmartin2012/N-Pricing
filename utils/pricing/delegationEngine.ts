/**
 * Delegation Engine — multi-dimensional price delegation per spec §M8.
 *
 * Resolves the approval level required for a deal based on a matrix of
 * (amount × segment × rating × LTV × gestor) with configurable tiers.
 *
 * Each rule defines a set of constraints; the first matching rule wins.
 * If no rule matches, falls back to committee-level approval.
 */

export type ApprovalTier =
  | 'AUTO'            // No approval required
  | 'MANAGER_L1'      // Branch/desk manager
  | 'MANAGER_L2'      // Regional manager
  | 'RISK_COMMITTEE'  // Risk committee
  | 'EXECUTIVE_COMMITTEE'; // Board-level

export interface DelegationRule {
  id: string;
  priority: number; // lower = evaluated first
  /** Rule label for audit trail */
  label: string;
  /** Constraints — all specified must match. Undefined = wildcard */
  constraints: {
    /** Min amount EUR */
    minAmount?: number;
    /** Max amount EUR */
    maxAmount?: number;
    /** Allowed segments (client types). Empty = all */
    segments?: string[];
    /** Minimum client rating (AAA > AA > A > BBB > BB > B > CCC > D) */
    minRating?: string;
    /** Max LTV allowed (%) */
    maxLtvPct?: number;
    /** Min RAROC (%) */
    minRaroc?: number;
    /** Max discount vs hurdle rate (% below) */
    maxDiscountPct?: number;
    /** Allowed business units */
    businessUnits?: string[];
    /** Allowed manager roles */
    managerRoles?: string[];
  };
  /** Approval tier if rule matches */
  approvalTier: ApprovalTier;
}

export interface DelegationInput {
  amount: number;
  segment?: string;          // clientType
  rating?: string;           // client rating
  ltvPct?: number;           // 0-100
  raroc: number;             // calculated RAROC %
  hurdleRate?: number;       // target ROE %
  businessUnit?: string;
  managerRole?: string;      // Role of submitting manager
}

export interface DelegationResult {
  tier: ApprovalTier;
  matchedRuleId: string | null;
  matchedRuleLabel: string;
  reasons: string[];
  /** Audit-friendly breakdown of rule evaluation */
  evaluatedRules: Array<{
    ruleId: string;
    matched: boolean;
    failedConstraints: string[];
  }>;
}

/** Credit rating ordering — higher index = worse */
const RATING_ORDER: Record<string, number> = {
  'AAA': 0, 'AA+': 1, 'AA': 2, 'AA-': 3,
  'A+': 4, 'A': 5, 'A-': 6,
  'BBB+': 7, 'BBB': 8, 'BBB-': 9,
  'BB+': 10, 'BB': 11, 'BB-': 12,
  'B+': 13, 'B': 14, 'B-': 15,
  'CCC+': 16, 'CCC': 17, 'CCC-': 18,
  'CC': 19, 'C': 20, 'D': 21,
};

function ratingAtLeast(actual: string | undefined, minimum: string): boolean {
  if (!actual) return false;
  const actualIdx = RATING_ORDER[actual.toUpperCase()] ?? 99;
  const minIdx = RATING_ORDER[minimum.toUpperCase()] ?? -1;
  // Lower index = better rating. Actual must be <= minimum (better or equal)
  return actualIdx <= minIdx;
}

/** Default delegation matrix (typical Spanish retail bank) */
export const DEFAULT_DELEGATION_MATRIX: DelegationRule[] = [
  {
    id: 'AUTO_SMALL_GOOD',
    priority: 10,
    label: 'Auto-aprobado — importe bajo con RAROC saludable',
    constraints: {
      maxAmount: 250_000,
      minRating: 'BBB',
      maxLtvPct: 80,
      minRaroc: 15,
    },
    approvalTier: 'AUTO',
  },
  {
    id: 'L1_MEDIUM',
    priority: 20,
    label: 'Director de oficina — importe medio',
    constraints: {
      maxAmount: 1_000_000,
      minRating: 'BBB',
      maxLtvPct: 90,
      minRaroc: 10,
    },
    approvalTier: 'MANAGER_L1',
  },
  {
    id: 'L2_LARGE',
    priority: 30,
    label: 'Director regional — importe elevado',
    constraints: {
      maxAmount: 5_000_000,
      minRating: 'BB',
      maxLtvPct: 95,
      minRaroc: 8,
    },
    approvalTier: 'MANAGER_L2',
  },
  {
    id: 'RISK_COMMITTEE_BELOW_HURDLE',
    priority: 40,
    label: 'Comité de riesgos — por debajo del hurdle',
    constraints: {
      maxDiscountPct: 5,
    },
    approvalTier: 'RISK_COMMITTEE',
  },
  {
    id: 'EXEC_COMMITTEE_SEVERE',
    priority: 50,
    label: 'Comité ejecutivo — casos severos',
    constraints: {},
    approvalTier: 'EXECUTIVE_COMMITTEE',
  },
];

/**
 * Evaluate a delegation rule against an input.
 * Returns the list of failed constraint names (empty = rule matches).
 */
function evaluateRule(rule: DelegationRule, input: DelegationInput): string[] {
  const failed: string[] = [];
  const c = rule.constraints;

  if (c.minAmount != null && input.amount < c.minAmount) failed.push('minAmount');
  if (c.maxAmount != null && input.amount > c.maxAmount) failed.push('maxAmount');

  if (c.segments && c.segments.length > 0) {
    if (!input.segment || !c.segments.includes(input.segment)) {
      failed.push('segment');
    }
  }

  if (c.minRating && !ratingAtLeast(input.rating, c.minRating)) {
    failed.push('minRating');
  }

  if (c.maxLtvPct != null) {
    if (input.ltvPct == null || input.ltvPct > c.maxLtvPct) failed.push('maxLtvPct');
  }

  if (c.minRaroc != null && input.raroc < c.minRaroc) {
    failed.push('minRaroc');
  }

  if (c.maxDiscountPct != null && input.hurdleRate != null) {
    const discount = input.hurdleRate - input.raroc;
    // Rule only applies when deal is actually discounted (raroc < hurdle)
    // AND the discount is within the allowed band.
    if (discount <= 0 || discount > c.maxDiscountPct) failed.push('maxDiscountPct');
  }

  if (c.businessUnits && c.businessUnits.length > 0) {
    if (!input.businessUnit || !c.businessUnits.includes(input.businessUnit)) {
      failed.push('businessUnit');
    }
  }

  if (c.managerRoles && c.managerRoles.length > 0) {
    if (!input.managerRole || !c.managerRoles.includes(input.managerRole)) {
      failed.push('managerRole');
    }
  }

  return failed;
}

/**
 * Resolve the required approval tier for a deal given a delegation matrix.
 * Evaluates rules in priority order; first matching rule wins.
 * Falls back to EXECUTIVE_COMMITTEE if no rule matches.
 */
export function resolveDelegation(
  input: DelegationInput,
  matrix: DelegationRule[] = DEFAULT_DELEGATION_MATRIX,
): DelegationResult {
  const sorted = [...matrix].sort((a, b) => a.priority - b.priority);
  const evaluatedRules: DelegationResult['evaluatedRules'] = [];

  for (const rule of sorted) {
    const failed = evaluateRule(rule, input);
    evaluatedRules.push({
      ruleId: rule.id,
      matched: failed.length === 0,
      failedConstraints: failed,
    });

    if (failed.length === 0) {
      return {
        tier: rule.approvalTier,
        matchedRuleId: rule.id,
        matchedRuleLabel: rule.label,
        reasons: [rule.label],
        evaluatedRules,
      };
    }
  }

  // No rule matched → executive committee fallback
  return {
    tier: 'EXECUTIVE_COMMITTEE',
    matchedRuleId: null,
    matchedRuleLabel: 'Fallback — ninguna regla aplica',
    reasons: ['No delegation rule matched all constraints'],
    evaluatedRules,
  };
}

/**
 * Utility: map the multi-dimensional tier back to the legacy
 * ApprovalMatrixConfig approvalLevel string used in pricingEngine.
 */
export function tierToLegacyApprovalLevel(
  tier: ApprovalTier,
): 'Auto' | 'L1_Manager' | 'L2_Committee' | 'Rejected' {
  switch (tier) {
    case 'AUTO': return 'Auto';
    case 'MANAGER_L1': return 'L1_Manager';
    case 'MANAGER_L2': return 'L2_Committee';
    case 'RISK_COMMITTEE': return 'L2_Committee';
    case 'EXECUTIVE_COMMITTEE': return 'Rejected';
  }
}
