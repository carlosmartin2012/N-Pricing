import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useOptionalCoreData } from '../../contexts/DataContext';

/**
 * Compact deal-context breadcrumb for deep-linked routes like
 * `/deals/:id/timeline`.
 *
 * The header in those routes used to show only "Pricing Cockpit > Deal
 * Timeline" + the deal id hash — a Risk Manager drilling into a deal lost
 * the visible reminder of which client and product they were reviewing.
 *
 * This component sits at the very top of the route content and surfaces
 * the deal's identity (client, product, currency, amount, status) plus a
 * one-click back link to the Blotter.
 *
 * Resolution strategy:
 *
 *   - `deal` prop wins (callers that already have the Transaction in scope
 *     can pass it directly — cheaper, deterministic).
 *   - Otherwise we look up `useData().deals` by id. If the deal isn't in
 *     memory (deep-link cold open), we fall back to the bare id + back
 *     link — never crash, never hide the back affordance.
 */

import type { Transaction } from '../../types';

interface Props {
  dealId: string;
  /** Optional pre-resolved deal. When omitted, looked up in DataContext. */
  deal?: Transaction;
  /** Override the back destination. Defaults to /blotter. */
  backHref?: string;
}

function formatAmount(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || amount === 0) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}bn ${currency}`;
  if (abs >= 1_000_000)     return `${(amount / 1_000_000).toFixed(1)}m ${currency}`;
  if (abs >= 1_000)         return `${(amount / 1_000).toFixed(0)}k ${currency}`;
  return `${Math.round(amount).toLocaleString('en-US')} ${currency}`;
}

const STATUS_BADGE_TONE: Record<string, string> = {
  Booked:           'bg-[var(--nfq-success)]/15 text-[color:var(--nfq-success)]',
  Approved:         'bg-[var(--nfq-success)]/15 text-[color:var(--nfq-success)]',
  Pending:          'bg-[var(--nfq-warning)]/15 text-[color:var(--nfq-warning)]',
  Pending_Approval: 'bg-[var(--nfq-warning)]/15 text-[color:var(--nfq-warning)]',
  Review:           'bg-[var(--nfq-warning)]/15 text-[color:var(--nfq-warning)]',
  Rejected:         'bg-[var(--nfq-danger)]/15 text-[color:var(--nfq-danger)]',
  Draft:            'bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-muted)]',
};

const DealBreadcrumb: React.FC<Props> = ({ dealId, deal: dealProp, backHref = '/blotter' }) => {
  const navigate = useNavigate();
  // Soft lookup — when rendered outside the data shell (deep-linked deal
  // route on cold open, or a test harness without DataProvider), `core`
  // is null and we degrade to the bare id + back link.
  const core = useOptionalCoreData();
  const deal = dealProp ?? core?.deals.find((d) => d.id === dealId);
  const statusTone = deal?.status ? STATUS_BADGE_TONE[deal.status] ?? STATUS_BADGE_TONE.Draft : STATUS_BADGE_TONE.Draft;

  return (
    <nav
      aria-label="Deal context"
      data-testid="deal-breadcrumb"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/40 px-3 py-2 text-xs"
    >
      <button
        type="button"
        onClick={() => navigate(backHref)}
        className="flex items-center gap-1 text-[color:var(--nfq-text-secondary)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
        title="Back to blotter"
        data-testid="deal-breadcrumb-back"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Blotter</span>
      </button>
      <span aria-hidden="true" className="text-[color:var(--nfq-text-faint)]">/</span>
      <span className="font-mono text-[color:var(--nfq-text-primary)]" data-testid="deal-breadcrumb-id">
        {dealId || '—'}
      </span>
      {deal && (
        <>
          <span aria-hidden="true" className="text-[color:var(--nfq-text-faint)]">·</span>
          <span className="text-[color:var(--nfq-text-secondary)]" data-testid="deal-breadcrumb-client">
            {deal.clientId}
          </span>
          <span aria-hidden="true" className="text-[color:var(--nfq-text-faint)]">·</span>
          <span className="text-[color:var(--nfq-text-secondary)]">{deal.productType}</span>
          <span aria-hidden="true" className="text-[color:var(--nfq-text-faint)]">·</span>
          <span className="font-mono-nums text-[color:var(--nfq-text-primary)]">
            {formatAmount(deal.amount, deal.currency)}
          </span>
          {deal.status && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${statusTone}`}
              data-testid="deal-breadcrumb-status"
            >
              {deal.status}
            </span>
          )}
        </>
      )}
    </nav>
  );
};

export default DealBreadcrumb;
