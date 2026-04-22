// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import FtpLedgerSummaryCard, { type FtpLedgerSummary } from '../FtpLedgerSummaryCard';

/**
 * Unit tests for the FTP Ledger summary card.
 *
 * Covers the three reconciliation variants (ok / mismatches / unknown)
 * because they change both the icon tone and the footer hint — exactly
 * the kind of branch-heavy UI where a silent regression is expensive.
 */

function baseSummary(overrides: Partial<FtpLedgerSummary> = {}): FtpLedgerSummary {
  return {
    ftpIncomeMtdEur: 4_200,
    dealsLedgerizedMtd: 5,
    avgTransferRatePct: 6.09,
    mtdGrowthPct: 2.5,
    reconciliationStatus: 'ok',
    ...overrides,
  };
}

function renderCard(summary: FtpLedgerSummary) {
  return render(
    <MemoryRouter>
      <FtpLedgerSummaryCard summary={summary} />
    </MemoryRouter>,
  );
}

describe('FtpLedgerSummaryCard', () => {
  it('renders title and core KPIs', () => {
    renderCard(baseSummary());
    expect(screen.getByText(/FTP Ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/FTP income \(MTD\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Deals ledgerized/i)).toBeInTheDocument();
    expect(screen.getByText(/Avg transfer rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Reconciliation/i)).toBeInTheDocument();
  });

  it('renders the "Open full ledger" link pointing to /reconciliation', () => {
    renderCard(baseSummary());
    const link = screen.getByTestId('ftp-ledger-summary-link');
    expect(link).toHaveAttribute('href', '/reconciliation');
  });

  it('shows positive growth indicator with + sign for positive mtdGrowthPct', () => {
    renderCard(baseSummary({ mtdGrowthPct: 4.3 }));
    expect(screen.getByText(/\+4\.3% vs last month/)).toBeInTheDocument();
  });

  it('shows negative growth without extra + sign', () => {
    renderCard(baseSummary({ mtdGrowthPct: -1.8 }));
    expect(screen.getByText(/-1\.8% vs last month/)).toBeInTheDocument();
  });

  it('renders Reconciled label when status=ok', () => {
    renderCard(baseSummary({ reconciliationStatus: 'ok' }));
    expect(screen.getByText('Reconciled')).toBeInTheDocument();
    expect(screen.getByText(/All BU journal entries match/i)).toBeInTheDocument();
  });

  it('renders Mismatches label + unmatched count when status=mismatches', () => {
    renderCard(baseSummary({ reconciliationStatus: 'mismatches', unmatchedCount: 7 }));
    expect(screen.getByText('Mismatches')).toBeInTheDocument();
    expect(screen.getByText('7 unmatched')).toBeInTheDocument();
    expect(screen.getByText(/do not match their Treasury mirror/i)).toBeInTheDocument();
  });

  it('renders Unknown label + placeholder hint when status=unknown', () => {
    renderCard(baseSummary({ reconciliationStatus: 'unknown' }));
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.getByText(/not yet computed/i)).toBeInTheDocument();
  });

  it('formats avg transfer rate with 2 decimals', () => {
    renderCard(baseSummary({ avgTransferRatePct: 6.1 }));
    expect(screen.getByText('6.10%')).toBeInTheDocument();
  });

  it('accepts a custom title and link path', () => {
    render(
      <MemoryRouter>
        <FtpLedgerSummaryCard
          summary={baseSummary()}
          title="Custom heading"
          linkLabel="Go deep"
          linkTo="/reconciliation"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Custom heading')).toBeInTheDocument();
    const link = screen.getByTestId('ftp-ledger-summary-link');
    expect(link).toHaveAttribute('href', '/reconciliation');
    expect(link).toHaveTextContent(/Go deep/i);
  });
});
