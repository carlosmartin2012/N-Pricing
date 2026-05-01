// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import React, { useState } from 'react';
import {
  PricingStateProvider,
  usePricingState,
  useOptionalPricingState,
} from '../PricingStateContext';
import { INITIAL_DEAL } from '../../utils/seedData';
import type { Transaction } from '../../types';

describe('PricingStateContext', () => {
  it('usePricingState throws outside provider', () => {
    const { result } = renderHook(() => {
      try { return usePricingState(); } catch (e) { return e; }
    });
    expect(result.current).toBeInstanceOf(Error);
  });

  it('useOptionalPricingState returns null outside provider', () => {
    const { result } = renderHook(() => useOptionalPricingState());
    expect(result.current).toBeNull();
  });

  it('provides the initial deal by default', () => {
    const { result } = renderHook(() => usePricingState(), {
      wrapper: ({ children }) => (
        <PricingStateProvider>{children}</PricingStateProvider>
      ),
    });
    expect(result.current.dealParams).toEqual(INITIAL_DEAL);
  });

  it('patchDeal updates only the given fields', () => {
    const { result } = renderHook(() => usePricingState(), {
      wrapper: ({ children }) => (
        <PricingStateProvider>{children}</PricingStateProvider>
      ),
    });
    act(() => result.current.patchDeal({ amount: 999_000 }));
    expect(result.current.dealParams.amount).toBe(999_000);
    // Other fields untouched
    expect(result.current.dealParams.productType).toBe(INITIAL_DEAL.productType);
  });

  it('resetDeal returns to the configured initial', () => {
    const customInitial: Transaction = { ...INITIAL_DEAL, amount: 42 };
    const { result } = renderHook(() => usePricingState(), {
      wrapper: ({ children }) => (
        <PricingStateProvider initialDeal={customInitial}>{children}</PricingStateProvider>
      ),
    });
    act(() => result.current.patchDeal({ amount: 1 }));
    expect(result.current.dealParams.amount).toBe(1);
    act(() => result.current.resetDeal());
    expect(result.current.dealParams.amount).toBe(42);
  });

  it('controlled mode defers to the parent useState', () => {
    const { result } = renderHook(() => {
      const [deal, setDeal] = useState<Transaction>({ ...INITIAL_DEAL, amount: 100 });
      return { deal, setDeal };
    });

    const { result: stateResult } = renderHook(() => usePricingState(), {
      wrapper: ({ children }) => (
        <PricingStateProvider
          controlled={{ value: result.current.deal, setValue: result.current.setDeal }}
        >
          {children}
        </PricingStateProvider>
      ),
    });
    expect(stateResult.current.dealParams.amount).toBe(100);
  });
});
