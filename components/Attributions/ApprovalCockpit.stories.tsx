import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ApprovalCockpit from './ApprovalCockpit';
import { UIProvider } from '../../contexts/UIContext';
import type { AttributionDecision, AttributionMatrix } from '../../types/attributions';

/**
 * Storybook variants for ApprovalCockpit (Ola 8 Bloque B).
 *
 * Pre-seed la cache de React Query con el shape exacto de:
 *   - queryKeys.attributions.matrix → AttributionMatrix
 *   - queryKeys.attributions.decisions({}) → { items, pagination }
 *
 * Sin esto, la primera renderización dispararía fetchs reales (que en
 * Storybook tirarían 4xx/CORS).
 */

const ENTITY = '00000000-0000-0000-0000-000000000099';

const MATRIX: AttributionMatrix = {
  entityId: ENTITY,
  levels: [
    { id: 'office',    entityId: ENTITY, name: 'Director Oficina Madrid Centro', parentId: null,     levelOrder: 1, rbacRole: 'BranchManager', metadata: {}, active: true, createdAt: '', updatedAt: '' },
    { id: 'zone',      entityId: ENTITY, name: 'Zona Madrid',                    parentId: 'office', levelOrder: 2, rbacRole: 'ZoneManager',   metadata: {}, active: true, createdAt: '', updatedAt: '' },
    { id: 'committee', entityId: ENTITY, name: 'Comité de Riesgos',              parentId: 'zone',   levelOrder: 3, rbacRole: 'Committee',     metadata: {}, active: true, createdAt: '', updatedAt: '' },
  ],
  thresholds: [],
  loadedAt: '2026-04-30T10:00:00Z',
};

const decision = (over: Partial<AttributionDecision>): AttributionDecision => ({
  id:                  Math.random().toString(36).slice(2, 8),
  entityId:            ENTITY,
  dealId:              'ABC-1234',
  requiredLevelId:     'office',
  decidedByLevelId:    null,
  decidedByUser:       null,
  decision:            'escalated',
  reason:              null,
  pricingSnapshotHash: 'h-' + Math.random().toString(36).slice(2, 12),
  routingMetadata:     { deviationBps: -7.2, rarocPp: 13.8, volumeEur: 80_000, scope: {} },
  decidedAt:           '2026-04-30T08:30:00Z',
  ...over,
});

const PENDING_BANDEJA: AttributionDecision[] = [
  decision({ dealId: 'ABC-1234', requiredLevelId: 'office',    routingMetadata: { deviationBps: -7.2,  rarocPp: 13.8, volumeEur: 80_000,  scope: {} } }),
  decision({ dealId: 'ABC-1235', requiredLevelId: 'office',    routingMetadata: { deviationBps: -3.1,  rarocPp: 16.2, volumeEur: 50_000,  scope: {} } }),
  decision({ dealId: 'ABC-1240', requiredLevelId: 'zone',      routingMetadata: { deviationBps: -12.4, rarocPp: 11.5, volumeEur: 320_000, scope: {} } }),
  decision({ dealId: 'ABC-1245', requiredLevelId: 'committee', routingMetadata: { deviationBps: -120,  rarocPp: 6.2,  volumeEur: 4_500_000, scope: {} } }),
];

function withSeededCache(decisions: AttributionDecision[]) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['attributions', 'matrix'], MATRIX);
    qc.setQueryData(
      ['attributions', 'decisions', { dealId: undefined, levelId: undefined, user: undefined }],
      { items: decisions, pagination: { limit: 200, offset: 0, returned: decisions.length } },
    );
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
  title: 'Attributions/ApprovalCockpit',
  component: ApprovalCockpit,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ApprovalCockpit>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Bandeja con 4 decisiones pendientes — incluye una bajo hard floor que
 *  deshabilita el botón aprobar (tooltip: "Below regulatory floor"). */
export const Populated: Story = {
  decorators: [withSeededCache(PENDING_BANDEJA)],
};

/** Bandeja vacía — empty state ShieldCheck. */
export const Empty: Story = {
  decorators: [withSeededCache([])],
};

/** Solo decisiones que requieren Comité — útil para vista de Risk Officer. */
export const OnlyCommittee: Story = {
  decorators: [withSeededCache([
    decision({ dealId: 'BIG-001', requiredLevelId: 'committee', routingMetadata: { deviationBps: -45,  rarocPp: 9,   volumeEur: 2_500_000, scope: {} } }),
    decision({ dealId: 'BIG-002', requiredLevelId: 'committee', routingMetadata: { deviationBps: -110, rarocPp: 5.5, volumeEur: 6_000_000, scope: {} } }),
  ])],
};
