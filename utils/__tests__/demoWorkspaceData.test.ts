import { describe, expect, it } from 'vitest';
import { buildDemoWorkspaceData } from '../demoWorkspaceData';

describe('demoWorkspaceData', () => {
  it('builds coherent governance and reporting artifacts for demo mode', () => {
    const demoData = buildDemoWorkspaceData({
      approvalMatrix: {
        autoApprovalThreshold: 15,
        l1Threshold: 10,
        l2Threshold: 5,
      },
    });

    expect(demoData.marketDataSources.length).toBeGreaterThan(0);
    expect(demoData.methodologyVersions.length).toBeGreaterThan(0);
    expect(demoData.portfolioSnapshots.length).toBeGreaterThan(0);
    expect(demoData.pricingDossiers.length).toBeGreaterThan(0);
    expect(demoData.approvalTasks.length).toBeGreaterThan(0);
    expect(demoData.portfolioSnapshots[0]?.dealIds.length).toBeGreaterThan(0);
    expect(demoData.pricingDossiers[0]?.groundedContext?.portfolioSnapshotId).toBeTruthy();
  });
});
