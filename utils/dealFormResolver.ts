import type { Resolver } from 'react-hook-form';
import type { Transaction } from '../types';
import { validateDeal } from './validation';

/**
 * React Hook Form custom resolver that wraps the existing validateDeal() function.
 * This ensures the same validation logic is used whether called from RHF or manually.
 */
export const dealFormResolver: Resolver<Transaction> = async (values) => {
  const result = validateDeal(values);

  if (result.valid) {
    return { values, errors: {} };
  }

  const errors: Record<string, { type: string; message: string }> = {};
  for (const err of result.errors) {
    errors[err.field] = { type: 'validation', message: err.message };
  }

  return { values: {} as Record<string, never>, errors };
};
