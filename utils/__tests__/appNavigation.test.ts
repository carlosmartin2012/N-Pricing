import { describe, it, expect } from 'vitest';
import { viewToPath, pathToView, getAllRoutePaths, buildMainNavItems, buildBottomNavItems } from '../../appNavigation';
import { translations } from '../../translations';
import type { ViewState } from '../../types';

describe('appNavigation routing helpers', () => {
  describe('viewToPath', () => {
    it('maps every known view to a path', () => {
      const views: ViewState[] = [
        'CALCULATOR', 'RAROC', 'SHOCKS', 'BLOTTER', 'ACCOUNTING',
        'REPORTING', 'MARKET_DATA', 'METHODOLOGY', 'CONFIG',
        'BEHAVIOURAL', 'AI_LAB', 'USER_MGMT', 'AUDIT_LOG', 'HEALTH', 'MANUAL',
      ];
      for (const v of views) {
        const path = viewToPath(v);
        expect(path).toMatch(/^\//);
        expect(path.length).toBeGreaterThan(1);
      }
    });

    it('returns /pricing as fallback for unknown views', () => {
      expect(viewToPath('NONEXISTENT' as ViewState)).toBe('/pricing');
    });

    it('aliases CONFIG to /methodology (same as METHODOLOGY)', () => {
      expect(viewToPath('CONFIG')).toBe('/methodology');
      expect(viewToPath('METHODOLOGY')).toBe('/methodology');
    });
  });

  describe('pathToView', () => {
    it('resolves all registered paths', () => {
      expect(pathToView('/pricing')).toBe('CALCULATOR');
      expect(pathToView('/blotter')).toBe('BLOTTER');
      expect(pathToView('/raroc')).toBe('RAROC');
      expect(pathToView('/stress-testing')).toBe('SHOCKS');
      expect(pathToView('/analytics')).toBe('REPORTING');
      expect(pathToView('/market-data')).toBe('MARKET_DATA');
      expect(pathToView('/methodology')).toBe('METHODOLOGY');
      expect(pathToView('/behavioural')).toBe('BEHAVIOURAL');
      expect(pathToView('/ai')).toBe('AI_LAB');
      expect(pathToView('/users')).toBe('USER_MGMT');
      expect(pathToView('/audit')).toBe('AUDIT_LOG');
      expect(pathToView('/health')).toBe('HEALTH');
      expect(pathToView('/manual')).toBe('MANUAL');
      expect(pathToView('/accounting')).toBe('ACCOUNTING');
    });

    it('returns CALCULATOR for unknown paths', () => {
      expect(pathToView('/unknown')).toBe('CALCULATOR');
      expect(pathToView('')).toBe('CALCULATOR');
    });
  });

  describe('getAllRoutePaths', () => {
    it('returns unique paths only', () => {
      const routes = getAllRoutePaths();
      const paths = routes.map(r => r.path);
      expect(new Set(paths).size).toBe(paths.length);
    });

    it('includes /methodology once (not duplicated for CONFIG alias)', () => {
      const routes = getAllRoutePaths();
      const methodologyRoutes = routes.filter(r => r.path === '/methodology');
      expect(methodologyRoutes).toHaveLength(1);
    });

    it('covers all main and bottom nav paths', () => {
      const routes = getAllRoutePaths();
      const paths = new Set(routes.map(r => r.path));
      const t = translations.en;
      const main = buildMainNavItems(t);
      const bottom = buildBottomNavItems(t);
      for (const item of [...main, ...bottom]) {
        if (item.path) {
          expect(paths.has(item.path)).toBe(true);
        }
      }
    });
  });

  describe('round-trip consistency', () => {
    it('viewToPath → pathToView returns the canonical view', () => {
      const canonicalViews: ViewState[] = [
        'CALCULATOR', 'RAROC', 'SHOCKS', 'BLOTTER', 'ACCOUNTING',
        'REPORTING', 'MARKET_DATA', 'METHODOLOGY', 'BEHAVIOURAL',
        'AI_LAB', 'USER_MGMT', 'AUDIT_LOG', 'HEALTH', 'MANUAL',
      ];
      for (const v of canonicalViews) {
        const path = viewToPath(v);
        const roundTripped = pathToView(path);
        expect(roundTripped).toBe(v);
      }
    });

    it('CONFIG round-trips to METHODOLOGY (canonical for /methodology)', () => {
      const path = viewToPath('CONFIG');
      expect(pathToView(path)).toBe('METHODOLOGY');
    });
  });
});
