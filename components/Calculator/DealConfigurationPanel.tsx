import React from 'react';
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
          <InputGroup label={t.selectClientId}>
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

        <InputGroup label={t.productType}>
          <SelectInput data-testid="input-product" value={values.productType} onChange={onProductSelect}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} ({product.category})
              </option>
            ))}
          </SelectInput>
        </InputGroup>

        <InputGroup label={t.currency}>
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

        <InputGroup label={t.businessUnit}>
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
        <InputGroup label={t.riskWeight}>
          <TextInput
            type="number"
            value={values.riskWeight}
            onChange={(event) => onFieldInputChange(event, 'riskWeight')}
          />
        </InputGroup>
        <InputGroup label={t.targetRoe}>
          <TextInput
            type="number"
            value={values.targetROE}
            onChange={(event) => onFieldInputChange(event, 'targetROE')}
          />
        </InputGroup>
        <InputGroup label={t.capitalRatio}>
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
        <InputGroup label={t.lcrOutflow}>
          <TextInput
            type="number"
            value={values.lcrOutflowPct || 0}
            onChange={(event) => onFieldInputChange(event, 'lcrOutflowPct')}
          />
        </InputGroup>
      </Section>

      {values.category === 'Liability' && (
        <Section>
          <InputGroup label={t.depositStability}>
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
        <InputGroup label={t.repricingFrequency}>
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
          <InputGroup label={t.collateralType}>
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
        <InputGroup label={t.transitionRisk}>
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
        <InputGroup label={t.physicalRisk}>
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
          <InputGroup label={t.behaviouralModel}>
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
    </div>
  );
};
