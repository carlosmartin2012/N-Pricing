import React from 'react';
import { useNavigate } from 'react-router';
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

export const DealFlowRail: React.FC<Props> = ({ deal, result, labels }) => {
  const navigate = useNavigate();
  const hasDealId = Boolean(deal.id);
  const steps = [
    {
      label: labels.quote,
      icon: CheckCircle2,
      active: Boolean(result),
      onClick: () => document.querySelector('[data-tour="pricing-receipt"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      disabled: false,
    },
    {
      label: labels.dossier,
      icon: FileSignature,
      active: hasDealId,
      onClick: () => navigate('/dossiers'),
      disabled: false,
    },
    {
      label: labels.approval,
      icon: GitPullRequestArrow,
      active: deal.status === 'Pending_Approval' || deal.status === 'Approved',
      onClick: () => navigate(hasDealId ? `/approvals?focus=${encodeURIComponent(deal.id!)}` : '/approvals'),
      disabled: false,
    },
    {
      label: labels.timeline,
      icon: History,
      active: hasDealId,
      onClick: () => hasDealId && navigate(`/deals/${encodeURIComponent(deal.id!)}/timeline`),
      disabled: !hasDealId,
    },
  ];

  return (
    <div data-testid="deal-flow-rail" className="rounded-lg bg-[var(--nfq-bg-surface)] p-3 shadow-[var(--nfq-shadow-soft)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="nfq-eyebrow">{labels.title}</div>
        {!hasDealId && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--nfq-text-muted)]">
            <Save size={12} />
            {labels.savedRequired}
          </span>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <button
              key={step.label}
              type="button"
              disabled={step.disabled}
              onClick={step.onClick}
              className={`flex min-h-16 items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                step.active
                  ? 'border-[color:rgba(var(--nfq-accent-rgb),0.45)] bg-[color:rgba(var(--nfq-accent-rgb),0.10)] text-[color:var(--nfq-text-primary)]'
                  : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-secondary)]'
              } ${step.disabled ? 'cursor-not-allowed opacity-55' : 'hover:border-[color:rgba(var(--nfq-accent-rgb),0.38)]'}`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <span className="font-mono text-[11px] text-[color:var(--nfq-text-muted)]">0{index + 1}</span>
                <Icon size={16} />
                <span className="truncate text-sm font-medium">{step.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
