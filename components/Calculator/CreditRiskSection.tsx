import React, { useState } from 'react';
import type { Transaction } from '../../types';
import { InputGroup, SelectInput, TextInput } from '../ui/LayoutComponents';
import type { translations } from '../../translations';
import { DEFAULT_MACRO_SCENARIOS } from '../../constants/anejoIX';

interface Props {
  values: Transaction;
  t: (typeof translations)['en'];
  onFieldInputChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof Transaction,
  ) => void;
}

const Section: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={`grid gap-4 pb-4 border-b border-slate-800/50 ${className ?? 'grid-cols-2'}`}>
    {children}
  </div>
);

const GUARANTEE_TYPE_OPTIONS: { value: Transaction['guaranteeType'] | ''; label: (t: (typeof translations)['en']) => string }[] = [
  { value: 'NONE', label: (t) => t.guaranteeNone },
  { value: 'MORTGAGE', label: (t) => t.guaranteeMortgage },
  { value: 'FINANCIAL_PLEDGE', label: (t) => t.guaranteePledge },
  { value: 'PERSONAL_GUARANTEE', label: (t) => t.guaranteePersonal },
  { value: 'PUBLIC_GUARANTEE', label: (t) => t.guaranteePublic },
];

const CCF_TYPE_OPTIONS = [
  'UCC',
  'OTHER_COMMITMENT',
  'TRADE_FINANCE',
  'NIF_RUF',
  'DIRECT_SUBSTITUTE',
  'PERFORMANCE_BOND',
] as const;

