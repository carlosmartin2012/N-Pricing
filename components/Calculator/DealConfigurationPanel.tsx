import React, { useState } from 'react';
import type {
  BehaviouralModel,
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
} from '../../types';
import { InputGroup, SelectInput, TextInput } from '../ui/LayoutComponents';
import {
  DEAL_COLLATERAL_OPTIONS,
  DEAL_CURRENCY_OPTIONS,
  DEAL_DEPOSIT_STABILITY_OPTIONS,
  DEAL_PHYSICAL_RISK_OPTIONS,
  DEAL_REPRICING_OPTIONS,
  DEAL_TRANSITION_RISK_OPTIONS,
} from './dealInputPanelUtils';
import type { Language } from '../../translations';
import { translations } from '../../translations';
import { DEFAULT_MACRO_SCENARIOS } from '../../constants/anejoIX';

interface Props {
  values: Transaction;
  clients: ClientEntity[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  availableModels: BehaviouralModel[];
  language: Language;
  onFieldInputChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof Transaction,
  ) => void;
  onClientSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onProductSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onBooleanChange: (field: keyof Transaction, value: boolean) => void;
}

const Section: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={`grid gap-4 pb-4 border-b border-slate-800/50 ${className ?? 'grid-cols-2'}`}>
    {children}
  </div>
);

export const DealConfigurationPanel: React.FC<Props> = ({
  values,
  clients,
  products,
  businessUnits,
  availableModels,
  language,
  onFieldInputChange,
  onClientSelect,
  onProductSelect,
  onBooleanChange,
}) => {
  const t = translations[language];
  return (
    <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4 animate-in slide-in-from-bottom-5 duration-300">
      <Section className="grid-cols-1 md:grid-cols-2">
        <div className="col-span-1 md:col-span-2">
          <InputGroup label={t.selectClientId} tooltip={t.tooltip_calc_client}>
            <SelectInput
              data-testid="input-client"
              value={values.clientId}
              onChange={onClientSelect}
              className="font-bold text-slate-200"
            >
              <option value="">{t.selectClient}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.id} - {client.name}
                </option>
              ))}
            </SelectInput>
          </InputGroup>
        </div>

        <InputGroup label={t.productType} tooltip={t.tooltip_calc_product}>
          <SelectInput data-testid="input-product" value={values.productType} onChange={onProductSelect}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.category})
              </option>
            ))}
          </SelectInput>
        </InputGroup>

        <InputGroup label={t.currency} tooltip={t.tooltip_calc_currency}>
          <SelectInput
            data-testid="input-currency"
            value={values.currency}
            onChange={(event) => onFieldInputChange(event, 'currency')}
          >
            {DEAL_CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </SelectInput>
        </InputGroup>

        <InputGroup label={t.businessUnit} tooltip={t.tooltip_calc_businessUnit}>
          <SelectInput
            value={values.businessUnit}
            onChange={(event) => onFieldInputChange(event, 'businessUnit')}
          >
            {businessUnits.map((businessUnit) => (
              <option key={businessUnit.id} value={businessUnit.id}>
                {businessUnit.name}
              </option>
            ))}
          </SelectInput>
        </InputGroup>

        <InputGroup label={t.fundingCenter}>
          <SelectInput
            value={values.fundingBusinessUnit}
            onChange={(event) => onFieldInputChange(event, 'fundingBusinessUnit')}
          >
            {businessUnits.map((businessUnit) => (
              <option key={businessUnit.id} value={businessUnit.id}>
                {businessUnit.name}
              </option>
            ))}
          </SelectInput>
        </InputGroup>
      </Section>

      <Section>
        <InputGroup label={t.riskWeight} tooltip={t.tooltip_calc_riskWeight}>
          <TextInput
            type="number"
            value={values.riskWeight}
            onChange={(event) => onFieldInputChange(event, 'riskWeight')}
          />
        </InputGroup>
        <InputGroup label={t.targetRoe} tooltip={t.tooltip_calc_targetRoe}>
          <TextInput
            type="number"
            value={values.targetROE}
            onChange={(event) => onFieldInputChange(event, 'targetROE')}
          />
        </InputGroup>
        <InputGroup label={t.capitalRatio} tooltip={t.tooltip_calc_capitalRatio}>
          <TextInput
            type="number"
            step="0.1"
            value={values.capitalRatio}
            onChange={(event) => onFieldInputChange(event, 'capitalRatio')}
          />
        </InputGroup>
        <InputGroup label={t.opCost}>
          <TextInput
            type="number"
            value={values.operationalCostBps}
            onChange={(event) => onFieldInputChange(event, 'operationalCostBps')}
          />
        </InputGroup>
        <InputGroup label={t.lcrOutflow} tooltip={t.tooltip_calc_lcrOutflow}>
          <TextInput
            type="number"
            value={values.lcrOutflowPct || 0}
            onChange={(event) => onFieldInputChange(event, 'lcrOutflowPct')}
          />
        </InputGroup>
      </Section>

      {values.category === 'Liability' && (
        <Section>
          <InputGroup label={t.depositStability} tooltip={t.tooltip_calc_depositStability}>
            <SelectInput
              value={values.depositStability || ''}
              onChange={(event) => onFieldInputChange(event, 'depositStability')}
            >
              <option value="">{t.autoClassify}</option>
              {DEAL_DEPOSIT_STABILITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectInput>
          </InputGroup>

          <InputGroup label={t.operationalDeposit}>
            <SelectInput
              value={values.isOperationalSegment ? 'true' : 'false'}
              onChange={(event) => onBooleanChange('isOperationalSegment', event.target.value === 'true')}
            >
              <option value="false">{t.no}</option>
              <option value="true">{t.yes}</option>
            </SelectInput>
          </InputGroup>
        </Section>
      )}

      <Section>
        <InputGroup label={t.eadLabel}>
          <TextInput
            type="number"
            value={values.ead ?? ''}
            onChange={(event) => onFieldInputChange(event, 'ead')}
            placeholder={t.amountIfBlank}
          />
        </InputGroup>
        <InputGroup label={t.feeIncome}>
          <TextInput
            type="number"
            value={values.feeIncome ?? ''}
            onChange={(event) => onFieldInputChange(event, 'feeIncome')}
            placeholder="0"
          />
        </InputGroup>
        <InputGroup label={t.repricingMonths}>
          <TextInput
            type="number"
            value={values.repricingMonths ?? ''}
            onChange={(event) => onFieldInputChange(event, 'repricingMonths')}
            placeholder={t.autoFromFreq}
          />
        </InputGroup>
        <InputGroup label={t.repricingFrequency} tooltip={t.tooltip_calc_repricingFreq}>
          <SelectInput
            value={values.repricingFreq}
            onChange={(event) => onFieldInputChange(event, 'repricingFreq')}
          >
            {DEAL_REPRICING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectInput>
        </InputGroup>
      </Section>

      {values.category === 'Asset' && (
        <Section>
          <InputGroup label={t.collateralType} tooltip={t.tooltip_calc_collateral}>
            <SelectInput
              value={values.collateralType || 'None'}
              onChange={(event) => onFieldInputChange(event, 'collateralType')}
            >
              {DEAL_COLLATERAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'None' ? t.noneUnsecured : option.replace('_', ' ')}
                </option>
              ))}
            </SelectInput>
          </InputGroup>
          <InputGroup label={t.haircut}>
            <TextInput
              type="number"
              value={values.haircutPct ?? ''}
              onChange={(event) => onFieldInputChange(event, 'haircutPct')}
            />
          </InputGroup>
        </Section>
      )}

      <div className="grid grid-cols-2 gap-4">
        <InputGroup label={t.transitionRisk} tooltip={t.tooltip_calc_transitionRisk}>
          <SelectInput
            value={values.transitionRisk}
            onChange={(event) => onFieldInputChange(event, 'transitionRisk')}
          >
            {DEAL_TRANSITION_RISK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectInput>
        </InputGroup>
        <InputGroup label={t.physicalRisk} tooltip={t.tooltip_calc_physicalRisk}>
          <SelectInput
            value={values.physicalRisk}
            onChange={(event) => onFieldInputChange(event, 'physicalRisk')}
          >
            {DEAL_PHYSICAL_RISK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectInput>
        </InputGroup>
        <div className="col-span-2">
          <InputGroup label={t.behaviouralModel} tooltip={t.tooltip_calc_behaviouralModel}>
            <SelectInput
              value={values.behaviouralModelId || ''}
              onChange={(event) => onFieldInputChange(event, 'behaviouralModelId')}
            >
              <option value="">{t.noneOption}</option>
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </SelectInput>
          </InputGroup>
        </div>
      </div>

      <CreditRiskGuaranteesSection
        values={values}
        t={t}
        onFieldInputChange={onFieldInputChange}
      />
    </div>
  );
};

