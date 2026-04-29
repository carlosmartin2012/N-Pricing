/**
 * Lazy translation loaders — Ola 7 Bloque D foundations.
 *
 * The namespace barrel (`translations/index.ts`) imports every
 * (namespace × locale) pack eagerly so the existing sync API
 * (`sharedTranslations(lang)`) keeps working. This module adds an
 * orthogonal **async** entry point that lets consumers opt into
 * code-splitting per locale: only the locale the user has selected
 * lands in their initial chunk.
 *
 * Vite resolves these dynamic imports at build time to separate
 * chunks. The static analyser in vite-plugin-react understands the
 * literal-template form `import('./<ns>.<lang>.ts')` so we keep the
 * resolvers fully typed.
 *
 * Usage:
 *
 *     const pack = await loadNamespaceTranslations('shared', 'es');
 *     pack.sharedSave; // → 'Guardar'
 *
 * For React, wrap the component that needs it in `React.lazy` or
 * `Suspense`-boundary based async loading; this module only handles
 * the I/O.
 */

import type { Language } from '../translations';

import type { ClvTranslationKeys } from './clv.en';
import type { CommercialTranslationKeys } from './commercial.en';
import type { PricingTranslationKeys } from './pricing.en';
import type { GovernanceTranslationKeys } from './governance.en';
import type { InsightsTranslationKeys } from './insights.en';
import type { SystemTranslationKeys } from './system.en';
import type { SharedTranslationKeys } from './shared.en';

export interface NamespacePackByName {
  clv:        ClvTranslationKeys;
  commercial: CommercialTranslationKeys;
  pricing:    PricingTranslationKeys;
  governance: GovernanceTranslationKeys;
  insights:   InsightsTranslationKeys;
  system:     SystemTranslationKeys;
  shared:     SharedTranslationKeys;
}

export type NamespaceName = keyof NamespacePackByName;

// Each loader resolves to the matching pack export. The factory map
// uses literal dynamic imports so Vite emits one chunk per pack.
const LOADERS = {
  clv: {
    en: () => import('./clv.en').then((m) => m.clvEn),
    es: () => import('./clv.es').then((m) => m.clvEs),
  },
  commercial: {
    en: () => import('./commercial.en').then((m) => m.commercialEn),
    es: () => import('./commercial.es').then((m) => m.commercialEs),
  },
  pricing: {
    en: () => import('./pricing.en').then((m) => m.pricingEn),
    es: () => import('./pricing.es').then((m) => m.pricingEs),
  },
  governance: {
    en: () => import('./governance.en').then((m) => m.governanceEn),
    es: () => import('./governance.es').then((m) => m.governanceEs),
  },
  insights: {
    en: () => import('./insights.en').then((m) => m.insightsEn),
    es: () => import('./insights.es').then((m) => m.insightsEs),
  },
  system: {
    en: () => import('./system.en').then((m) => m.systemEn),
    es: () => import('./system.es').then((m) => m.systemEs),
  },
  shared: {
    en: () => import('./shared.en').then((m) => m.sharedEn),
    es: () => import('./shared.es').then((m) => m.sharedEs),
  },
} as const;

// In-memory cache so a second await for the same (ns, lang) does not
// re-trigger the import-graph resolution. Keyed by `${ns}:${lang}`.
const cache = new Map<string, unknown>();

/**
 * Loads a namespace pack for the given locale. Resolves with the
 * cached value when called twice for the same (ns, lang).
 *
 * Falls back to the English pack for locales without a dedicated
 * file (matching the synchronous `byLang` semantics in
 * `translations/index.ts`).
 */
export async function loadNamespaceTranslations<N extends NamespaceName>(
  ns: N,
  lang: Language,
): Promise<NamespacePackByName[N]> {
  const targetLang = lang === 'es' ? 'es' : 'en';
  const key = `${ns}:${targetLang}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit as NamespacePackByName[N];

  const loader = LOADERS[ns][targetLang as 'en' | 'es'];
  const pack = await loader();
  cache.set(key, pack);
  return pack as NamespacePackByName[N];
}

/**
 * Test helper — clears the cache so each test starts with a clean
 * slate. Not exported from the barrel; only imported in test files.
 */
export function __resetNamespaceCache(): void {
  cache.clear();
}