export const CreditRiskSection: React.FC<Props> = ({ values, t, onFieldInputChange }) => {
  const [open, setOpen] = useState(false);
  const isMirror = values.creditRiskMode === 'mirror';

  const weightedFactor = DEFAULT_MACRO_SCENARIOS.reduce(
    (acc, s) => acc + s.weight * s.coverageAdjustmentFactor,
    0,
  );

  return (
    <div className="border-t border-slate-800/50 pt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold tracking-normal text-slate-400 hover:bg-slate-800/40 hover:text-slate-300"
      >
        {t.creditRiskGuarantees}
        <span className="ml-2 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="grid gap-4 pt-3">
          <div className="pb-3 border-b border-slate-800/50">
            <span className="nfq-label mb-2 block">{t.creditRiskMode}</span>
            <div className="flex gap-0">
              <button
                type="button"
                onClick={() => {
                  const synth = {
                    target: { value: 'native' },
                  } as React.ChangeEvent<HTMLInputElement>;
                  onFieldInputChange(synth, 'creditRiskMode');
                }}
                className={`flex-1 rounded-l-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !isMirror
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                    : 'border-[var(--nfq-border-ghost)] text-[var(--nfq-text-muted)] hover:text-slate-300'
                }`}
              >
                {t.modeNative}
              </button>
              <button
                type="button"
                onClick={() => {
                  const synth = {
                    target: { value: 'mirror' },
                  } as React.ChangeEvent<HTMLInputElement>;
                  onFieldInputChange(synth, 'creditRiskMode');
                }}
                className={`flex-1 rounded-r-lg border border-l-0 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isMirror
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                    : 'border-[var(--nfq-border-ghost)] text-[var(--nfq-text-muted)] hover:text-slate-300'
                }`}
              >
                {t.modeMirror}
              </button>
            </div>

            {isMirror && (
              <div className="mt-3 grid grid-cols-2 gap-4">
                <InputGroup label={t.externalPd}>
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={values.externalPd12m != null ? +(values.externalPd12m * 100).toFixed(4) : ''}
                    onChange={(event) => {
                      const pct = parseFloat(event.target.value);
                      const synth = {
                        ...event,
                        target: { ...event.target, value: String(isNaN(pct) ? '' : pct / 100) },
                      } as React.ChangeEvent<HTMLInputElement>;
                      onFieldInputChange(synth, 'externalPd12m');
                    }}
                    placeholder="0.50"
                  />
                </InputGroup>
                <InputGroup label={t.externalLgd}>
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={values.externalLgd != null ? +(values.externalLgd * 100).toFixed(2) : ''}
                    onChange={(event) => {
                      const pct = parseFloat(event.target.value);
                      const synth = {
                        ...event,
                        target: { ...event.target, value: String(isNaN(pct) ? '' : pct / 100) },
                      } as React.ChangeEvent<HTMLInputElement>;
                      onFieldInputChange(synth, 'externalLgd');
                    }}
                    placeholder="45"
                  />
                </InputGroup>
                <div className="col-span-2">
                  <InputGroup label={t.externalEad}>
                    <TextInput
                      type="number"
                      min={0}
                      max={values.amount * 3}
                      step={10000}
                      value={values.externalEad ?? ''}
                      onChange={(event) => onFieldInputChange(event, 'externalEad')}
                      placeholder={String(values.amount || 0)}
                    />
                  </InputGroup>
                </div>
              </div>
            )}
          </div>

          <Section className="grid-cols-2">
            <InputGroup label={t.guaranteeType} tooltip={t.tooltip_calc_collateral}>
              <SelectInput
                value={values.guaranteeType || 'NONE'}
                onChange={(event) => onFieldInputChange(event, 'guaranteeType')}
              >
                {GUARANTEE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label(t)}
                  </option>
                ))}
              </SelectInput>
            </InputGroup>

            {values.guaranteeType === 'PUBLIC_GUARANTEE' && (
              <InputGroup label={t.publicGuaranteePct}>
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={values.publicGuaranteePct != null ? values.publicGuaranteePct * 100 : ''}
                  onChange={(event) => {
                    const pct = parseFloat(event.target.value);
                    const synth = {
                      ...event,
                      target: { ...event.target, value: String(isNaN(pct) ? '' : pct / 100) },
                    } as React.ChangeEvent<HTMLInputElement>;
                    onFieldInputChange(synth, 'publicGuaranteePct');
                  }}
                  placeholder="0 – 100"
                />
              </InputGroup>
            )}

            {values.guaranteeType === 'MORTGAGE' && (
              <InputGroup label={t.appraisalAge}>
                <TextInput
                  type="number"
                  min={0}
                  max={120}
                  step={6}
                  value={values.appraisalAgeMonths ?? ''}
                  onChange={(event) => onFieldInputChange(event, 'appraisalAgeMonths')}
                  placeholder="0"
                />
              </InputGroup>
            )}

            <InputGroup label={t.undrawnAmount}>
              <TextInput
                type="number"
                min={0}
                max={values.amount * 2}
                step={10000}
                value={values.undrawnAmount ?? ''}
                onChange={(event) => onFieldInputChange(event, 'undrawnAmount')}
                placeholder="0"
              />
            </InputGroup>

            {(values.undrawnAmount ?? 0) > 0 && (
              <InputGroup label={t.ccfType}>
                <SelectInput
                  value={values.ccfType || 'OTHER_COMMITMENT'}
                  onChange={(event) => onFieldInputChange(event, 'ccfType')}
                >
                  {CCF_TYPE_OPTIONS.map((key) => (
                    <option key={key} value={key}>
                      {key.replace(/_/g, ' ')}
                    </option>
                  ))}
                </SelectInput>
              </InputGroup>
            )}
          </Section>

          <div className="border-t border-slate-800/50 pt-3">
            <span className="nfq-label mb-2 block">{t.forwardLookingScenarios}</span>
            <div className="overflow-hidden rounded-lg border border-[var(--nfq-border-ghost)]">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-slate-800/50 text-[10px] tracking-normal text-[var(--nfq-text-muted)]">
                    <th className="px-3 py-1.5 text-left font-medium">Scenario</th>
                    <th className="px-3 py-1.5 text-right font-medium">{t.scenarioWeight}</th>
                    <th className="px-3 py-1.5 text-right font-medium">{t.scenarioCoverageFactor}</th>
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_MACRO_SCENARIOS.map((scenario, idx) => (
                    <tr
                      key={scenario.id}
                      className={idx % 2 === 1 ? 'bg-slate-800/20' : ''}
                    >
                      <td className="px-3 py-1.5 text-slate-300">{scenario.label}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">
                        {(scenario.weight * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-400">
                        &times;{scenario.coverageAdjustmentFactor.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-800/50">
                    <td className="px-3 py-1.5 text-[10px] font-semibold tracking-normal text-[var(--nfq-text-muted)]">
                      Weighted
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-300 font-semibold">100%</td>
                    <td className="px-3 py-1.5 text-right text-cyan-400 font-semibold">
                      &times;{weightedFactor.toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--nfq-text-faint)]">
              {t.scenariosReadOnly}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
