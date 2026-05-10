import { describe, it, expect } from 'vitest';
import { viewToPath, pathToView, getAllRoutePaths, buildMainNavItems, buildBottomNavItems, buildAuxDestinations } from '../../appNavigation';
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

  describe('cockpit taxonomy', () => {
    const t = translations.en;
    const items = buildMainNavItems(t);

    it('uses the 4-hub operating taxonomy', () => {
      const sections = Array.from(new Set(items.map((i) => i.section).filter(Boolean)));
      // Order matters: Relationship Cockpit → Pricing Cockpit → Data & Ops Hub → Governance Hub → Assistant
      expect(sections).toEqual([
        'Relationship Cockpit', 'Pricing Cockpit', 'Data & Ops Hub', 'Governance Hub', 'Assistant',
      ]);
    });

    it('keeps daily pricing surfaces in the sidebar and specialist labs in AUX', () => {
      const pricingIds = items.filter((i) => i.section === 'Pricing Cockpit').map((i) => i.id);
      expect(pricingIds).toContain('CALCULATOR');
      expect(pricingIds).toContain('SHOCKS');
      expect(pricingIds).toContain('STRESS_PRICING');
      expect(pricingIds).toContain('BLOTTER');
      expect(pricingIds).not.toContain('RAROC');
      expect(pricingIds).not.toContain('WHAT_IF');
    });

    it('renames CUSTOMER_360 label to "Clients"', () => {
      const clients = items.find((i) => i.id === 'CUSTOMER_360');
      expect(clients?.label).toBe('Clients');
      expect(clients?.section).toBe('Relationship Cockpit');
    });

    it('renames TARGET_GRID label to "Targets"', () => {
      const targets = items.find((i) => i.id === 'TARGET_GRID');
      expect(targets?.label).toBe('Targets');
    });

    it('moves METHODOLOGY to Data & Ops Hub', () => {
      const methodology = items.find((i) => i.id === 'METHODOLOGY');
      expect(methodology?.section).toBe('Data & Ops Hub');
    });

    it('keeps DISCIPLINE in the Governance Hub', () => {
      const discipline = items.find((i) => i.id === 'DISCIPLINE');
      expect(discipline?.section).toBe('Governance Hub');
    });

    it('demotes ACCOUNTING from sidebar to AUX (reachable via ⌘K only)', () => {
      const main = items.find((i) => i.id === 'ACCOUNTING');
      expect(main).toBeUndefined();
    });

    it('includes PIPELINE under Relationship Cockpit (Phase 6.8)', () => {
      const pipeline = items.find((i) => i.id === 'PIPELINE');
      expect(pipeline?.section).toBe('Relationship Cockpit');
      expect(pipeline?.path).toBe('/pipeline');
    });

    it('includes RECONCILIATION under Data & Ops Hub (Phase 6.9)', () => {
      const recon = items.find((i) => i.id === 'RECONCILIATION');
      expect(recon?.section).toBe('Data & Ops Hub');
      expect(recon?.path).toBe('/reconciliation');
      expect(recon?.label).toBe('FTP Reconciliation');
    });

    it('keeps stable section keys while rendering localized section labels', () => {
      const spanishItems = buildMainNavItems(translations.es);
      const clients = spanishItems.find((i) => i.id === 'CUSTOMER_360');
      const market = spanishItems.find((i) => i.id === 'MARKET_DATA');
      expect(clients?.section).toBe('Relationship Cockpit');
      expect(clients?.sectionLabel).toBe('Relaciones');
      expect(clients?.label).toBe('Clientes');
      expect(market?.section).toBe('Data & Ops Hub');
      expect(market?.sectionLabel).toBe('Datos de mercado');
    });
  });

  // -----------------------------------------------------------------
  // Ola 10.7 — Sidebar density pass (28 → 26 entries).
  // -----------------------------------------------------------------
  describe('cockpit density pass', () => {
    const t = translations.en;
    const items = buildMainNavItems(t);

    it('demotes ESCALATIONS from sidebar to AUX (edge case, no daily inbox)', () => {
      expect(items.find((i) => i.id === 'ESCALATIONS')).toBeUndefined();
    });

    it('demotes ATTRIBUTION_MATRIX from sidebar to AUX (config, not daily)', () => {
      expect(items.find((i) => i.id === 'ATTRIBUTION_MATRIX')).toBeUndefined();
    });

    it('demotes ATTRIBUTION_REPORTING from sidebar to AUX (specialist analytics output)', () => {
      expect(items.find((i) => i.id === 'ATTRIBUTION_REPORTING')).toBeUndefined();
    });

    it('Governance Hub keeps 3 daily entries', () => {
      const governance = items.filter((i) => i.section === 'Governance Hub');
      expect(governance).toHaveLength(3);
      expect(governance.map((i) => i.id).sort()).toEqual([
        'APPROVALS',
        'DISCIPLINE',
        'REPORTING',
      ]);
    });

    it('Data & Ops Hub keeps 3 operational entries', () => {
      const dataOps = items.filter((i) => i.section === 'Data & Ops Hub');
      expect(dataOps.map((i) => i.id).sort()).toEqual([
        'MARKET_DATA',
        'METHODOLOGY',
        'RECONCILIATION',
      ]);
    });

    it('main sidebar holds at most 14 daily entries', () => {
      // Density floor — alerta si alguien añade entries sin pasar por
      // density review. Specialist destinations belong in AUX.
      expect(items.length).toBeLessThanOrEqual(14);
    });
  });

  describe('AUX destinations', () => {
    it('includes ACCOUNTING after its demotion from main sidebar', () => {
      const aux = buildAuxDestinations(translations.en);
      const accounting = aux.find((d) => d.id === 'ACCOUNTING');
      expect(accounting).toBeDefined();
      expect(accounting?.path).toBe('/accounting');
    });

    it('includes ESCALATIONS + ATTRIBUTION_MATRIX after Ola 10.7 demotion', () => {
      const aux = buildAuxDestinations(translations.en);
      const escalations = aux.find((d) => d.id === 'ESCALATIONS');
      const matrix = aux.find((d) => d.id === 'ATTRIBUTION_MATRIX');
      expect(escalations?.path).toBe('/escalations');
      expect(matrix?.path).toBe('/attributions/matrix');
      // Crítico: la URL sigue funcionando aunque el item esté en AUX.
      // pathToView debe seguir resolviendo /escalations y /attributions/matrix.
      expect(pathToView('/escalations')).toBe('ESCALATIONS');
      expect(pathToView('/attributions/matrix')).toBe('ATTRIBUTION_MATRIX');
    });

    it('includes specialist views demoted by the cockpit density pass', () => {
      const aux = buildAuxDestinations(translations.en);
      expect(aux.map((d) => d.id).sort()).toEqual(expect.arrayContaining([
        'ACCOUNTING',
        'ATTRIBUTION_REPORTING',
        'BEHAVIOURAL',
        'BUDGET_RECONCILIATION',
        'CAMPAIGNS',
        'DOSSIERS',
        'MODEL_INVENTORY',
        'RAROC',
        'WHAT_IF',
      ]));
    });

    it('builds auxiliary labels from the active language', () => {
      const aux = buildAuxDestinations(translations.es);
      const accounting = aux.find((d) => d.id === 'ACCOUNTING');
      expect(accounting?.label).toBe('Libro contable');
      expect(accounting?.sublabel).toContain('Tesorería');
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
