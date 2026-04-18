import { describe, it, expect } from 'vitest';
import {
  validateBasicInfo,
  validateConfiguration,
  normaliseShortCode,
  INITIAL_BASIC,
  INITIAL_CONFIG,
  type BasicInfo,
  type ConfigState,
} from '../entityOnboarding/types';

describe('validateBasicInfo', () => {
  it('accepts a well-formed basic info', () => {
    const ok: BasicInfo = { ...INITIAL_BASIC, name: 'NFQ Iberia S.A.', shortCode: 'NFQIB' };
    expect(validateBasicInfo(ok)).toBeNull();
  });

  it('rejects whitespace-only name (trims before checking)', () => {
    const bad: BasicInfo = { ...INITIAL_BASIC, name: '   ', shortCode: 'X' };
    expect(validateBasicInfo(bad)).toMatch(/name is required/i);
  });

  it('rejects empty short code', () => {
    const bad: BasicInfo = { ...INITIAL_BASIC, name: 'X', shortCode: '' };
    expect(validateBasicInfo(bad)).toMatch(/short code is required/i);
  });

  it('rejects short code longer than 6 chars', () => {
    const bad: BasicInfo = { ...INITIAL_BASIC, name: 'X', shortCode: 'SEVEN77' };
    expect(validateBasicInfo(bad)).toMatch(/6 characters or fewer/);
  });

  it('rejects lowercase short code (must be normalised before calling)', () => {
    const bad: BasicInfo = { ...INITIAL_BASIC, name: 'X', shortCode: 'nfq' };
    expect(validateBasicInfo(bad)).toMatch(/uppercase alphanumeric/);
  });

  it('rejects short code with punctuation', () => {
    const bad: BasicInfo = { ...INITIAL_BASIC, name: 'X', shortCode: 'NF-ES' };
    expect(validateBasicInfo(bad)).toMatch(/uppercase alphanumeric/);
  });
});

describe('validateConfiguration', () => {
  it('accepts the default thresholds (the demo flow depends on this staying valid)', () => {
    expect(validateConfiguration(INITIAL_CONFIG)).toBeNull();
  });

  it('rejects non-numeric thresholds without crashing', () => {
    const bad: ConfigState = { ...INITIAL_CONFIG, l1: 'abc' };
    expect(validateConfiguration(bad)).toMatch(/valid numbers/);
  });

  it('rejects zero or negative thresholds', () => {
    const zero: ConfigState = { ...INITIAL_CONFIG, autoApproval: '0' };
    expect(validateConfiguration(zero)).toMatch(/positive/);
    const neg: ConfigState = { ...INITIAL_CONFIG, l1: '-100' };
    expect(validateConfiguration(neg)).toMatch(/positive/);
  });

  it('enforces ordering auto < L1 < L2 (catches mis-ordered committee setups)', () => {
    const autoOverflow: ConfigState = {
      ...INITIAL_CONFIG,
      autoApproval: '5000000',
      l1: '2000000',
    };
    expect(validateConfiguration(autoOverflow)).toMatch(/less than L1/);

    const l1Overflow: ConfigState = { ...INITIAL_CONFIG, l1: '20000000', l2: '10000000' };
    expect(validateConfiguration(l1Overflow)).toMatch(/less than L2/);
  });

  it('rejects equal thresholds — "<" not "<=" — because committee boundaries must be distinct', () => {
    const equalAutoL1: ConfigState = { ...INITIAL_CONFIG, autoApproval: '2000000', l1: '2000000' };
    expect(validateConfiguration(equalAutoL1)).toMatch(/less than L1/);
  });
});

describe('normaliseShortCode', () => {
  it('uppercases the input', () => {
    expect(normaliseShortCode('nfqib')).toBe('NFQIB');
  });

  it('truncates to 6 chars to match the validation rule', () => {
    expect(normaliseShortCode('toolong-for-a-short-code')).toBe('TOOLON');
  });

  it('is idempotent on well-formed codes', () => {
    expect(normaliseShortCode('NFQ-ES')).toBe('NFQ-ES');
  });
});
