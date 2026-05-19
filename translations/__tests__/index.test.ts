import { describe, it, expect } from 'vitest';
import {
  clvTranslations,
  commercialTranslations,
  pricingTranslations,
  governanceTranslations,
  insightsTranslations,
  systemTranslations,
  sharedTranslations,
  attributionsTranslations,
  budgetTranslations,
  navigationTranslations,
} from '../index';
import { translations, getTranslations } from '../../translations';
import type { Language } from '../../translations';

/**
 * Smoke tests for the translations barrel.
 *
 * Verifies that every language has a full namespace (keys present, not
 * undefined) and that the EN fallback works for languages without a
 * dedicated pack. This catches the regression "added a key in EN, forgot
 * to add it in ES" at build time.
 */

const PACKS = [
  { name: 'clv',          fn: clvTranslations },
  { name: 'commercial',   fn: commercialTranslations },
  { name: 'pricing',      fn: pricingTranslations },
  { name: 'governance',   fn: governanceTranslations },
  { name: 'insights',     fn: insightsTranslations },
  { name: 'system',       fn: systemTranslations },
  { name: 'shared',       fn: sharedTranslations },
  { name: 'attributions', fn: attributionsTranslations },
  { name: 'budget',       fn: budgetTranslations },
  { name: 'navigation',   fn: navigationTranslations },
];

const LANGS: Language[] = ['en', 'es', 'pt', 'fr', 'de'];

describe('translations barrel', () => {
  for (const { name, fn } of PACKS) {
    describe(`namespace: ${name}`, () => {
      it('returns a non-empty object for every language', () => {
        for (const lang of LANGS) {
          const pack = fn(lang);
          expect(pack).toBeDefined();
          expect(Object.keys(pack).length).toBeGreaterThan(0);
        }
      });

      it('EN and ES packs have the same set of keys (no missing translation)', () => {
        const en = fn('en');
        const es = fn('es');
        const enKeys = Object.keys(en).sort();
        const esKeys = Object.keys(es).sort();
        expect(esKeys).toEqual(enKeys);
      });

      it('falls back to EN for languages without a dedicated pack (pt/fr/de)', () => {
        const en = fn('en');
        const pt = fn('pt');
        const fr = fn('fr');
        const de = fn('de');
        expect(pt).toEqual(en);
        expect(fr).toEqual(en);
        expect(de).toEqual(en);
      });

      it('returns string values only', () => {
        const pack = fn('en');
        for (const [key, value] of Object.entries(pack)) {
          expect(typeof value, `key ${key}`).toBe('string');
          expect(value.length, `key ${key}`).toBeGreaterThan(0);
        }
      });
    });
  }
});

/**
 * Hygiene: keys migrated to a namespace must NOT survive in the monolith.
 * Catches the regression where someone re-adds a `nav*` key in
 * `translations.ts` instead of `translations/navigation.{en,es}.ts`.
 */
describe('monolith hygiene', () => {
  const MIGRATED_KEY_PREFIXES: { ns: string; prefixes: string[] }[] = [
    { ns: 'navigation', prefixes: ['nav'] },
  ];

  for (const { ns, prefixes } of MIGRATED_KEY_PREFIXES) {
    it(`monolith has no keys with prefix [${prefixes.join(', ')}] (migrated to ${ns} namespace)`, () => {
      for (const lang of ['en', 'es'] as const) {
        const bucket = translations[lang];
        const stray = Object.keys(bucket).filter((k) =>
          prefixes.some((p) => k.startsWith(p)),
        );
        expect(stray, `${lang} has stray ${ns} keys still in monolith`).toEqual([]);
      }
    });
  }

  it('getTranslations() merges navigation namespace into the resolved bag', () => {
    const en = getTranslations('en');
    const es = getTranslations('es');
    expect(en.navClients).toBe('Clients');
    expect(es.navClients).toBe('Clientes');
    expect(en.navSectionToday).toBe('Dashboard');
    expect(es.navSectionToday).toBe('Resumen');
  });
});
