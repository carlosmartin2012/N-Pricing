import React, { useMemo, useState } from 'react';
import type {
  BehaviouralModel,
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
} from '../../types';
import { EMPTY_DEAL } from '../../constants';
import { Panel } from '../ui/LayoutComponents';
import { ChevronDown, ChevronUp, Settings } from 'lucide-react';
import type { Language } from '../../translations';
import { getTranslations } from '../../translations';
import { DealConfigurationPanel } from './DealConfigurationPanel';
import { DealLeversPanel } from './DealLeversPanel';
import { DealScenarioSelector } from './DealScenarioSelector';
import {
  DEAL_AMORTIZATION_OPTIONS,
  getAvailableBehaviouralModels,
  getClientDisplayName,
  getDefaultLcrOutflowPct,
  parseDealFieldValue,
  type DealFieldChange,
} from './dealInputPanelUtils';

interface Props {
  values: Transaction;
  onChange: DealFieldChange;
  setDealParams: React.Dispatch<React.SetStateAction<Transaction>>;
  deals: Transaction[];
  clients: ClientEntity[];
  products: ProductDefinition[];
  businessUnits: BusinessUnit[];
  language: Language;
  behaviouralModels: BehaviouralModel[];
}

const DealInputPanel: React.FC<Props> = ({
  values,
  onChange,
  setDealParams,
  deals,
  clients,
  products,
  businessUnits,
  language,
  behaviouralModels,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const t = getTranslations(language);

  const clientDisplayName = useMemo(
    () => getClientDisplayName(clients, values.clientId),
    [clients, values.clientId],
  );

  const availableModels = useMemo(
    () => getAvailableBehaviouralModels(values.productType, products, behaviouralModels),
    [values.productType, products, behaviouralModels],
  );

  const handleFieldInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof Transaction,
  ) => {
    onChange(field, parseDealFieldValue(field, event));
  };

  const handleTransactionSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    if (selectedValue === 'NEW') {
      setDealParams(EMPTY_DEAL);
      return;
    }

    const selectedDeal = deals.find((deal) => deal.id === selectedValue);
    if (selectedDeal) {
      setDealParams(selectedDeal);
    }
  };

  const handleProductSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedProduct = products.find((product) => product.id === event.target.value);
    if (!selectedProduct) {
      return;
    }

    const compatibleModels = getAvailableBehaviouralModels(
      selectedProduct.id,
      products,
      behaviouralModels,
    );

    const defaultAmortization = DEAL_AMORTIZATION_OPTIONS.includes(
      selectedProduct.defaultAmortization as Transaction['amortization'],
    )
      ? (selectedProduct.defaultAmortization as Transaction['amortization'])
      : values.amortization;

    onChange('productType', selectedProduct.id);
    onChange('category', selectedProduct.category);
    onChange('amortization', defaultAmortization);
    onChange('lcrOutflowPct', getDefaultLcrOutflowPct(selectedProduct));

    if (!compatibleModels.some((model) => model.id === values.behaviouralModelId)) {
      onChange('behaviouralModelId', '');
    }
  };

  const handleClientSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedClient = clients.find((client) => client.id === event.target.value);
    if (!selectedClient) {
      return;
    }

    onChange('clientId', selectedClient.id);
    onChange('clientType', selectedClient.type);
  };

  return (
    <Panel title={t.pricingSimulationEngine || 'Pricing Simulation Engine'} className="h-full">
      <div data-testid="deal-input-panel" data-tour="deal-input" className="flex h-full flex-col text-[color:var(--nfq-text-primary)]">
        <DealScenarioSelector
          values={values}
          deals={deals}
          clients={clients}
          clientDisplayName={clientDisplayName}
          language={language}
          onTransactionSelect={handleTransactionSelect}
        />

        <DealLeversPanel
          values={values}
          language={language}
          onFieldInputChange={handleFieldInputChange}
          onFieldChange={onChange}
        />

        <div className="border-t border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]">
          <button
            data-tour="deal-config-toggle"
            onClick={() => setShowConfig((currentValue) => !currentValue)}
            className="flex w-full items-center justify-between p-3 text-xs text-[color:var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-highest)] hover:text-[color:var(--nfq-text-primary)]"
          >
            <div className="flex items-center gap-2">
              <Settings size={14} />
              <span className="font-bold uppercase tracking-wider">
                {t.dealConfigAssumptions}
              </span>
            </div>
            {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showConfig && (
            <DealConfigurationPanel
              values={values}
              clients={clients}
              products={products}
              businessUnits={businessUnits}
              availableModels={availableModels}
              language={language}
              onFieldInputChange={handleFieldInputChange}
              onClientSelect={handleClientSelect}
              onProductSelect={handleProductSelect}
              onBooleanChange={(field, value) => onChange(field, value)}
            />
          )}
        </div>
      </div>
    </Panel>
  );
};

export default DealInputPanel;
