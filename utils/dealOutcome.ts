/**
 * Deal outcome constants & helpers — pricing elasticity capture.
 *
 * See: docs/pivot/PIVOT_PLAN.md §Bloque A
 *      supabase/migrations/20260413000001_deal_outcomes.sql
 */

import type { Transaction } from '../types';

export type WonLost = NonNullable<Transaction['wonLost']>;
export type LossReason = NonNullable<Transaction['lossReason']>;

export const WON_LOST_OPTIONS: Array<{ value: WonLost; label: string; description: string }> = [
  { value: 'WON', label: 'Won', description: 'Client accepted and deal was booked' },
  { value: 'LOST', label: 'Lost', description: 'Client chose another counterparty or walked away' },
  { value: 'PENDING', label: 'Pending', description: 'Proposal issued, awaiting response' },
  { value: 'WITHDRAWN', label: 'Withdrawn', description: 'Bank pulled the proposal' },
];

export const LOSS_REASON_OPTIONS: Array<{ value: LossReason; label: string; description: string }> = [
  { value: 'PRICE', label: 'Price', description: 'Rate or fee was not competitive' },
  { value: 'COVENANT', label: 'Covenant', description: 'Non-price contractual terms' },
  { value: 'RELATIONSHIP', label: 'Relationship', description: 'Broader client relationship influenced decision' },
  { value: 'COMPETITOR', label: 'Competitor', description: 'Explicit competitor offer beat us' },
  { value: 'TIMING', label: 'Timing', description: 'Deal delayed or urgency mismatch' },
  { value: 'CLIENT_WITHDREW', label: 'Client withdrew', description: 'Client pulled out for internal reasons' },
  { value: 'OTHER', label: 'Other', description: 'None of the above fits — use sparingly' },
];

/**
 * Validate that a deal marked LOST has a loss_reason set.
 * Used by Pricing Dossier workflow guard and form validation.
 */
export const isOutcomeComplete = (deal: Partial<Transaction>): boolean => {
  if (!deal.wonLost) return false;
  if (deal.wonLost === 'LOST' && !deal.lossReason) return false;
  return true;
};

/**
 * Whether this deal's outcome is eligible to feed elasticity calibration.
 * Only WON and LOST deals contribute (PENDING and WITHDRAWN are noise).
 */
export const isElasticityEligible = (deal: Transaction): boolean => {
  return deal.wonLost === 'WON' || deal.wonLost === 'LOST';
};

/**
 * Visual style per outcome — used by Blotter table cell and drawer.
 * Uses NFQ design tokens (see .claude/rules/nfq-design.md).
 */
export const getOutcomeStyle = (outcome: WonLost | undefined): {
  dot: string;
  text: string;
  label: string;
} => {
  switch (outcome) {
    case 'WON':
      return { dot: 'bg-[var(--nfq-success)]', text: 'text-[var(--nfq-success)]', label: 'WON' };
    case 'LOST':
      return { dot: 'bg-[var(--nfq-danger)]', text: 'text-[var(--nfq-danger)]', label: 'LOST' };
    case 'PENDING':
      return { dot: 'bg-[var(--nfq-warning)]', text: 'text-[var(--nfq-warning)]', label: 'PENDING' };
    case 'WITHDRAWN':
      return { dot: 'bg-[var(--nfq-text-muted)]', text: 'text-[color:var(--nfq-text-muted)]', label: 'WITHDRAWN' };
    default:
      return { dot: 'bg-transparent', text: 'text-[color:var(--nfq-text-muted)]', label: '—' };
  }
};

/**
 * Build a partial Transaction update payload for outcome capture.
 * Automatically stamps decision_date when transitioning to a terminal state.
 */
export const buildOutcomePatch = (outcome: {
  wonLost: WonLost;
  lossReason?: LossReason;
  competitorRate?: number;
}): Partial<Transaction> => {
  const isTerminal = outcome.wonLost === 'WON' || outcome.wonLost === 'LOST' || outcome.wonLost === 'WITHDRAWN';
  return {
    wonLost: outcome.wonLost,
    lossReason: outcome.wonLost === 'LOST' ? outcome.lossReason : undefined,
    competitorRate: outcome.competitorRate,
    decisionDate: isTerminal ? new Date().toISOString() : undefined,
  };
};
