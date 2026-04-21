import { describe, it, expect } from 'vitest';
import {
  clvTranslations,
  commercialTranslations,
  pricingTranslations,
  governanceTranslations,
  insightsTranslations,
  systemTranslations,
  sharedTranslations,
} from '../index';
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
  { name: 'clv',        fn: clvTranslations },
  { name: 'commercial', fn: commercialTranslations },
  { name: 'pricing',    fn: pricingTranslations },
  { name: 'governance', fn: governanceTranslations },
  { name: 'insights',   fn: insightsTranslations },
  { name: 'system',     fn: systemTranslations },
  { name: 'shared',     fn: sharedTranslations },
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
