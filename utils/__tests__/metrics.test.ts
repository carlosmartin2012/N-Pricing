import { describe, it, expect } from 'vitest';

// We'll test the buffer logic without actual Supabase calls
describe('Metrics buffer', () => {
  it('should export trackMetric function', async () => {
    const { trackMetric } = await import('../metrics');
    expect(typeof trackMetric).toBe('function');
  });

  it('should export convenience helpers', async () => {
    const mod = await import('../metrics');
    expect(typeof mod.trackPricingLatency).toBe('function');
    expect(typeof mod.trackDealVolume).toBe('function');
    expect(typeof mod.trackErrorRate).toBe('function');
    expect(typeof mod.trackReportGeneration).toBe('function');
    expect(typeof mod.flushMetrics).toBe('function');
    expect(typeof mod.stopMetricsFlush).toBe('function');
  });
});
