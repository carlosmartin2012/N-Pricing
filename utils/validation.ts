import { Transaction } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate a deal/transaction before pricing or saving.
 */
export function validateDeal(deal: Transaction): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!deal.clientId?.trim()) {
    errors.push({ field: 'clientId', message: 'Client is required' });
  }
  if (!deal.productType?.trim()) {
    errors.push({ field: 'productType', message: 'Product type is required' });
  }
  if (!deal.businessUnit?.trim()) {
    errors.push({ field: 'businessUnit', message: 'Business unit is required' });
  }
  if (!deal.businessLine?.trim()) {
    errors.push({ field: 'businessLine', message: 'Business line is required' });
  }
  if (!deal.currency?.trim()) {
    errors.push({ field: 'currency', message: 'Currency is required' });
  }
  if (!deal.category) {
    errors.push({ field: 'category', message: 'Category is required' });
  }

  // Amount
  if (deal.amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be greater than 0' });
  }
  if (deal.amount > 10_000_000_000) {
    errors.push({ field: 'amount', message: 'Amount exceeds maximum (10B)' });
  }

  // Duration
  if (!deal.durationMonths || deal.durationMonths < 1) {
    errors.push({ field: 'durationMonths', message: 'Duration must be at least 1 month' });
  }
  if (deal.durationMonths > 360) {
    errors.push({ field: 'durationMonths', message: 'Duration cannot exceed 360 months (30Y)' });
  }

  // Risk weight: 0-1250% (per Basel)
  if (deal.riskWeight < 0) {
    errors.push({ field: 'riskWeight', message: 'Risk weight cannot be negative' });
  }
  if (deal.riskWeight > 1250) {
    errors.push({ field: 'riskWeight', message: 'Risk weight cannot exceed 1250%' });
  }

  // Capital ratio: 0-100%
  if (deal.capitalRatio < 0 || deal.capitalRatio > 100) {
    errors.push({ field: 'capitalRatio', message: 'Capital ratio must be between 0% and 100%' });
  }

  // Target ROE: reasonable range
  if (deal.targetROE < 0 || deal.targetROE > 100) {
    errors.push({ field: 'targetROE', message: 'Target ROE must be between 0% and 100%' });
  }

  // Operational cost: 0-500 bps
  if (deal.operationalCostBps < 0) {
    errors.push({ field: 'operationalCostBps', message: 'Operational cost cannot be negative' });
  }
  if (deal.operationalCostBps > 500) {
    errors.push({ field: 'operationalCostBps', message: 'Operational cost exceeds 500 bps' });
  }

  // Start date
  if (!deal.startDate) {
    errors.push({ field: 'startDate', message: 'Start date is required' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Re-export for backwards compatibility — prefer importing from './safeSupabaseCall' directly.
export { safeSupabaseCall } from './safeSupabaseCall';
