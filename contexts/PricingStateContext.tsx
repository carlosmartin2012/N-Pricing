import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Transaction } from '../types';
import { INITIAL_DEAL } from '../utils/seedData';

/**
 * PricingState context — shared state for the Pricing workspace (Phase 6.1).
 *
 * Why this exists: pricing routes are split across Calculator, RAROC, Stress
 * and What-If, but they still share the current deal inputs.
 *
 * This context can mirror App.tsx state through the controlled provider prop,
 * which keeps the current route-level workspaces in sync.
 *
 * Do NOT put heavy derived state (e.g. calculatePricing output) in here —
 * derive per-component with useMemo instead. The context holds only the
 * *inputs*; outputs are pure functions of inputs.
 */

interface PricingStateValue {
  dealParams: Transaction;
  setDealParams: React.Dispatch<React.SetStateAction<Transaction>>;
  /** Patch a subset of fields. Convenience around the setter. */
  patchDeal: (patch: Partial<Transaction>) => void;
  /** Reset to a fresh INITIAL_DEAL. Useful after a deal is booked. */
  resetDeal: () => void;
}

const PricingStateContext = createContext<PricingStateValue | null>(null);

interface ProviderProps {
  initialDeal?: Transaction;
  /**
   * Mirrors a parent useState so App.tsx can keep its own state authoritative
   * during the transition. When omitted, the provider owns the state.
   */
  controlled?: {
    value: Transaction;
    setValue: React.Dispatch<React.SetStateAction<Transaction>>;
  };
  children: React.ReactNode;
}

export const PricingStateProvider: React.FC<ProviderProps> = ({ initialDeal = INITIAL_DEAL, controlled, children }) => {
  const [internalDeal, setInternalDeal] = useState<Transaction>(initialDeal);

  const dealParams = controlled?.value ?? internalDeal;
  const setDealParams = controlled?.setValue ?? setInternalDeal;

  const patchDeal = useCallback(
    (patch: Partial<Transaction>) => setDealParams((prev) => ({ ...prev, ...patch })),
    [setDealParams]
  );
  const resetDeal = useCallback(() => setDealParams(initialDeal), [setDealParams, initialDeal]);

  const value = useMemo<PricingStateValue>(
    () => ({ dealParams, setDealParams, patchDeal, resetDeal }),
    [dealParams, setDealParams, patchDeal, resetDeal]
  );

  return <PricingStateContext.Provider value={value}>{children}</PricingStateContext.Provider>;
};

/**
 * Access the shared pricing state. Throws if used outside a provider so
 * consumers catch the regression early (silent `dealParams = null` would be
 * worse than a crash).
 */
export function usePricingState(): PricingStateValue {
  const value = useContext(PricingStateContext);
  if (!value) {
    throw new Error('usePricingState must be used within <PricingStateProvider>');
  }
  return value;
}

/**
 * Soft variant — returns null instead of throwing. Only for components
 * that legitimately work both inside and outside the pricing workspace
 * (e.g. a deal preview card used in both dashboard and calculator).
 */
export function useOptionalPricingState(): PricingStateValue | null {
  return useContext(PricingStateContext);
}
