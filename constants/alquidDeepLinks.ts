/**
 * Deep links to Alquid — NFQ's ALM/IBSM platform.
 *
 * Context: per PIVOT_PLAN.md §Bloque B, ALM-adjacent capabilities
 * (MaturityLadder, CurrencyGap, NIISensitivity) are delegated to Alquid
 * when the deprecation flag is on. This file holds the URL mapping.
 *
 * URLs are expected to be confirmed with the piloto before enabling the flag.
 * Until confirmed, the placeholder `/alm/<path>` renders a "coming from Alquid"
 * fallback that at least preserves the CTA.
 */

export const ALQUID_DEEP_LINK_KEYS = [
  'MATURITY_LADDER',
  'CURRENCY_GAP',
  'NII_SENSITIVITY',
] as const;

export type AlquidFeature = (typeof ALQUID_DEEP_LINK_KEYS)[number];

/**
 * Default relative paths. The base URL (VITE_ALQUID_BASE_URL) is prepended
 * at runtime. If VITE_ALQUID_BASE_URL is missing, deep links are disabled
 * and the MovedToAlquidPanel renders a "contact your admin" message.
 */
export const ALQUID_DEEP_LINK_PATHS: Record<AlquidFeature, string> = {
  MATURITY_LADDER: '/alm/maturity-ladder',
  CURRENCY_GAP: '/alm/currency-gap',
  NII_SENSITIVITY: '/alm/nii-sensitivity',
};

export const ALQUID_FEATURE_LABELS: Record<AlquidFeature, { title: string; blurb: string }> = {
  MATURITY_LADDER: {
    title: 'Maturity Ladder',
    blurb: 'Balance-sheet maturity profile consolidated in Alquid.',
  },
  CURRENCY_GAP: {
    title: 'Currency Gap',
    blurb: 'Multi-currency position & gap analysis consolidated in Alquid.',
  },
  NII_SENSITIVITY: {
    title: 'NII Sensitivity',
    blurb: 'Net interest income sensitivity to rate shocks consolidated in Alquid.',
  },
};

export const getAlquidDeepLink = (feature: AlquidFeature): string | null => {
  const base = (import.meta.env.VITE_ALQUID_BASE_URL as string | undefined)?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}${ALQUID_DEEP_LINK_PATHS[feature]}`;
};

export const isAlmDeprecationEnabled = (): boolean => {
  return String(import.meta.env.VITE_NPRICING_DEPRECATE_ALM ?? '').toLowerCase() === 'true';
};
