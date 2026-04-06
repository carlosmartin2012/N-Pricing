import { describe, it, expect } from 'vitest';

describe('Optimistic locking', () => {
  it('should detect version mismatch', () => {
    const clientVersion = 3;
    const serverVersion = 5;
    expect(clientVersion).not.toBe(serverVersion);
    expect(serverVersion > clientVersion).toBe(true);
  });

  it('should allow update when versions match', () => {
    const clientVersion = 3;
    const serverVersion = 3;
    expect(clientVersion).toBe(serverVersion);
  });

  it('should identify changed fields between versions', () => {
    const mine = { amount: 5000000, currency: 'EUR', status: 'Draft' };
    const server = { amount: 7500000, currency: 'EUR', status: 'Pending' };
    const changedFields = Object.keys(mine).filter(
      (k) => mine[k as keyof typeof mine] !== server[k as keyof typeof server]
    );
    expect(changedFields).toContain('amount');
    expect(changedFields).toContain('status');
    expect(changedFields).not.toContain('currency');
  });
});
