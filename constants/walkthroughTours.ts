import type { Placement } from '../hooks/useTooltipPosition';

export interface WalkthroughStep {
  id: string;
  targetSelector: string;
  titleKey: string;
  descriptionKey: string;
  placement: Placement;
  /** If set, navigate to this view before highlighting the target */
  view?: string;
  highlightPadding?: number;
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

export const ALL_TOURS: Record<string, WalkthroughTour> = {
  'main-tour': MAIN_TOUR,
  'trader-tour': TRADER_TOUR,
  'risk-manager-tour': RISK_MANAGER_TOUR,
  'auditor-tour': AUDITOR_TOUR,
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
