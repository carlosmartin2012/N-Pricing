import React from 'react';
import { AlertTriangle, FileSpreadsheet, RefreshCcw, TrendingUp } from 'lucide-react';
import type { PricingShocks } from '@npricing/pricing-core';
import { Badge, Panel } from '../ui/LayoutComponents';
import type { Language } from '../../translations';
import { getTranslations } from '../../translations';
import type { Transaction } from '../../types';
import { QUICK_SHOCK_SCENARIOS } from './shockUtils';

interface Props {
  deal: Transaction;
  shocks: PricingShocks;
  language: Language;
  onShockChange: (key: keyof PricingShocks, value: number) => void;
  onReset: () => void;
  onDownloadTemplate: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyPreset: (shocks: PricingShocks) => void;
}

const ShockSlider: React.FC<{
  label: string;
  accentClassName: string;
  icon: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, accentClassName, icon, value, onChange }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-[color:var(--nfq-text-secondary)]">
        {icon}
        {label}
      </label>
      <span className={`text-sm font-mono font-bold ${accentClassName}`}>
        {value > 0 ? '+' : ''}
        {value} bps
      </span>
    </div>
    <input
      type="range"
      min="-500"
      max="500"
      step="10"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 dark:bg-[var(--nfq-bg-highest)]"
    />
    <div className="flex justify-between font-mono text-xs text-[color:var(--nfq-text-muted)]">
      <span>-500 bps</span>
      <span>0</span>
      <span>+500 bps</span>
    </div>
  </div>
);

export const ShockControlPanel: React.FC<Props> = ({
  deal,
  shocks,
  language,
  onShockChange,
  onReset,
  onDownloadTemplate,
  onImport,
  onApplyPreset,
}) => {
  const t = getTranslations(language);

  return (
    <Panel title={t.shocksConfig || 'Shocks Configuration'} className="h-full bg-white dark:bg-[#0a0a0a]">
      <div className="space-y-8 p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-[var(--nfq-bg-elevated)]">
          <div className="mb-1 text-[10px] font-bold uppercase text-[color:var(--nfq-text-faint)]">{t.targetTransaction}</div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono font-bold text-[color:var(--nfq-accent)] dark:text-[color:var(--nfq-accent)]">{deal.id || 'NEW-DEAL'}</span>
            <Badge variant="outline">{deal.productType || t.noProduct}</Badge>
          </div>
          <div className="truncate text-xs font-medium text-slate-700 dark:text-[color:var(--nfq-text-secondary)]">
            {deal.clientId || t.noClientSelected}
          </div>
        </div>

        <ShockSlider
          label={t.interestRateShock || 'Interest Rate Shock'}
          accentClassName="text-[color:var(--nfq-accent)]"
          icon={<TrendingUp size={16} className="text-[color:var(--nfq-accent)]" />}
          value={shocks.interestRate}
          onChange={(value) => onShockChange('interestRate', value)}
        />

        <ShockSlider
          label={t.liquidityRateShock || 'Liquidity Spread Shock'}
          accentClassName="text-[color:var(--nfq-warning)]"
          icon={<AlertTriangle size={16} className="text-[color:var(--nfq-warning)]" />}
          value={shocks.liquiditySpread}
          onChange={(value) => onShockChange('liquiditySpread', value)}
        />

        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase text-[color:var(--nfq-text-faint)]">{t.quickScenarios}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_SHOCK_SCENARIOS.map((scenario) => (
              <button
                key={scenario.label}
                onClick={() =>
                  onApplyPreset({
                    interestRate: scenario.interestRate,
                    liquiditySpread: scenario.liquiditySpread,
                  })
                }
                className="rounded border border-slate-200 px-2 py-1.5 text-left text-[10px] font-mono text-[color:var(--nfq-text-muted)] transition-colors hover:bg-slate-100 hover:text-[color:var(--nfq-text-primary)] dark:border-slate-800 dark:hover:bg-[var(--nfq-bg-highest)]"
              >
                {scenario.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-slate-200 py-2 text-sm text-[color:var(--nfq-text-faint)] transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-[var(--nfq-bg-highest)] dark:hover:text-[color:var(--nfq-text-primary)]"
          >
            <RefreshCcw size={14} />
            {t.reset}
          </button>
          <button
            onClick={onDownloadTemplate}
            className="flex flex-1 items-center justify-center gap-2 rounded border border-amber-200 bg-amber-50/10 py-2 text-sm text-[color:var(--nfq-warning)] transition-colors hover:text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/20"
            title="Download Template"
          >
            <FileSpreadsheet size={14} />
            {t.template}
          </button>
          <label
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded border border-cyan-200 bg-cyan-50/10 py-2 text-sm text-[color:var(--nfq-accent)] transition-colors hover:text-[color:var(--nfq-accent)] dark:border-cyan-900/50 dark:bg-cyan-950/20"
            title="Import Excel"
          >
            <TrendingUp size={14} />
            {t.import}
            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={onImport} />
          </label>
        </div>
      </div>
    </Panel>
  );
};
