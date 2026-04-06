import { describe, expect, it } from 'vitest';
import {
  INITIAL_RAROC_INPUTS,
  areRarocInputsEqual,
  buildUpdatedRarocInputs,
  normalizeRarocInputs,
} from '../../components/RAROC/rarocCalculatorUtils';

describe('rarocCalculatorUtils', () => {
  it('normalizes empty state with default calculator inputs', () => {
    const normalized = normalizeRarocInputs(null);

    expect(normalized.transactionId).toBe(INITIAL_RAROC_INPUTS.transactionId);
    expect(normalized.interestSpread).toBe(INITIAL_RAROC_INPUTS.interestSpread);
  });

  it('keeps commercial spread aligned when client rate changes', () => {
    const nextInputs = buildUpdatedRarocInputs(INITIAL_RAROC_INPUTS, 'interestRate', 7.25);

    expect(nextInputs.interestRate).toBe(7.25);
    expect(nextInputs.interestSpread).toBeCloseTo(3.75, 4);
  });

  it('rebuilds client rate when spread is edited directly', () => {
    const nextInputs = buildUpdatedRarocInputs(INITIAL_RAROC_INPUTS, 'interestSpread', 2.1);

    expect(nextInputs.interestSpread).toBe(2.1);
    expect(nextInputs.interestRate).toBeCloseTo(5.6, 4);
  });

  it('compares full raroc input snapshots without JSON serialization', () => {
    expect(areRarocInputsEqual(INITIAL_RAROC_INPUTS, { ...INITIAL_RAROC_INPUTS })).toBe(true);
    expect(
      areRarocInputsEqual(INITIAL_RAROC_INPUTS, {
        ...INITIAL_RAROC_INPUTS,
        feeIncome: INITIAL_RAROC_INPUTS.feeIncome + 1,
      }),
    ).toBe(false);
  });
});
