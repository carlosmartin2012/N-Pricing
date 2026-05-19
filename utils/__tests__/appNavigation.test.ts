import { describe, it, expect } from 'vitest';
import { viewToPath, pathToView, getAllRoutePaths, buildMainNavItems, buildBottomNavItems, buildAuxDestinations } from '../../appNavigation';
import { getTranslations } from '../../translations';
import type { ViewState } from '../../types';

describe('appNavigation routing helpers', () => {
  describe('viewToPath', () => {
    it('maps every known view to a path', () => {
      const views: ViewState[] = [
        'CONTROL_ROOM', 'CALCULATOR', 'RAROC', 'SHOCKS', 'BLOTTER', 'ACCOUNTING',
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
      expect(pathToView('/control-room')).toBe('CONTROL_ROOM');
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
      const t = getTranslations('en');
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
    const t = getTranslations('en');
    const items = buildMainNavItems(t);

    it('uses the 4-hub operating taxonomy', () => {
      const sections = Array.from(new Set(items.map((i) => i.section).filter(Boolean)));
      // Order matters: Today → Relationship Cockpit → Pricing Cockpit → Data & Ops Hub → Governance Hub → Assistant
      expect(sections).toEqual([
        'Today', 'Relationship Cockpit', 'Pricing Cockpit', 'Data & Ops Hub', 'Governance Hub', 'Assistant',
      ]);
    });

    it('keeps Calculator as the per-deal entry point and routes specialist tabs to AUX', () => {
      const pricingIds = items.filter((i) => i.section === 'Pricing Cockpit').map((i) => i.id);
      // Calculator is the single per-deal workflow entry (Deal / RAROC /
      // Stress / What-If live as tabs INSIDE it). BLOTTER lists deals.
      // STRESS_PRICING stays because it operates at portfolio level (EBA
      // scenarios across all priceable deals), not per-deal.
      expect(pricingIds).toContain('CALCULATOR');
      expect(pricingIds).toContain('BLOTTER');
      expect(pricingIds).toContain('STRESS_PRICING');
      // SHOCKS / RAROC / WHAT_IF are reachable via Cmd+K (aux) and via
      // the in-Calculator tab bar — not as first-class sidebar items.
      expect(pricingIds).not.toContain('SHOCKS');
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

    it('routes RECONCILIATION under Governance Hub (controller workflow, not data input)', () => {
      const recon = items.find((i) => i.id === 'RECONCILIATION');
      expect(recon?.section).toBe('Governance Hub');
      expect(recon?.path).toBe('/reconciliation');
      expect(recon?.label).toBe('FTP Reconciliation');
    });

    it('keeps stable section keys while rendering localized section labels', () => {
      const spanishItems = buildMainNavItems(getTranslations('es'));
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
    const t = getTranslations('en');
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

    it('Governance Hub keeps 4 daily entries (incl. controller-grade FTP Reconciliation)', () => {
      const governance = items.filter((i) => i.section === 'Governance Hub');
      expect(governance).toHaveLength(4);
      expect(governance.map((i) => i.id).sort()).toEqual([
        'APPROVALS',
        'DISCIPLINE',
        'RECONCILIATION',
        'REPORTING',
      ]);
    });

    it('Data & Ops Hub holds 3 input-only entries (Market Data + Market Benchmarks + Methodology)', () => {
      const dataOps = items.filter((i) => i.section === 'Data & Ops Hub');
      expect(dataOps.map((i) => i.id).sort()).toEqual([
        'MARKET_BENCHMARKS',
        'MARKET_DATA',
        'METHODOLOGY',
      ]);
    });

    it('main sidebar holds at most 15 daily entries', () => {
      // Density floor — alerta si alguien añade entries sin pasar por
      // density review. Specialist destinations belong in AUX.
      expect(items.length).toBeLessThanOrEqual(15);
    });
  });

  describe('AUX destinations', () => {
    it('includes ACCOUNTING after its demotion from main sidebar', () => {
      const aux = buildAuxDestinations(getTranslations('en'));
      const accounting = aux.find((d) => d.id === 'ACCOUNTING');
      expect(accounting).toBeDefined();
      expect(accounting?.path).toBe('/accounting');
    });

    it('includes ESCALATIONS + ATTRIBUTION_MATRIX after Ola 10.7 demotion', () => {
      const aux = buildAuxDestinations(getTranslations('en'));
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
      const aux = buildAuxDestinations(getTranslations('en'));
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
      const aux = buildAuxDestinations(getTranslations('es'));
      const accounting = aux.find((d) => d.id === 'ACCOUNTING');
      expect(accounting?.label).toBe('Libro contable');
      expect(accounting?.sublabel).toContain('Tesorería');
    });
  });

  describe('round-trip consistency', () => {
    it('viewToPath → pathToView returns the canonical view', () => {
      const canonicalViews: ViewState[] = [
        'CONTROL_ROOM', 'CALCULATOR', 'RAROC', 'SHOCKS', 'BLOTTER', 'ACCOUNTING',
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
