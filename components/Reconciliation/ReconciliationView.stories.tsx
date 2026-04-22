import type { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router';
import ReconciliationView from './ReconciliationView';
import { UIProvider } from '../../contexts/UIContext';
import { EntityProvider } from '../../contexts/EntityContext';
import type { EntryPair, ReconciliationSummary } from '../../types/reconciliation';
import type { ReconciliationSummaryResponse } from '../../api/reconciliation';

/**
 * Stories for ReconciliationView — the controller-grade BU↔Treasury
 * matching surface. Seeds the React Query cache under
 * ['reconciliation', 'summary', <period>] with a shaped response so the
 * 4 KPI tiles, the filter chips and the table all render synchronously.
 *
 * Four variants capture the controller's day:
 *   - Clean book: everything matched, 0 unmatched.
 *   - Mixed: matched + amount_mismatch + rate_mismatch + bu_only.
 *   - All mismatches: worst-case for triage screenshots.
 *   - Empty book: zero entries (month has just started).
 */

function entry(overrides: Partial<EntryPair> = {}): EntryPair {
  return {
    dealId: 'D-000',
    clientId: 'C-0',
    clientName: 'Demo Client',
    businessUnit: 'BU_CORP',
    productType: 'Corporate_Loan',
    bu:       { dealId: 'D-000', amountEur: 1_000_000, currency: 'EUR', ratePct: 4.25, postedAt: '2026-04-12' },
    treasury: { dealId: 'D-000', amountEur: 1_000_000, currency: 'EUR', ratePct: 4.25, postedAt: '2026-04-12' },
    matchStatus: 'matched',
    amountDeltaEur: 0,
    rateDeltaPct: 0,
    hint: null,
    ...overrides,
  };
}

function buildSummary(pairs: EntryPair[], period = '2026-04'): ReconciliationSummary {
  const byStatus: ReconciliationSummary['byStatus'] = {
    matched: 0, amount_mismatch: 0, rate_mismatch: 0, currency_mismatch: 0,
    bu_only: 0, treasury_only: 0, unknown: 0,
  };
  let amountMismatchEur = 0;
  let maxSingleDeltaEur = 0;
  for (const p of pairs) {
    byStatus[p.matchStatus] += 1;
    if (p.matchStatus === 'amount_mismatch') {
      amountMismatchEur += p.amountDeltaEur;
      if (p.amountDeltaEur > maxSingleDeltaEur) maxSingleDeltaEur = p.amountDeltaEur;
    }
  }
  return {
    asOfPeriod: period,
    computedAt: '2026-04-23T10:00:00Z',
    totalEntries: pairs.length,
    matched: byStatus.matched,
    unmatched: pairs.length - byStatus.matched - byStatus.unknown,
    unknown: byStatus.unknown,
    amountMismatchEur: Number(amountMismatchEur.toFixed(2)),
    maxSingleDeltaEur: Number(maxSingleDeltaEur.toFixed(2)),
    byStatus,
  };
}

function withSeededCache(pairs: EntryPair[], period = '2026-04') {
  return (Story: React.ComponentType) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const response: ReconciliationSummaryResponse = {
      summary: buildSummary(pairs, period),
      pairs,
    };
    qc.setQueryData(['reconciliation', 'summary', period], response);
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EntityProvider>
            <UIProvider>
              <div style={{ background: '#0e0e0e', minHeight: '100vh' }}>
                <Story />
              </div>
            </UIProvider>
          </EntityProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Reconciliation/ReconciliationView',
  component: ReconciliationView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ReconciliationView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CleanBookAllMatched: Story = {
  decorators: [withSeededCache([
    entry({ dealId: 'D-001', clientName: 'Acme Industrial SA' }),
    entry({ dealId: 'D-002', clientName: 'Beta Solar Energy SL', businessUnit: 'BU_MID', productType: 'ESG_Green_Loan' }),
    entry({ dealId: 'D-003', clientName: 'Gamma Healthcare',     businessUnit: 'BU_MID', productType: 'Trade_Finance' }),
  ])],
};

export const MixedBook: Story = {
  decorators: [withSeededCache([
    entry({ dealId: 'D-001', clientName: 'Acme Industrial SA' }),
    entry({
      dealId: 'D-002', clientName: 'Beta Solar Energy SL',
      matchStatus: 'amount_mismatch', amountDeltaEur: 2500,
      bu:       { dealId: 'D-002', amountEur: 3_000_000, currency: 'EUR', ratePct: 3.6, postedAt: '2026-04-15' },
      treasury: { dealId: 'D-002', amountEur: 3_002_500, currency: 'EUR', ratePct: 3.6, postedAt: '2026-04-15' },
      hint: 'Amount delta €2500 — expected tolerance €1',
    }),
    entry({
      dealId: 'D-003', clientName: 'Gamma Healthcare',
      matchStatus: 'rate_mismatch', rateDeltaPct: 0.15,
      bu:       { dealId: 'D-003', amountEur: 800_000, currency: 'EUR', ratePct: 3.00, postedAt: '2026-04-14' },
      treasury: { dealId: 'D-003', amountEur: 800_000, currency: 'EUR', ratePct: 3.15, postedAt: '2026-04-14' },
      hint: 'Rate delta 0.150pp — expected tolerance 0.01pp',
    }),
    entry({
      dealId: 'D-004', clientName: 'Delta Trade',
      matchStatus: 'bu_only',
      treasury: null,
      hint: 'Treasury mirror missing — open Treasury Ops',
    }),
  ])],
};

export const AllMismatches: Story = {
  decorators: [withSeededCache([
    entry({
      dealId: 'D-A', clientName: 'Alpha Corp',
      matchStatus: 'amount_mismatch', amountDeltaEur: 45_000,
      bu:       { dealId: 'D-A', amountEur: 5_000_000, currency: 'EUR', ratePct: 4.2, postedAt: '2026-04-01' },
      treasury: { dealId: 'D-A', amountEur: 4_955_000, currency: 'EUR', ratePct: 4.2, postedAt: '2026-04-01' },
      hint: 'Amount delta €45000 — expected tolerance €1',
    }),
    entry({
      dealId: 'D-B', clientName: 'Bravo Holdings',
      matchStatus: 'currency_mismatch',
      bu:       { dealId: 'D-B', amountEur: 2_000_000, currency: 'EUR', ratePct: 3.8, postedAt: '2026-04-02' },
      treasury: { dealId: 'D-B', amountEur: 2_000_000, currency: 'USD', ratePct: 3.8, postedAt: '2026-04-02' },
      hint: 'Currencies differ: BU=EUR, Treasury=USD',
    }),
    entry({
      dealId: 'D-C', clientName: 'Charlie Mining',
      matchStatus: 'rate_mismatch', rateDeltaPct: 0.25,
      bu:       { dealId: 'D-C', amountEur: 1_500_000, currency: 'EUR', ratePct: 4.50, postedAt: '2026-04-03' },
      treasury: { dealId: 'D-C', amountEur: 1_500_000, currency: 'EUR', ratePct: 4.25, postedAt: '2026-04-03' },
      hint: 'Rate delta 0.250pp — expected tolerance 0.01pp',
    }),
    entry({
      dealId: 'D-D', clientName: 'Delta Biotech',
      matchStatus: 'bu_only',
      treasury: null,
      hint: 'Treasury mirror missing — open Treasury Ops',
    }),
    entry({
      dealId: 'D-E', clientName: 'Epsilon Retail',
      matchStatus: 'treasury_only',
      bu: null,
      hint: 'BU did not post — check booking workflow',
    }),
  ])],
};

export const EmptyBook: Story = {
  decorators: [withSeededCache([])],
};
