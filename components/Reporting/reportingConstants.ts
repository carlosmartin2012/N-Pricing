export type SubTab =
  | 'OVERVIEW'
  | 'FUNDING_CURVES'
  | 'BEHAVIOUR_FOCUS'
  | 'MATURITY_LADDER'
  | 'CURRENCY_GAP'
  | 'NII_SENSITIVITY'
  | 'PNL_ATTRIBUTION'
  | 'EXECUTIVE'
  | 'PRICING_ANALYTICS'
  | 'PORTFOLIO_SNAPSHOTS'
  | 'VINTAGE'
  | 'BACKTEST'
  | 'PORTFOLIO_REVIEW'
  | 'CUSTOM_DASHBOARD';

export interface TabDefinition {
  key: SubTab;
  label: string;
  /** Tailwind color class used for the active state */
  activeColor: 'cyan' | 'emerald' | 'purple';
}

/** Grouped tab bar definitions — order matches the original rendering. */
export const TAB_GROUPS: TabDefinition[][] = [
  [
    { key: 'OVERVIEW', label: 'FTP Overview', activeColor: 'cyan' },
    { key: 'FUNDING_CURVES', label: 'Funding Curves', activeColor: 'cyan' },
    { key: 'BEHAVIOUR_FOCUS', label: 'Behavioural Impact', activeColor: 'cyan' },
  ],
  [
    { key: 'MATURITY_LADDER', label: 'Pipeline Repricing', activeColor: 'emerald' },
    { key: 'CURRENCY_GAP', label: 'FTP by Currency', activeColor: 'emerald' },
    { key: 'NII_SENSITIVITY', label: 'Pricing Drift', activeColor: 'emerald' },
  ],
  [
    { key: 'PNL_ATTRIBUTION', label: 'FTP Attribution', activeColor: 'purple' },
    { key: 'EXECUTIVE', label: 'Executive', activeColor: 'purple' },
  ],
  [
    { key: 'PRICING_ANALYTICS', label: 'Pricing Analytics', activeColor: 'cyan' },
    { key: 'PORTFOLIO_SNAPSHOTS', label: 'Scenario Repricing', activeColor: 'cyan' },
    { key: 'VINTAGE', label: 'Vintage Analysis', activeColor: 'purple' },
    { key: 'BACKTEST', label: 'Model Backtest', activeColor: 'purple' },
    { key: 'PORTFOLIO_REVIEW', label: 'AI Portfolio Review', activeColor: 'purple' },
  ],
  [
    { key: 'CUSTOM_DASHBOARD', label: 'My Dashboard', activeColor: 'cyan' },
  ],
];

export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_COLLATERAL_TYPE = 'Secured' as const;
export const DEFAULT_CURVE_SHIFT = 0;
export const DEFAULT_SUB_TAB: SubTab = 'OVERVIEW';

export const LCR_OUTFLOW_PRESETS = [5, 25, 40, 100] as const;
export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP'] as const;

/** Color map for active tab highlight (Tailwind classes) */
export const TAB_ACTIVE_STYLES: Record<TabDefinition['activeColor'], string> = {
  cyan: 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]',
  emerald: 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]',
  purple: 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]',
};
