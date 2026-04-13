import { describe, it, expect } from 'vitest';
import { resolveApprovalLevel, computeEvaBp, DEFAULT_EVA_BANDS } from '../pricing/governance';
import type { ApprovalMatrixConfig } from '../../types';

const matrix: ApprovalMatrixConfig = {
  // Legacy thresholds
  autoApprovalThreshold: 15,
  l1Threshold: 10,
  l2Threshold: 5,
  // EVA bands (pivot defaults)
  autoApprovalEvaBp: 200,
  l1EvaBp: 0,
  l2EvaBp: -100,
};

describe('resolveApprovalLevel — EVA mode', () => {
  it('auto-approves when EVA > +200bp', () => {
    // raroc 15, hurdle 12 → EVA +300bp
    expect(resolveApprovalLevel(15, 12, matrix, 'EVA')).toBe('Auto');
  });
  it('L1 when EVA in [0, +200bp)', () => {
    // raroc 12, hurdle 11 → EVA +100bp
    expect(resolveApprovalLevel(12, 11, matrix, 'EVA')).toBe('L1_Manager');
  });
  it('L2 when EVA in [-100bp, 0)', () => {
    // raroc 10, hurdle 10.5 → EVA -50bp
    expect(resolveApprovalLevel(10, 10.5, matrix, 'EVA')).toBe('L2_Committee');
  });
  it('Rejected when EVA < -100bp', () => {
    // raroc 10, hurdle 15 → EVA -500bp
    expect(resolveApprovalLevel(10, 15, matrix, 'EVA')).toBe('Rejected');
  });
  it('EVA handles edge cases at band boundaries', () => {
    // exactly +200bp → Auto
    expect(resolveApprovalLevel(14, 12, matrix, 'EVA')).toBe('Auto');
    // exactly 0 → L1
    expect(resolveApprovalLevel(12, 12, matrix, 'EVA')).toBe('L1_Manager');
    // exactly -100bp → L2
    expect(resolveApprovalLevel(11, 12, matrix, 'EVA')).toBe('L2_Committee');
  });
  it('EVA correctly distinguishes high-hurdle Corporate from low-hurdle Retail', () => {
    // Retail: raroc 12, hurdle 8 → EVA +400bp → Auto
    expect(resolveApprovalLevel(12, 8, matrix, 'EVA')).toBe('Auto');
    // Corporate: raroc 12, hurdle 18 → EVA -600bp → Rejected
    expect(resolveApprovalLevel(12, 18, matrix, 'EVA')).toBe('Rejected');
  });
  it('falls back to DEFAULT_EVA_BANDS when matrix lacks eva fields', () => {
    const noEvaMatrix: ApprovalMatrixConfig = { autoApprovalThreshold: 15, l1Threshold: 10, l2Threshold: 5 };
    expect(resolveApprovalLevel(15, 12, noEvaMatrix, 'EVA')).toBe('Auto');
  });
});

describe('resolveApprovalLevel — RAROC mode (legacy)', () => {
  it('auto-approves when RAROC >= 15%', () => {
    expect(resolveApprovalLevel(16, 12, matrix, 'RAROC')).toBe('Auto');
  });
  it('L1 when RAROC in [10%, 15%)', () => {
    expect(resolveApprovalLevel(12, 18, matrix, 'RAROC')).toBe('L1_Manager');
  });
  it('L2 when RAROC in [5%, 10%)', () => {
    expect(resolveApprovalLevel(7, 12, matrix, 'RAROC')).toBe('L2_Committee');
  });
  it('rejected when RAROC < 5%', () => {
    expect(resolveApprovalLevel(3, 12, matrix, 'RAROC')).toBe('Rejected');
  });
  it('RAROC ignores hurdle rate (legacy behavior)', () => {
    // Same RAROC, different hurdles → same tier in RAROC mode
    expect(resolveApprovalLevel(12, 8, matrix, 'RAROC')).toBe('L1_Manager');
    expect(resolveApprovalLevel(12, 18, matrix, 'RAROC')).toBe('L1_Manager');
  });
});

describe('computeEvaBp', () => {
  it('returns EVA in basis points', () => {
    expect(computeEvaBp(15, 12)).toBe(300);
    expect(computeEvaBp(10, 12)).toBe(-200);
    expect(computeEvaBp(12, 12)).toBe(0);
  });
  it('rounds fractional bps', () => {
    expect(computeEvaBp(12.125, 12)).toBe(13); // 12.5 → 13 (round half-up on +), lib may round to even
  });
});

describe('DEFAULT_EVA_BANDS invariants', () => {
  it('auto > L1 > L2', () => {
    expect(DEFAULT_EVA_BANDS.autoApprovalEvaBp).toBeGreaterThan(DEFAULT_EVA_BANDS.l1EvaBp);
    expect(DEFAULT_EVA_BANDS.l1EvaBp).toBeGreaterThan(DEFAULT_EVA_BANDS.l2EvaBp);
  });
});
