import type { Placement } from '../hooks/useTooltipPosition';

export interface WalkthroughStep {
  id: string;
  /**
   * CSS selector of the DOM element to spotlight. Leave empty / omit
   * together with `centered: true` to render a modal-style card with no
   * anchor — used by the business-flow tour, where each step explains a
   * whole section rather than a single element.
   */
  targetSelector: string;
  titleKey: string;
  descriptionKey: string;
  placement: Placement;
  /** If set, navigate to this view before highlighting the target */
  view?: string;
  highlightPadding?: number;
  /**
   * Render as a centered modal card instead of a tooltip. When true the
   * overlay ignores `targetSelector` and `placement`.
   */
  centered?: boolean;
  /** Optional Lucide icon name (only applied to centered cards). */
  iconKey?: 'welcome' | 'commercial' | 'pricing' | 'portfolio' | 'analytics' | 'config' | 'governance' | 'finish';
  /** Optional eyebrow shown above the title on centered cards. */
  eyebrowKey?: string;
}

export interface WalkthroughTour {
  id: string;
  steps: WalkthroughStep[];
}

export const MAIN_TOUR: WalkthroughTour = {
  id: 'main-tour',
  steps: [
    {
      id: 'sidebar',
      targetSelector: '[data-tour="sidebar-nav"]',
      titleKey: 'walkthrough_sidebar',
      descriptionKey: 'walkthrough_sidebarDesc',
      placement: 'right',
      highlightPadding: 8,
    },
    {
      id: 'deal-input',
      targetSelector: '[data-tour="deal-input"]',
      titleKey: 'walkthrough_dealInput',
      descriptionKey: 'walkthrough_dealInputDesc',
      placement: 'right',
      view: 'CALCULATOR',
    },
    {
      id: 'levers',
      targetSelector: '[data-tour="deal-levers"]',
      titleKey: 'walkthrough_levers',
      descriptionKey: 'walkthrough_leversDesc',
      placement: 'right',
      view: 'CALCULATOR',
    },
    {
      id: 'deal-config',
      targetSelector: '[data-tour="deal-config-toggle"]',
      titleKey: 'walkthrough_dealConfig',
      descriptionKey: 'walkthrough_dealConfigDesc',
      placement: 'bottom',
      view: 'CALCULATOR',
    },
    {
      id: 'methodology',
      targetSelector: '[data-tour="methodology-panel"]',
      titleKey: 'walkthrough_methodology',
      descriptionKey: 'walkthrough_methodologyDesc',
      placement: 'left',
      view: 'CALCULATOR',
    },
    {
      id: 'receipt',
      targetSelector: '[data-tour="pricing-receipt"]',
      titleKey: 'walkthrough_receipt',
      descriptionKey: 'walkthrough_receiptDesc',
      placement: 'left',
      view: 'CALCULATOR',
    },
    {
      id: 'raroc',
      targetSelector: '[data-tour="receipt-raroc"]',
      titleKey: 'walkthrough_raroc',
      descriptionKey: 'walkthrough_rarocDesc',
      placement: 'left',
      view: 'CALCULATOR',
    },
    {
      id: 'save-deal',
      targetSelector: '[data-tour="save-deal"]',
      titleKey: 'walkthrough_saveDeal',
      descriptionKey: 'walkthrough_saveDealDesc',
      placement: 'top',
      view: 'CALCULATOR',
    },
    {
      id: 'curves',
      targetSelector: '[data-tour="market-data-panel"]',
      titleKey: 'walkthrough_curves',
      descriptionKey: 'walkthrough_curvesDesc',
      placement: 'bottom',
      view: 'MARKET_DATA',
    },
    {
      id: 'config',
      targetSelector: '[data-tour="config-panel"]',
      titleKey: 'walkthrough_config',
      descriptionKey: 'walkthrough_configDesc',
      placement: 'bottom',
      view: 'METHODOLOGY',
    },
  ],
};

/** Trader tour — pricing-first: calculator, receipt, blotter */
export const TRADER_TOUR: WalkthroughTour = {
  id: 'trader-tour',
  steps: [
    MAIN_TOUR.steps[0], // sidebar
    MAIN_TOUR.steps[1], // deal input
    MAIN_TOUR.steps[2], // levers
    MAIN_TOUR.steps[3], // deal config
    MAIN_TOUR.steps[4], // methodology
    MAIN_TOUR.steps[5], // receipt
    {
      id: 'blotter',
      targetSelector: '[data-testid="nav-BLOTTER"]',
      titleKey: 'walkthrough_blotter',
      descriptionKey: 'walkthrough_blotterDesc',
      placement: 'right',
    },
  ],
};

/** Risk Manager tour — governance-first: config, approval, shocks */
export const RISK_MANAGER_TOUR: WalkthroughTour = {
  id: 'risk-manager-tour',
  steps: [
    MAIN_TOUR.steps[0], // sidebar
    MAIN_TOUR.steps[7], // config
    {
      id: 'governance',
      targetSelector: '[data-testid="nav-METHODOLOGY"]',
      titleKey: 'walkthrough_governance',
      descriptionKey: 'walkthrough_governanceDesc',
      placement: 'right',
    },
    {
      id: 'shocks',
      targetSelector: '[data-testid="nav-SHOCKS"]',
      titleKey: 'walkthrough_shocks',
      descriptionKey: 'walkthrough_shocksDesc',
      placement: 'right',
    },
    MAIN_TOUR.steps[6], // curves
    MAIN_TOUR.steps[5], // receipt
  ],
};