// ── Credit Risk & Guarantees (collapsible) ─────────────────────────────────

const GUARANTEE_TYPE_OPTIONS: { value: Transaction['guaranteeType'] | ''; label: (t: typeof translations['en']) => string }[] = [
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

const CreditRiskGuaranteesSection: React.FC<{
  values: Transaction;
  t: typeof translations['en'];
  onFieldInputChange: Props['onFieldInputChange'];
}> = ({ values, t, onFieldInputChange }) => {
  const [open, setOpen] = useState(false);
  const isMirror = values.creditRiskMode === 'mirror';

  // Compute weighted coverage impact for scenario display
  const weightedFactor = DEFAULT_MACRO_SCENARIOS.reduce(
    (acc, s) => acc + s.weight * s.coverageAdjustmentFactor,
    0,
  );

  return (
    <div className="border-t border-slate-800/50 pt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-800/40 hover:text-slate-300"
      >
        {t.creditRiskGuarantees}
        <span className="ml-2 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="grid gap-4 pt-3">
          {/* ── Mirror Mode Toggle ─────────────────────────────────── */}
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

            {/* Mirror mode external params */}
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

          {/* ── Guarantee fields ───────────────────────────────────── */}
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

          {/* ── Forward-Looking Scenarios (read-only) ──────────────── */}
          <div className="border-t border-slate-800/50 pt-3">
            <span className="nfq-label mb-2 block">{t.forwardLookingScenarios}</span>
            <div className="overflow-hidden rounded-lg border border-[var(--nfq-border-ghost)]">
              <table className="w-full text-[11px] font-mono">
                <thead>
                  <tr className="border-b border-slate-800/50 text-[10px] uppercase tracking-wider text-[var(--nfq-text-muted)]">
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
                    <td className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--nfq-text-muted)]">
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
