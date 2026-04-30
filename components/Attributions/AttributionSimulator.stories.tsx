import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import AttributionSimulator from './AttributionSimulator';
import { UIProvider } from '../../contexts/UIContext';
import type { AttributionMatrix, AttributionQuote } from '../../types/attributions';

/**
 * Storybook variants for AttributionSimulator (Ola 8 Bloque B).
 *
 * El componente puede recibir `matrix` por props (paridad cliente↔server)
 * o cargarla via useAttributionMatrixQuery. En las stories pasamos matrix
 * directamente para evitar HTTP — feedback determinista y sin flicker.
 */

const ENTITY = '00000000-0000-0000-0000-000000000099';

const FIXTURE_MATRIX: AttributionMatrix = {
  entityId: ENTITY,
  levels: [
    { id: 'office',     entityId: ENTITY, name: 'Oficina',     parentId: null,     levelOrder: 1, rbacRole: 'BranchManager',   metadata: {}, active: true, createdAt: '', updatedAt: '' },
    { id: 'zone',       entityId: ENTITY, name: 'Zona',        parentId: 'office', levelOrder: 2, rbacRole: 'ZoneManager',     metadata: {}, active: true, createdAt: '', updatedAt: '' },
    { id: 'committee',  entityId: ENTITY, name: 'Comité',      parentId: 'zone',   levelOrder: 3, rbacRole: 'Committee',        metadata: {}, active: true, createdAt: '', updatedAt: '' },
  ],
  thresholds: [
    { id: 'tof', entityId: ENTITY, levelId: 'office',    scope: {}, deviationBpsMax: 5,  rarocPpMin: 14, volumeEurMax: 100_000,    activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
    { id: 'tzn', entityId: ENTITY, levelId: 'zone',      scope: {}, deviationBpsMax: 15, rarocPpMin: 12, volumeEurMax: 500_000,    activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
    { id: 'tco', entityId: ENTITY, levelId: 'committee', scope: {}, deviationBpsMax: 50, rarocPpMin: 8,  volumeEurMax: 10_000_000, activeFrom: '2026-01-01', activeTo: null, isActive: true, createdAt: '', updatedAt: '' },
  ],
  loadedAt: '2026-04-30T10:00:00Z',
};

const QUOTE_HAPPY: AttributionQuote = {
  finalClientRateBps: 490,
  standardRateBps:    492,
  hardFloorRateBps:   400,
  rarocPp:            14.5,
  volumeEur:          80_000,
  scope:              { product: ['loan'], segment: ['SME'], currency: ['EUR'], tenorMaxMonths: 24 },
};

const QUOTE_NEEDS_ZONE: AttributionQuote = { ...QUOTE_HAPPY, finalClientRateBps: 480, rarocPp: 13, volumeEur: 250_000 };
const QUOTE_BELOW_FLOOR: AttributionQuote = { ...QUOTE_HAPPY, finalClientRateBps: 350 };

function withProviders(): (Story: React.ComponentType) => React.ReactElement {
  return (Story) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh', maxWidth: 980 }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Attributions/AttributionSimulator',
  component: AttributionSimulator,
  parameters: { layout: 'fullscreen' },
  decorators: [withProviders()],
} satisfies Meta<typeof AttributionSimulator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Quote dentro del threshold de Oficina — within_threshold, sin niveles evitados. */
export const HappyPath: Story = {
  args: {
    quote: QUOTE_HAPPY,
    matrix: FIXTURE_MATRIX,
    onApply:           (input) => console.info('apply', input),
    onRequestApproval: (input) => console.info('request approval', input),
  },
};

/** Quote que requiere Zona (deviation y volumen superan Oficina). */
export const NeedsZone: Story = {
  args: {
    quote: QUOTE_NEEDS_ZONE,
    matrix: FIXTURE_MATRIX,
  },
};

/** Quote bajo hard floor — UI deshabilita Request approval con warning. */
export const BelowHardFloor: Story = {
  args: {
    quote: QUOTE_BELOW_FLOOR,
    matrix: FIXTURE_MATRIX,
    onRequestApproval: () => undefined,
  },
};

/** Variante compacta — usada como widget embebido en Calculator. */
export const Compact: Story = {
  args: {
    quote: QUOTE_HAPPY,
    matrix: FIXTURE_MATRIX,
    compact: true,
  },
};

/** Matriz vacía — banner instructivo para tenants sin niveles. */
export const EmptyMatrix: Story = {
  args: {
    quote: QUOTE_HAPPY,
    matrix: { entityId: ENTITY, levels: [], thresholds: [], loadedAt: '2026-04-30T10:00:00Z' },
  },
};
