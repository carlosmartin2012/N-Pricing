import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Transaction } from '../types';
import { INITIAL_DEAL } from '../utils/seedData';

/**
 * PricingState context — shared state for the Pricing workspace (Phase 6.1).
 *
 * Why this exists: the deal params currently live in App.tsx as useState and
 * are prop-drilled into PricingWorkspace → CalculatorWorkspace. When we
 * split the workspace into separate routes (the 🔴 #2 improvement from the
 * integral review), the 4 views will all need to read/write the same
 * `dealParams` without being nested under a common parent.
 *
 * This context is a **parallel** API — App.tsx keeps its useState for now,
 * and only new components need to adopt `usePricingState()`. When the split
 * happens, App.tsx will wrap everything with <PricingStateProvider> and
 * delete the prop drilling.
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

export const PricingStateProvider: React.FC<ProviderProps> = ({
  initialDeal = INITIAL_DEAL,
  controlled,
  children,
}) => {
  const [internalDeal, setInternalDeal] = useState<Transaction>(initialDeal);

  const dealParams = controlled?.value ?? internalDeal;
  const setDealParams = controlled?.setValue ?? setInternalDeal;

  const patchDeal = useCallback(
    (patch: Partial<Transaction>) => setDealParams((prev) => ({ ...prev, ...patch })),
    [setDealParams],
  );
  const resetDeal = useCallback(() => setDealParams(initialDeal), [setDealParams, initialDeal]);

  const value = useMemo<PricingStateValue>(
    () => ({ dealParams, setDealParams, patchDeal, resetDeal }),
    [dealParams, setDealParams, patchDeal, resetDeal],
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
