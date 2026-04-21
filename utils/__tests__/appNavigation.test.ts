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

  describe('Option B taxonomy', () => {
    const t = translations.en;
    const items = buildMainNavItems(t);

    it('uses the 5-bucket customer-centric taxonomy', () => {
      const sections = Array.from(new Set(items.map((i) => i.section).filter(Boolean)));
      // Order matters: Relationships → Pricing → Market Data → Insights → Governance → Assistant
      expect(sections).toEqual([
        'Relationships', 'Pricing', 'Market Data', 'Insights', 'Governance', 'Assistant',
      ]);
    });

    it('surfaces the 4 pricing workspaces as first-class entries', () => {
      const pricingIds = items.filter((i) => i.section === 'Pricing').map((i) => i.id);
      expect(pricingIds).toContain('CALCULATOR');
      expect(pricingIds).toContain('RAROC');
      expect(pricingIds).toContain('SHOCKS');
      expect(pricingIds).toContain('WHAT_IF');
    });

    it('renames CUSTOMER_360 label to "Clients"', () => {
      const clients = items.find((i) => i.id === 'CUSTOMER_360');
      expect(clients?.label).toBe('Clients');
      expect(clients?.section).toBe('Relationships');
    });

    it('renames TARGET_GRID label to "Targets"', () => {
      const targets = items.find((i) => i.id === 'TARGET_GRID');
      expect(targets?.label).toBe('Targets');
    });

    it('moves METHODOLOGY to Market Data bucket', () => {
      const methodology = items.find((i) => i.id === 'METHODOLOGY');
      expect(methodology?.section).toBe('Market Data');
    });

    it('promotes DISCIPLINE to Insights (no longer aux-only)', () => {
      const discipline = items.find((i) => i.id === 'DISCIPLINE');
      expect(discipline?.section).toBe('Insights');
    });

    it('demotes ACCOUNTING from sidebar to AUX (reachable via ⌘K only)', () => {
      const main = items.find((i) => i.id === 'ACCOUNTING');
      expect(main).toBeUndefined();
    });

    it('includes PIPELINE under Relationships (Phase 6.8)', () => {
      const pipeline = items.find((i) => i.id === 'PIPELINE');
      expect(pipeline?.section).toBe('Relationships');
      expect(pipeline?.path).toBe('/pipeline');
    });
  });

  describe('AUX_DESTINATIONS', () => {
    it('includes ACCOUNTING after its demotion from main sidebar', async () => {
      const { AUX_DESTINATIONS } = await import('../../appNavigation');
      const accounting = AUX_DESTINATIONS.find((d) => d.id === 'ACCOUNTING');
      expect(accounting).toBeDefined();
      expect(accounting?.path).toBe('/accounting');
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
