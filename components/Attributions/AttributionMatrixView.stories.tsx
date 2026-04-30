import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import AttributionMatrixView from './AttributionMatrixView';
import { UIProvider } from '../../contexts/UIContext';
import type { AttributionMatrix } from '../../types/attributions';

/**
 * Storybook variants for AttributionMatrixView (Ola 8 Bloque B).
 */

const ENTITY = '00000000-0000-0000-0000-000000000099';

const MATRIX_BANCO_TIPO: AttributionMatrix = {
  entityId: ENTITY,
  levels: [
    { id: 'office',    entityId: ENTITY, name: 'Director Oficina',  parentId: null,     levelOrder: 1, rbacRole: 'BranchManager',   metadata: {}, active: true, createdAt: '', updatedAt: '' },
    { id: 'zone',      entityId: ENTITY, name: 'Zona',              parentId: 'office', levelOrder: 2, rbacRole: 'ZoneManager',     metadata: {}, active: true, createdAt: '', updatedAt: '' },
    { id: 'territory', entityId: ENTITY, name: 'Territorial',       parentId: 'zone',   levelOrder: 3, rbacRole: 'RegionalManager', metadata: {}, active: true, createdAt: '', updatedAt: '' },
    { id: 'committee', entityId: ENTITY, name: 'Comité de Riesgos', parentId: 'territory', levelOrder: 4, rbacRole: 'Committee',     metadata: {}, active: true, createdAt: '', updatedAt: '' },
  ],
  thresholds: [
    { id: 't1', entityId: ENTITY, levelId: 'office',    scope: { product: ['loan'], segment: ['SME'] }, deviationBpsMax: 5,  rarocPpMin: 14,  volumeEurMax: 100_000,    activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
    { id: 't2', entityId: ENTITY, levelId: 'zone',      scope: { product: ['loan'] },                  deviationBpsMax: 15, rarocPpMin: 12,  volumeEurMax: 500_000,    activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
    { id: 't3', entityId: ENTITY, levelId: 'territory', scope: {},                                       deviationBpsMax: 30, rarocPpMin: 10,  volumeEurMax: 2_000_000,  activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
    { id: 't4', entityId: ENTITY, levelId: 'committee', scope: {},                                       deviationBpsMax: 100, rarocPpMin: 7,  volumeEurMax: 50_000_000, activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
  ],
  loadedAt: '2026-04-30T10:00:00Z',
};

function withSeededCache(matrix: AttributionMatrix | null) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['attributions', 'matrix'], matrix);
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
  title: 'Attributions/AttributionMatrixView',
  component: AttributionMatrixView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AttributionMatrixView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Matriz típica de banco (4 niveles: Oficina → Zona → Territorial → Comité). */
export const TypicalBank: Story = {
  decorators: [withSeededCache(MATRIX_BANCO_TIPO)],
};

/** Tenant nuevo — la matriz está vacía y se ve el banner instructivo. */
export const Empty: Story = {
  decorators: [withSeededCache({
    entityId: ENTITY, levels: [], thresholds: [], loadedAt: '2026-04-30T10:00:00Z',
  })],
};

/** Banco mediano (sólo Oficina + Comité) — modelo flexible N-ario. */
export const TwoLevels: Story = {
  decorators: [withSeededCache({
    entityId: ENTITY,
    levels: [
      { id: 'office',    entityId: ENTITY, name: 'Director Oficina', parentId: null,     levelOrder: 1, rbacRole: 'BranchManager', metadata: {}, active: true, createdAt: '', updatedAt: '' },
      { id: 'committee', entityId: ENTITY, name: 'Comité',           parentId: 'office', levelOrder: 2, rbacRole: 'Committee',     metadata: {}, active: true, createdAt: '', updatedAt: '' },
    ],
    thresholds: [
      { id: 't1', entityId: ENTITY, levelId: 'office',    scope: {}, deviationBpsMax: 10,  rarocPpMin: 13, volumeEurMax: 250_000,    activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
      { id: 't2', entityId: ENTITY, levelId: 'committee', scope: {}, deviationBpsMax: 100, rarocPpMin: 7,  volumeEurMax: 25_000_000, activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
    ],
    loadedAt: '2026-04-30T10:00:00Z',
  })],
};
