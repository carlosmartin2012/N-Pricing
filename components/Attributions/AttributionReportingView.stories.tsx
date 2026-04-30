import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import AttributionReportingView from './AttributionReportingView';
import { UIProvider } from '../../contexts/UIContext';
import type { AttributionReportingSummary } from '../../utils/attributions/attributionReporter';

/**
 * Storybook variants for AttributionReportingView (Ola 8 Bloque C).
 *
 * Pre-seed la cache con queryKeys.attributions.reportingSummary(windowDays)
 * para evitar HTTP — render determinista en cada variante.
 */

const ENTITY = '00000000-0000-0000-0000-000000000099';

const SUMMARY_RICH: AttributionReportingSummary = {
  generatedAt:    '2026-04-30T10:00:00Z',
  windowDays:     90,
  totalDecisions: 162,
  byLevel: [
    {
      levelId: 'office',
      level: { id: 'office', entityId: ENTITY, name: 'Director Oficina', parentId: null, levelOrder: 1, rbacRole: 'BranchManager', metadata: {}, active: true, createdAt: '', updatedAt: '' },
      stats: { count: 82, totalEur: 7_200_000, meanEur: 87_805, meanRarocPp: 14.8, meanDeviationBps: -2.1 },
      byDecision: { approved: 70, rejected: 7, escalated: 5, expired: 0, reverted: 0 },
    },
    {
      levelId: 'zone',
      level: { id: 'zone', entityId: ENTITY, name: 'Zona', parentId: 'office', levelOrder: 2, rbacRole: 'ZoneManager', metadata: {}, active: true, createdAt: '', updatedAt: '' },
      stats: { count: 31, totalEur: 12_400_000, meanEur: 400_000, meanRarocPp: 12.3, meanDeviationBps: -9.4 },
      byDecision: { approved: 24, rejected: 4, escalated: 3, expired: 0, reverted: 0 },
    },
    {
      levelId: 'committee',
      level: { id: 'committee', entityId: ENTITY, name: 'Comité', parentId: 'zone', levelOrder: 3, rbacRole: 'Committee', metadata: {}, active: true, createdAt: '', updatedAt: '' },
      stats: { count: 5, totalEur: 18_200_000, meanEur: 3_640_000, meanRarocPp: 8.7, meanDeviationBps: -45.2 },
      byDecision: { approved: 3, rejected: 1, escalated: 0, expired: 1, reverted: 0 },
    },
  ],
  byUser: [
    { userId: 'director.norte@bm.es', stats: { count: 62, totalEur: 4_900_000, meanEur: 79_032, meanRarocPp: 12.4, meanDeviationBps: -13.8 }, pctAtLimit: 0.72, approvedRate: 0.88 },
    { userId: 'director.sur@bm.es',   stats: { count: 41, totalEur: 3_200_000, meanEur: 78_048, meanRarocPp: 13.6, meanDeviationBps: -7.2 },  pctAtLimit: 0.43, approvedRate: 0.82 },
  ],
  funnel: {
    total: 162, approved: 130, rejected: 12, escalated: 15, expired: 5, reverted: 0,
    approvedRate: 130/162, rejectedRate: 12/162, expiredRate: 5/162,
  },
  drift: [
    { userId: 'director.norte@bm.es', count: 62, meanDeviationBps: -13.8, pctAtLimit: 0.72, severity: 'breached', reasons: ['mean drift 13.8 bps ≥ 10', '72% decisions at limit ≥ 50%'] },
    { userId: 'director.sur@bm.es',   count: 41, meanDeviationBps: -7.2,  pctAtLimit: 0.43, severity: 'warning',  reasons: ['mean drift 7.2 bps ≥ 5', '43% decisions at limit ≥ 30%'] },
  ],
  timeToDecision: null,
};

const SUMMARY_CLEAN: AttributionReportingSummary = {
  ...SUMMARY_RICH,
  totalDecisions: 25,
  drift: [],
  funnel: { total: 25, approved: 22, rejected: 1, escalated: 1, expired: 1, reverted: 0, approvedRate: 0.88, rejectedRate: 0.04, expiredRate: 0.04 },
};

const SUMMARY_EMPTY: AttributionReportingSummary = {
  generatedAt:    '2026-04-30T10:00:00Z',
  windowDays:     90,
  totalDecisions: 0,
  byLevel: [], byUser: [], drift: [],
  funnel: { total: 0, approved: 0, rejected: 0, escalated: 0, expired: 0, reverted: 0, approvedRate: 0, rejectedRate: 0, expiredRate: 0 },
  timeToDecision: null,
};

function withSeededCache(summary: AttributionReportingSummary | null) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['attributions', 'reporting', 'summary', 90], summary);
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', minHeight: '100vh' }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Attributions/AttributionReportingView',
  component: AttributionReportingView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AttributionReportingView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tenant con drift breached + warning, 4 levels, decisiones reales. */
export const Rich: Story = {
  decorators: [withSeededCache(SUMMARY_RICH)],
};

/** Sin drift signals — operación sana. */
export const Clean: Story = {
  decorators: [withSeededCache(SUMMARY_CLEAN)],
};

/** Tenant nuevo / sin actividad. */
export const Empty: Story = {
  decorators: [withSeededCache(SUMMARY_EMPTY)],
};
