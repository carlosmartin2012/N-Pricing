import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<Props> = ({ icon: Icon, title, description, actionLabel, onAction }) => (
  <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)]">
      <Icon size={28} className="text-[var(--nfq-text-muted)] opacity-60" />
    </div>
    <div>
      <h3 className="text-base font-semibold text-[var(--nfq-text-primary)]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--nfq-text-muted)]">{description}</p>
    </div>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="nfq-button nfq-button-primary mt-2 px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em]"
      >
        {actionLabel}
      </button>
    )}
  </div>
);
