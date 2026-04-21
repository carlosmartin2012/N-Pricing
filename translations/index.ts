/**
 * Namespaced translations barrel.
 *
 * Transitional: re-exports the monolithic `translations.ts` plus the new
 * per-namespace packs. As namespaces migrate, they move into this directory
 * and the monolith shrinks.
 *
 * Consumers that want the new keys today:
 *
 *   import { clvTranslations } from './translations/index';
 *   clvTranslations('es').clvProjectionTitle;
 *
 * Consumers using the legacy API keep calling `getTranslations(lang)` from
 * the root `translations.ts` — both coexist during the migration window.
 */

import { clvEn } from './clv.en';
import { clvEs } from './clv.es';
import { commercialEn } from './commercial.en';
import { commercialEs } from './commercial.es';
import { pricingEn } from './pricing.en';
import { pricingEs } from './pricing.es';
import { governanceEn } from './governance.en';
import { governanceEs } from './governance.es';
import { insightsEn } from './insights.en';
import { insightsEs } from './insights.es';
import type { Language } from '../translations';

function byLang<T>(en: T, es: T): Record<Language, T> {
  return { en, es, pt: en, fr: en, de: en };
}

const CLV_BY_LANG        = byLang(clvEn, clvEs);
const COMMERCIAL_BY_LANG = byLang(commercialEn, commercialEs);
const PRICING_BY_LANG    = byLang(pricingEn, pricingEs);
const GOVERNANCE_BY_LANG = byLang(governanceEn, governanceEs);
const INSIGHTS_BY_LANG   = byLang(insightsEn, insightsEs);

export function clvTranslations(lang: Language): typeof clvEn {
  return CLV_BY_LANG[lang] ?? clvEn;
}

export function commercialTranslations(lang: Language): typeof commercialEn {
  return COMMERCIAL_BY_LANG[lang] ?? commercialEn;
}

export function pricingTranslations(lang: Language): typeof pricingEn {
  return PRICING_BY_LANG[lang] ?? pricingEn;
}

export function governanceTranslations(lang: Language): typeof governanceEn {
  return GOVERNANCE_BY_LANG[lang] ?? governanceEn;
}

export function insightsTranslations(lang: Language): typeof insightsEn {
  return INSIGHTS_BY_LANG[lang] ?? insightsEn;
}

export {
  clvEn, clvEs,
  commercialEn, commercialEs,
  pricingEn, pricingEs,
  governanceEn, governanceEs,
  insightsEn, insightsEs,
};
export type { ClvTranslationKeys } from './clv.en';
export type { CommercialTranslationKeys } from './commercial.en';
export type { PricingTranslationKeys } from './pricing.en';
export type { GovernanceTranslationKeys } from './governance.en';
export type { InsightsTranslationKeys } from './insights.en';
