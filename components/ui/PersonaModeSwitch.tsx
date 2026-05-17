import React from 'react';
import { BriefcaseBusiness, ShieldCheck, Settings2 } from 'lucide-react';
import type { WorkspaceMode } from '../../contexts/UIContext';

interface Props {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  labels: {
    mode: string;
    trader: string;
    risk: string;
    admin: string;
  };
}

const OPTIONS: Array<{ id: WorkspaceMode; icon: typeof BriefcaseBusiness; labelKey: keyof Props['labels'] }> = [
  { id: 'Trader', icon: BriefcaseBusiness, labelKey: 'trader' },
  { id: 'Risk', icon: ShieldCheck, labelKey: 'risk' },
  { id: 'Admin', icon: Settings2, labelKey: 'admin' },
];

export const PersonaModeSwitch: React.FC<Props> = ({ mode, onChange, labels }) => (
  <div
    className="hidden items-center gap-1 rounded-full bg-[var(--nfq-bg-elevated)] p-1 shadow-[inset_0_0_0_1px_var(--nfq-border-ghost)] xl:flex"
    aria-label={labels.mode}
    title={labels.mode}
  >
    {OPTIONS.map((option) => {
      const Icon = option.icon;
      const active = mode === option.id;
      return (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={active}
          className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[11px] font-semibold transition-colors ${
            active
              ? 'bg-[color:rgba(var(--nfq-accent-rgb),0.18)] text-[color:var(--nfq-accent)]'
              : 'text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]'
          }`}
        >
          <Icon size={14} />
          <span className="ml-1 hidden 2xl:inline">{labels[option.labelKey]}</span>
        </button>
      );
    })}
  </div>
);
