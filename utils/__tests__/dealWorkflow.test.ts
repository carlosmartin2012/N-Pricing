import { describe, it, expect } from 'vitest';
import {
  getAvailableActions,
  isDealEditable,
  canTransition,
  executeTransition,
  getStatusColor,
  formatStatus,
  DealStatus,
  UserRole,
} from '../dealWorkflow';
import { Transaction, FTPResult } from '../../types';

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

const mockPricingResult: FTPResult = {
  baseRate: 3.5,
  liquiditySpread: 0.5,
  _liquidityPremiumDetails: 0.3,
  _clcChargeDetails: 0.2,
  strategicSpread: 0.1,
  optionCost: 0.05,
  regulatoryCost: 0.15,
  operationalCost: 0.45,
  capitalCharge: 1.2,
  esgTransitionCharge: 0,
  esgPhysicalCharge: 0,
  floorPrice: 5.0,
  technicalPrice: 5.5,
  targetPrice: 6.0,
  totalFTP: 4.5,
  finalClientRate: 6.5,
  raroc: 15.2,
  economicProfit: 25000,
  approvalLevel: 'Auto',
  accountingEntry: {
    source: 'FTP',
    dest: 'Pool',
    amountDebit: 5_000_000,
    amountCredit: 5_000_000,
  },
  matchedMethodology: 'MatchedMaturity',
  matchReason: 'Test',
};

describe('getAvailableActions', () => {
  it('Draft -> Pending_Approval available for Trader', () => {
    const actions = getAvailableActions('Draft', 'Trader');
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.to === 'Pending_Approval')).toBe(true);
  });

  it('Draft -> Pending_Approval not available for Auditor', () => {
    const actions = getAvailableActions('Draft', 'Auditor');
    expect(actions).toHaveLength(0);
  });

  it('Pending_Approval -> Approved available for Risk_Manager', () => {
    const actions = getAvailableActions('Pending_Approval', 'Risk_Manager');
    expect(actions.some(a => a.to === 'Approved')).toBe(true);
  });

  it('returns empty for undefined status', () => {
    const actions = getAvailableActions(undefined, 'Admin');
    expect(actions).toHaveLength(0);
  });
});

describe('isDealEditable', () => {
  it('Draft is editable', () => {
    expect(isDealEditable({ ...baseDeal, status: 'Draft' })).toBe(true);
  });

  it('Booked is not editable', () => {
    expect(isDealEditable({ ...baseDeal, status: 'Booked' })).toBe(false);
  });

  it('Approved is not editable', () => {
    expect(isDealEditable({ ...baseDeal, status: 'Approved' })).toBe(false);
  });

  it('Pending_Approval is not editable', () => {
    expect(isDealEditable({ ...baseDeal, status: 'Pending_Approval' })).toBe(false);
  });
});

describe('canTransition', () => {
  it('Draft -> Pending_Approval valid for Admin', () => {
    expect(canTransition('Draft', 'Pending_Approval', 'Admin')).toBe(true);
  });

  it('Draft -> Pending_Approval invalid for Auditor', () => {
    expect(canTransition('Draft', 'Pending_Approval', 'Auditor')).toBe(false);
  });

  it('Pending_Approval -> Approved valid for Risk_Manager', () => {
    expect(canTransition('Pending_Approval', 'Approved', 'Risk_Manager')).toBe(true);
  });

  it('Rejected -> Draft valid for Trader (rework)', () => {
    expect(canTransition('Rejected', 'Draft', 'Trader')).toBe(true);
  });
});

describe('executeTransition', () => {
  it('successful Draft -> Pending_Approval with pricing result', () => {
    const deal = { ...baseDeal, status: 'Draft' as const };
    const result = executeTransition(deal, 'Pending_Approval', 'Trader', 'trader@test.com', mockPricingResult);
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('Pending_Approval');
    expect(result.pricingSnapshot).toBeDefined();
  });

  it('fails without pricing result when required', () => {
    const deal = { ...baseDeal, status: 'Draft' as const };
    const result = executeTransition(deal, 'Pending_Approval', 'Trader', 'trader@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Pricing calculation required');
  });

  it('fails for invalid transition', () => {
    const deal = { ...baseDeal, status: 'Draft' as const };
    const result = executeTransition(deal, 'Booked', 'Trader', 'trader@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('Approved -> Booked succeeds', () => {
    const deal = { ...baseDeal, status: 'Approved' as const };
    const result = executeTransition(deal, 'Booked', 'Trader', 'trader@test.com');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('Booked');
  });
});

describe('getStatusColor', () => {
  it('returns correct CSS classes for each status', () => {
    expect(getStatusColor('Draft')).toContain('slate');
    expect(getStatusColor('Pending_Approval')).toContain('amber');
    expect(getStatusColor('Pending')).toContain('amber');
    expect(getStatusColor('Review')).toContain('blue');
    expect(getStatusColor('Approved')).toContain('emerald');
    expect(getStatusColor('Booked')).toContain('cyan');
    expect(getStatusColor('Rejected')).toContain('red');
    expect(getStatusColor('Unknown')).toContain('slate');
  });
});

describe('formatStatus', () => {
  it('replaces underscores with spaces', () => {
    expect(formatStatus('Pending_Approval')).toBe('Pending Approval');
    expect(formatStatus('Draft')).toBe('Draft');
    expect(formatStatus('A_B_C')).toBe('A B C');
  });
});
