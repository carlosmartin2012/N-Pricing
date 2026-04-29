import { describe, it, expect } from 'vitest';
import { tourIdForRole } from '../roleOnboarding';
import { ALL_TOURS } from '../../constants/walkthroughTours';

describe('tourIdForRole', () => {
  it('maps Trader → trader-tour', () => {
    expect(tourIdForRole('Trader')).toBe('trader-tour');
  });
  it('maps Risk_Manager → risk-manager-tour', () => {
    expect(tourIdForRole('Risk_Manager')).toBe('risk-manager-tour');
  });
  it('maps Auditor → auditor-tour', () => {
    expect(tourIdForRole('Auditor')).toBe('auditor-tour');
  });
  it('maps Admin → main-tour', () => {
    expect(tourIdForRole('Admin')).toBe('main-tour');
  });
  it('returns null for unknown / null / undefined / empty roles', () => {
    expect(tourIdForRole(null)).toBeNull();
    expect(tourIdForRole(undefined)).toBeNull();
    expect(tourIdForRole('')).toBeNull();
    expect(tourIdForRole('Visitor')).toBeNull();
  });

  it('every returned tour id resolves to a real WalkthroughTour in ALL_TOURS', () => {
    // Guards against typos: if someone renames a tour without updating
    // this mapping, the test fails immediately.
    const ids = (['Trader', 'Risk_Manager', 'Auditor', 'Admin'] as const)
      .map(tourIdForRole)
      .filter((x): x is string => x !== null);
    for (const id of ids) {
      expect(ALL_TOURS[id]).toBeDefined();
    }
  });
});
