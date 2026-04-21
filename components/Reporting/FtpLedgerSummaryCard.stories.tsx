import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router';
import React from 'react';
import FtpLedgerSummaryCard, { type FtpLedgerSummary } from './FtpLedgerSummaryCard';

/**
 * Stories for the FTP Ledger summary card. Three reconciliation
 * variants + a small-volume variant to stress the KPI formatting.
 */

const BASE: FtpLedgerSummary = {
  ftpIncomeMtdEur: 42_300,
  dealsLedgerizedMtd: 12,
  avgTransferRatePct: 6.09,
  mtdGrowthPct: 4.3,
  reconciliationStatus: 'unknown',
};

const meta = {
  title: 'Reporting/FtpLedgerSummaryCard',
  component: FtpLedgerSummaryCard,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ background: '#0e0e0e', padding: 32, minHeight: '100vh', maxWidth: 960 }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof FtpLedgerSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReconciledHealthy: Story = {
  args: {
    summary: {
      ...BASE,
      ftpIncomeMtdEur: 1_480_000,
      dealsLedgerizedMtd: 128,
      mtdGrowthPct: 6.8,
      reconciliationStatus: 'ok',
    },
  },
};

export const Mismatches: Story = {
  args: {
    summary: {
      ...BASE,
      ftpIncomeMtdEur: 980_000,
      dealsLedgerizedMtd: 74,
      mtdGrowthPct: -2.4,
      reconciliationStatus: 'mismatches',
      unmatchedCount: 9,
    },
  },
};

export const UnknownReconciliation: Story = {
  args: {
    summary: BASE,
  },
};

export const EarlyMonthLowVolume: Story = {
  args: {
    summary: {
      ...BASE,
      ftpIncomeMtdEur: 4_200,
      dealsLedgerizedMtd: 5,
      avgTransferRatePct: 5.87,
      mtdGrowthPct: 0,
      reconciliationStatus: 'unknown',
    },
  },
};

export const CustomLink: Story = {
  args: {
    summary: {
      ...BASE,
      reconciliationStatus: 'ok',
    },
    title: 'FTP Reconciliation — September',
    linkLabel: 'Full dossier',
    linkTo: '/reconciliation',
  },
};
