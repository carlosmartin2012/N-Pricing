import { describe, it, expect } from 'vitest';
import * as shim from '../pricing/governance';
import * as ctx from '../pricing/contexts/governance';

/**
 * Shim backward-compatibility smoke test.
 *
 * Pin the invariant that `utils/pricing/governance` (shim) exposes the
 * same public surface as `utils/pricing/contexts/governance` (bounded
 * context). When the shim is eventually deleted, this test is the canary
 * that catches "somebody imported from the shim path and never noticed".
 *
 * If this test fails because the bounded context grew a new export that
 * the shim didn't re-export, add the missing line to the shim and delete
 * the guard once fully migrated.
 */

describe('governance shim backward compatibility', () => {
  it('exposes resolveApprovalLevel identical to the bounded context', () => {
    expect(shim.resolveApprovalLevel).toBe(ctx.resolveApprovalLevel);
  });

  it('exposes DEFAULT_EVA_BANDS identical to the bounded context', () => {
    expect(shim.DEFAULT_EVA_BANDS).toBe(ctx.DEFAULT_EVA_BANDS);
  });

  it('exposes computeEvaBp identical to the bounded context', () => {
    expect(shim.computeEvaBp).toBe(ctx.computeEvaBp);
  });

  it('exposes getGovernanceMode identical to the bounded context', () => {
    expect(shim.getGovernanceMode).toBe(ctx.getGovernanceMode);
  });

  it('shim re-exports every runtime symbol of the bounded context', () => {
    const ctxKeys = Object.keys(ctx).filter((k) => typeof (ctx as Record<string, unknown>)[k] !== 'undefined');
    const shimKeys = Object.keys(shim);
    for (const key of ctxKeys) {
      expect(shimKeys).toContain(key);
    }
  });
});
