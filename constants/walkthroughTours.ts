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

export const ALL_TOURS: Record<string, WalkthroughTour> = {
  'main-tour': MAIN_TOUR,
};
