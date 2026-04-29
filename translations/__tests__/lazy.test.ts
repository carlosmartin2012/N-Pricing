import { describe, expect, it, beforeEach } from 'vitest';
import {
  loadNamespaceTranslations,
  __resetNamespaceCache,
} from '../lazy';

describe('loadNamespaceTranslations', () => {
  beforeEach(() => {
    __resetNamespaceCache();
  });

  it('resolves the English shared pack with prefixed keys', async () => {
    const pack = await loadNamespaceTranslations('shared', 'en');
    expect(pack.sharedSave).toBe('Save');
    expect(pack.sharedCancel).toBe('Cancel');
  });

  it('resolves the Spanish shared pack', async () => {
    const pack = await loadNamespaceTranslations('shared', 'es');
    expect(pack.sharedSave).toBe('Guardar');
    expect(pack.sharedCancel).toBe('Cancelar');
  });

  it('falls back to English for locales without a dedicated file', async () => {
    const pack = await loadNamespaceTranslations('shared', 'pt');
    expect(pack.sharedSave).toBe('Save');
  });

  it('caches the resolved pack so repeated calls return the same reference', async () => {
    const a = await loadNamespaceTranslations('shared', 'en');
    const b = await loadNamespaceTranslations('shared', 'en');
    expect(a).toBe(b);
  });

  it('isolates the cache per locale (en vs es do not collide)', async () => {
    const en = await loadNamespaceTranslations('shared', 'en');
    const es = await loadNamespaceTranslations('shared', 'es');
    expect(en).not.toBe(es);
    expect(en.sharedSave).not.toBe(es.sharedSave);
  });

  it('isolates the cache per namespace (shared vs pricing do not collide)', async () => {
    const shared = await loadNamespaceTranslations('shared', 'en');
    const pricing = await loadNamespaceTranslations('pricing', 'en');
    expect(shared).not.toBe(pricing);
  });

  it('loads each available namespace without runtime error', async () => {
    const ns = ['clv', 'commercial', 'pricing', 'governance', 'insights', 'system', 'shared'] as const;
    for (const n of ns) {
      const pack = await loadNamespaceTranslations(n, 'en');
      expect(pack).toBeTruthy();
      expect(typeof pack).toBe('object');
    }
  });
});
