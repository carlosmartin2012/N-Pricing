import { describe, it, expect } from 'vitest';
import { validateDeal } from '../validation';
import { Transaction } from '../../types';

const baseDeal: Transaction = {
  clientId: 'CL-1001',
  clientType: 'Corporate',
  businessUnit: 'BU-001',
  fundingBusinessUnit: 'BU-900',
  businessLine: 'Corporate',
  productType: 'LOAN_COMM',
  category: 'Asset',
  currency: 'USD',
  amount: 5_000_000,
  startDate: '2024-01-01',
  durationMonths: 24,
  amortization: 'Bullet',
  repricingFreq: 'Fixed',
  marginTarget: 2.25,
  riskWeight: 100,
  capitalRatio: 11.5,
  targetROE: 15,
  operationalCostBps: 45,
  transitionRisk: 'Neutral',
  physicalRisk: 'Low',
};

describe('validateDeal', () => {
  it('valid deal returns { valid: true, errors: [] }', () => {
    const result = validateDeal(baseDeal);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('missing clientId returns error', () => {
    const deal = { ...baseDeal, clientId: '' };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'clientId')).toBe(true);
  });

  it('missing productType returns error', () => {
    const deal = { ...baseDeal, productType: '' };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'productType')).toBe(true);
  });

  it('amount 0 returns error', () => {
    const deal = { ...baseDeal, amount: 0 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('amount negative returns error', () => {
    const deal = { ...baseDeal, amount: -100 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('amount > 10B returns error', () => {
    const deal = { ...baseDeal, amount: 10_000_000_001 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount' && e.message.includes('maximum'))).toBe(true);
  });

  it('duration < 1 returns error', () => {
    const deal = { ...baseDeal, durationMonths: 0 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'durationMonths')).toBe(true);
  });

  it('duration > 360 returns error', () => {
    const deal = { ...baseDeal, durationMonths: 361 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'durationMonths')).toBe(true);
  });

  it('risk weight negative returns error', () => {
    const deal = { ...baseDeal, riskWeight: -1 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'riskWeight')).toBe(true);
  });

  it('risk weight > 1250 returns error', () => {
    const deal = { ...baseDeal, riskWeight: 1251 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'riskWeight')).toBe(true);
  });

  it('capital ratio > 100 returns error', () => {
    const deal = { ...baseDeal, capitalRatio: 101 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'capitalRatio')).toBe(true);
  });

  it('target ROE negative returns error', () => {
    const deal = { ...baseDeal, targetROE: -1 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'targetROE')).toBe(true);
  });

  it('operational cost > 500 returns error', () => {
    const deal = { ...baseDeal, operationalCostBps: 501 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'operationalCostBps')).toBe(true);
  });

  it('missing startDate returns error', () => {
    const deal = { ...baseDeal, startDate: '' };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'startDate')).toBe(true);
  });

  it('multiple errors returned for multiple invalid fields', () => {
    const deal = { ...baseDeal, clientId: '', amount: -5, durationMonths: 0 };
    const result = validateDeal(deal);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
    const fields = result.errors.map(e => e.field);
    expect(fields).toContain('clientId');
    expect(fields).toContain('amount');
    expect(fields).toContain('durationMonths');
  });
});
