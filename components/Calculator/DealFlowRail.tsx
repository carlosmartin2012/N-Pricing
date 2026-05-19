import React from 'react';
import { CheckCircle2, FileSignature, GitPullRequestArrow, History, Save } from 'lucide-react';
import type { FTPResult, Transaction } from '../../types';

interface Props {
  deal: Transaction;
  result: FTPResult | null;
  labels: {
    title: string;
    quote: string;
    dossier: string;
    approval: string;
    timeline: string;
    savedRequired: string;
  };
}

/**
 * Passive deal-lifecycle indicator. Shows where the current deal stands in
 * the Quote → Dossier → Approval → Timeline chain. Per-deal navigation lives
 * elsewhere (Blotter row → History icon opens the unified Deal Timeline, the
 * post-Ola 7 source of truth for snapshots + escalations + signed dossiers).
 */
export const DealFlowRail: React.FC<Props> = ({ deal, result, labels }) => {
  const hasDealId = Boolean(deal.id);
  const steps = [
    { label: labels.quote, icon: CheckCircle2, reached: Boolean(result) },
    { label: labels.dossier, icon: FileSignature, reached: hasDealId },
    {
      label: labels.approval,
      icon: GitPullRequestArrow,
      reached: deal.status === 'Pending_Approval' || deal.status === 'Approved',
    },
    { label: labels.timeline, icon: History, reached: hasDealId },
  ];

  return (
    <div
      data-testid="deal-flow-rail"
      role="status"
      aria-label={labels.title}
      className="rounded-lg bg-[var(--nfq-bg-surface)] p-3 shadow-[var(--nfq-shadow-soft)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="nfq-eyebrow">{labels.title}</div>
        {!hasDealId && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--nfq-text-muted)]">
            <Save size={12} />
            {labels.savedRequired}
          </span>
        )}
      </div>
      <ol className="grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li
              key={step.label}
              aria-current={step.reached ? 'step' : undefined}
              className={`flex min-h-16 items-center rounded-lg border px-3 py-2 ${
                step.reached
                  ? 'border-[color:rgba(var(--nfq-accent-rgb),0.45)] bg-[color:rgba(var(--nfq-accent-rgb),0.10)] text-[color:var(--nfq-text-primary)]'
                  : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-tertiary)]'
              }`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="font-mono text-[11px] text-[color:var(--nfq-text-muted)]">0{index + 1}</span>
                <Icon size={16} aria-hidden="true" />
                <span className="truncate text-sm font-medium">{step.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
