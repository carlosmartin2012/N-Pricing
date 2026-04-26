import React from 'react';
import type { Transaction } from '../../types';
import type { Language } from '../../translations';
import { getTranslations } from '../../translations';
import { SelectInput, TextInput } from '../ui/LayoutComponents';
import { TooltipTrigger } from '../ui/Tooltip';
import { DEAL_AMORTIZATION_OPTIONS, formatDealAmount, type DealFieldChange } from './dealInputPanelUtils';

interface DealLeverCardProps {
  label: string;
  tooltip?: string;
  accentClassName: string;
  displayValue: string;
  rangeMin: number;
  rangeMax: number;
  rangeStep: number;
  rangeValue: number;
  onRangeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  children: React.ReactNode;
}

const DealLeverCard: React.FC<DealLeverCardProps> = ({
  label,
  tooltip,
  accentClassName,
  displayValue,
  rangeMin,
  rangeMax,
  rangeStep,
  rangeValue,
  onRangeChange,
  children,
}) => (
  <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-3">
    <div className="mb-3 flex items-center justify-between">
      <label className="nfq-label text-[10px] flex items-center">
        {label}
        {tooltip && <TooltipTrigger content={tooltip} size={11} />}
      </label>
      <span className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${accentClassName}`}>
        {displayValue}
      </span>
    </div>
    <input
      type="range"
      min={rangeMin}
      max={rangeMax}
      step={rangeStep}
      value={rangeValue}
      onChange={onRangeChange}
      aria-label={label}
      className="mb-3 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 transition-all dark:bg-slate-700"
    />
    {children}
  </div>
);

interface Props {
  values: Transaction;
  language: Language;
  onFieldInputChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof Transaction,
  ) => void;
  onFieldChange: DealFieldChange;
}

export const DealLeversPanel: React.FC<Props> = ({
  values,
  language,
  onFieldInputChange,
  onFieldChange,
}) => {
  const t = getTranslations(language);

  return (
    <div data-tour="deal-levers" className="relative flex-1 space-y-6 overflow-y-auto p-4 custom-scrollbar">
      <DealLeverCard
        label={t.principalAmount}
        tooltip={t.tooltip_calc_amount}
        accentClassName="bg-cyan-500/10 text-cyan-400"
        displayValue={formatDealAmount(values.amount, values.currency)}
        rangeMin={0}
        rangeMax={100000000}
        rangeStep={100000}
        rangeValue={values.amount || 0}
        onRangeChange={(event) => onFieldInputChange(event, 'amount')}
      >
        <div className="flex justify-end">
          <TextInput
            data-testid="input-amount"
            type="number"
            value={values.amount || ''}
            onChange={(event) => onFieldInputChange(event, 'amount')}
            aria-label={t.principalAmount || 'Principal amount'}
            placeholder="0.00"
            className="h-7 w-28 text-right text-xs font-mono"
          />
        </div>
      </DealLeverCard>

      <DealLeverCard
        label={t.tenor}
        tooltip={t.tooltip_calc_tenor}
        accentClassName="bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-secondary)]"
        displayValue={`${values.durationMonths || 0}m`}
        rangeMin={0}
        rangeMax={360}
        rangeStep={1}
        rangeValue={values.durationMonths || 0}
        onRangeChange={(event) => onFieldInputChange(event, 'durationMonths')}
      >
        <div className="flex items-center gap-2">
          <div className="w-1/2">
            <span className="mb-1 flex items-center text-[9px] text-[color:var(--nfq-text-muted)] font-mono tracking-normal">
              {t.amortization}
              <TooltipTrigger content={t.tooltip_calc_amortization} size={11} />
            </span>
            <SelectInput
              value={values.amortization}
              onChange={(event) => onFieldInputChange(event, 'amortization')}
              aria-label={t.amortization || 'Amortization type'}
              className="h-7 w-full py-0 text-xs"
            >
              {DEAL_AMORTIZATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectInput>
          </div>
          <div className="w-1/2">
            <TextInput
              data-testid="input-duration"
              type="number"
              value={values.durationMonths || ''}
              onChange={(event) => onFieldInputChange(event, 'durationMonths')}
              aria-label={t.tenor || 'Tenor (months)'}
              className="h-7 w-full text-right text-xs font-mono"
              placeholder="0"
            />
          </div>
        </div>
      </DealLeverCard>

      <DealLeverCard
        label={t.targetMargin}
        tooltip={t.tooltip_calc_marginTarget}
        accentClassName="bg-emerald-500/10 text-emerald-400"
        displayValue={`+${Number(values.marginTarget || 0).toFixed(2)}%`}
        rangeMin={0}
        rangeMax={10}
        rangeStep={0.05}
        rangeValue={values.marginTarget || 0}
        onRangeChange={(event) => onFieldInputChange(event, 'marginTarget')}
      >
        <div className="flex items-center justify-end gap-2">
          <div className="relative w-24">
            <TextInput
              type="number"
              step="0.05"
              value={values.marginTarget || ''}
              onChange={(event) => onFieldInputChange(event, 'marginTarget')}
              aria-label={t.targetMargin || 'Target margin (%)'}
              className="h-7 w-full pr-6 text-right text-xs font-mono"
              placeholder="0.00"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[color:var(--nfq-text-muted)]">
              %
            </span>
          </div>
        </div>
      </DealLeverCard>

      <div className="rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-3">
        <div className="mb-3 flex items-center justify-between">
          <label className="nfq-label text-[10px]">{t.quickControls}</label>
          <span className="rounded bg-[var(--nfq-bg-highest)] px-2 py-0.5 text-xs font-mono font-bold text-[color:var(--nfq-text-secondary)]">
            Live
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onFieldChange('amount', Math.max(0, (values.amount || 0) - 1000000))}
            className="rounded border border-[color:var(--nfq-border-ghost)] px-3 py-2 text-xs text-[color:var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-highest)] hover:text-[color:var(--nfq-text-primary)]"
          >
            -1M
          </button>
          <button
            onClick={() => onFieldChange('durationMonths', Math.max(0, (values.durationMonths || 0) - 12))}
            className="rounded border border-[color:var(--nfq-border-ghost)] px-3 py-2 text-xs text-[color:var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-highest)] hover:text-[color:var(--nfq-text-primary)]"
          >
            -12M
          </button>
          <button
            onClick={() => onFieldChange('marginTarget', Math.max(0, Number((values.marginTarget - 0.25).toFixed(2))))}
            className="rounded border border-[color:var(--nfq-border-ghost)] px-3 py-2 text-xs text-[color:var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-highest)] hover:text-[color:var(--nfq-text-primary)]"
          >
            -25bps
          </button>
          <button
            onClick={() => onFieldChange('amount', (values.amount || 0) + 1000000)}
            className="rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-400 transition-colors hover:bg-cyan-500/10"
          >
            +1M
          </button>
          <button
            onClick={() => onFieldChange('durationMonths', (values.durationMonths || 0) + 12)}
            className="rounded border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-400 transition-colors hover:bg-cyan-500/10"
          >
            +12M
          </button>
          <button
            onClick={() => onFieldChange('marginTarget', Number((values.marginTarget + 0.25).toFixed(2)))}
            className="rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-400 transition-colors hover:bg-emerald-500/10"
          >
            +25bps
          </button>
        </div>
      </div>
    </div>
  );
};