/** Auditor tour — read-only: audit log, blotter, reporting */
export const AUDITOR_TOUR: WalkthroughTour = {
  id: 'auditor-tour',
  steps: [
    MAIN_TOUR.steps[0], // sidebar
    {
      id: 'audit-log',
      targetSelector: '[data-testid="nav-AUDIT_LOG"]',
      titleKey: 'walkthrough_auditLog',
      descriptionKey: 'walkthrough_auditLogDesc',
      placement: 'right',
    },
    {
      id: 'reporting',
      targetSelector: '[data-testid="nav-REPORTING"]',
      titleKey: 'walkthrough_reporting',
      descriptionKey: 'walkthrough_reportingDesc',
      placement: 'right',
    },
    {
      id: 'blotter-readonly',
      targetSelector: '[data-testid="nav-BLOTTER"]',
      titleKey: 'walkthrough_blotterReadonly',
      descriptionKey: 'walkthrough_blotterReadonlyDesc',
      placement: 'right',
    },
  ],
};

/**
 * Business-flow tour — post-login welcome. Seven centered pop-up cards
 * walking the user through the six business stages that match the sidebar
 * grouping (Commercial → Pricing → Portfolio → Analytics → Engine Config →
 * Governance), plus an opening hero and a closing CTA. No DOM anchoring:
 * each card gives a stage-level mental model before the user dives into
 * any specific screen.
 */
export const BUSINESS_FLOW_TOUR: WalkthroughTour = {
  id: 'business-flow-tour',
  steps: [
    {
      id: 'bf-welcome',
      targetSelector: '',
      titleKey: 'walkthrough_bf_welcome',
      descriptionKey: 'walkthrough_bf_welcomeDesc',
      eyebrowKey: 'walkthrough_bf_welcomeEyebrow',
      placement: 'top',
      centered: true,
      iconKey: 'welcome',
    },
    {
      id: 'bf-commercial',
      targetSelector: '',
      titleKey: 'walkthrough_bf_commercial',
      descriptionKey: 'walkthrough_bf_commercialDesc',
      eyebrowKey: 'walkthrough_bf_stage1',
      placement: 'top',
      centered: true,
      iconKey: 'commercial',
      view: 'CUSTOMER_360',
    },
    {
      id: 'bf-pricing',
      targetSelector: '',
      titleKey: 'walkthrough_bf_pricing',
      descriptionKey: 'walkthrough_bf_pricingDesc',
      eyebrowKey: 'walkthrough_bf_stage2',
      placement: 'top',
      centered: true,
      iconKey: 'pricing',
      view: 'CALCULATOR',
    },
    {
      id: 'bf-portfolio',
      targetSelector: '',
      titleKey: 'walkthrough_bf_portfolio',
      descriptionKey: 'walkthrough_bf_portfolioDesc',
      eyebrowKey: 'walkthrough_bf_stage3',
      placement: 'top',
      centered: true,
      iconKey: 'portfolio',
      view: 'BLOTTER',
    },
    {
      id: 'bf-analytics',
      targetSelector: '',
      titleKey: 'walkthrough_bf_analytics',
      descriptionKey: 'walkthrough_bf_analyticsDesc',
      eyebrowKey: 'walkthrough_bf_stage4',
      placement: 'top',
      centered: true,
      iconKey: 'analytics',
      view: 'REPORTING',
    },
    {
      id: 'bf-engine-config',
      targetSelector: '',
      titleKey: 'walkthrough_bf_engineConfig',
      descriptionKey: 'walkthrough_bf_engineConfigDesc',
      eyebrowKey: 'walkthrough_bf_stage5',
      placement: 'top',
      centered: true,
      iconKey: 'config',
      view: 'METHODOLOGY',
    },
    {
      id: 'bf-governance',
      targetSelector: '',
      titleKey: 'walkthrough_bf_governance',
      descriptionKey: 'walkthrough_bf_governanceDesc',
      eyebrowKey: 'walkthrough_bf_stage6',
      placement: 'top',
      centered: true,
      iconKey: 'governance',
      view: 'ESCALATIONS',
    },
    {
      id: 'bf-finish',
      targetSelector: '',
      titleKey: 'walkthrough_bf_finish',
      descriptionKey: 'walkthrough_bf_finishDesc',
      eyebrowKey: 'walkthrough_bf_finishEyebrow',
      placement: 'top',
      centered: true,
      iconKey: 'finish',
      view: 'CALCULATOR',
    },
  ],
};

export const ALL_TOURS: Record<string, WalkthroughTour> = {
  'main-tour': MAIN_TOUR,
  'trader-tour': TRADER_TOUR,
  'risk-manager-tour': RISK_MANAGER_TOUR,
  'auditor-tour': AUDITOR_TOUR,
  'business-flow-tour': BUSINESS_FLOW_TOUR,
};

/** Get the recommended tour for a user role */
export function getRecommendedTourId(role: string): string {
  switch (role) {
    case 'Trader': return 'trader-tour';
    case 'Risk_Manager': return 'risk-manager-tour';
    case 'Auditor': return 'auditor-tour';
    default: return 'main-tour';
  }
}

/**
 * First-login recommended tour — shown once per browser, cleared when the
 * user completes or skips. See WalkthroughContext for storage key.
 */
export const FIRST_LOGIN_TOUR_ID = 'business-flow-tour';
