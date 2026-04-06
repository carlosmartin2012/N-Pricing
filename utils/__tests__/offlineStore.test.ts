import { describe, it, expect } from 'vitest';

describe('OfflineStore exports', () => {
  it('should export queue functions', async () => {
    const mod = await import('../offlineStore');
    expect(typeof mod.enqueueMutation).toBe('function');
    expect(typeof mod.getPendingMutations).toBe('function');
    expect(typeof mod.removeMutation).toBe('function');
    expect(typeof mod.getPendingCount).toBe('function');
  });

  it('should export draft functions', async () => {
    const mod = await import('../offlineStore');
    expect(typeof mod.saveDraft).toBe('function');
    expect(typeof mod.getDraft).toBe('function');
    expect(typeof mod.removeDraft).toBe('function');
    expect(typeof mod.getAllDrafts).toBe('function');
  });
});
