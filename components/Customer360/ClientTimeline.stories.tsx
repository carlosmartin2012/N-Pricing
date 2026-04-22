import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ClientTimeline from './ClientTimeline';
import { UIProvider } from '../../contexts/UIContext';
import type { ClientEvent } from '../../types/clv';

/**
 * Stories for ClientTimeline. The component consumes
 * `useClientTimelineQuery(clientId)` which caches under
 * ['clv', 'timeline', <clientId>]. Pre-seeding that key with
 * `qc.setQueryData` renders the story synchronously without HTTP.
 *
 * Variants cover the three visual states a banker will actually see:
 *   - Empty (no events yet)
 *   - A few events clustered in one month
 *   - A longer horizon spread across multiple months (group-by-month
 *     behaviour of the component visible)
 */

function eventRow(overrides: Partial<ClientEvent> = {}): ClientEvent {
  return {
    id: 'evt-1',
    entityId: 'ent-1',
    clientId: 'demo-1',
    eventType: 'deal_booked',
    eventTs: '2026-04-10T09:00:00Z',
    source: 'pricing',
    dealId: null,
    positionId: null,
    amountEur: 500_000,
    payload: {},
    createdBy: null,
    createdAt: '2026-04-10T09:00:00Z',
    ...overrides,
  };
}

function withSeededCache(events: ClientEvent[]) {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(['clv', 'timeline', 'demo-1'], events);
    return (
      <QueryClientProvider client={qc}>
        <UIProvider>
          <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh', maxWidth: 720 }}>
            <Story />
          </div>
        </UIProvider>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Customer360/ClientTimeline',
  component: ClientTimeline,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ClientTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([])],
};

export const SingleMonth: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([
    eventRow({ id: 'e1', eventType: 'onboarding',       eventTs: '2026-04-02T10:00:00Z', source: 'crm',     amountEur: null, payload: { channel: 'RM' } }),
    eventRow({ id: 'e2', eventType: 'deal_booked',      eventTs: '2026-04-10T10:00:00Z', source: 'pricing', amountEur: 5_000_000, payload: { product: 'Corporate_Loan' } }),
    eventRow({ id: 'e3', eventType: 'contact',          eventTs: '2026-04-15T10:00:00Z', source: 'crm',     amountEur: null, payload: { subject: 'Renewal review' } }),
  ])],
};

export const MultipleMonthsGrouped: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([
    eventRow({ id: 'e1', eventType: 'onboarding',       eventTs: '2025-11-02T09:00:00Z', source: 'crm',     amountEur: null }),
    eventRow({ id: 'e2', eventType: 'deal_booked',      eventTs: '2025-12-15T09:00:00Z', source: 'pricing', amountEur: 3_000_000 }),
    eventRow({ id: 'e3', eventType: 'crosssell_won',    eventTs: '2026-02-08T09:00:00Z', source: 'crm',     amountEur: 1_200_000, payload: { product: 'Cash_Management' } }),
    eventRow({ id: 'e4', eventType: 'price_review',     eventTs: '2026-03-20T09:00:00Z', source: 'ops',     amountEur: null, payload: { kind: 'ltv_recompute', clvPointEur: 1_250_000 } }),
    eventRow({ id: 'e5', eventType: 'contact',          eventTs: '2026-04-05T09:00:00Z', source: 'crm',     amountEur: null, payload: { subject: 'Annual review' } }),
    eventRow({ id: 'e6', eventType: 'committee_review', eventTs: '2026-04-12T09:00:00Z', source: 'ops',     amountEur: null, payload: { decision: 'approved' } }),
  ])],
};

export const ChurnRiskThread: Story = {
  args: { clientId: 'demo-1' },
  decorators: [withSeededCache([
    eventRow({ id: 'e1', eventType: 'claim',           eventTs: '2026-01-18T09:00:00Z', source: 'ops', amountEur: 45_000, payload: { category: 'service' } }),
    eventRow({ id: 'e2', eventType: 'churn_signal',    eventTs: '2026-02-25T09:00:00Z', source: 'ml',  amountEur: null, payload: { score: 0.72, drivers: ['nps_drop'] } }),
    eventRow({ id: 'e3', eventType: 'churn_signal',    eventTs: '2026-03-30T09:00:00Z', source: 'ml',  amountEur: null, payload: { score: 0.85, drivers: ['nps_drop', 'complaint_volume'] } }),
    eventRow({ id: 'e4', eventType: 'deal_cancelled',  eventTs: '2026-04-18T09:00:00Z', source: 'pricing', amountEur: 2_000_000 }),
  ])],
};
