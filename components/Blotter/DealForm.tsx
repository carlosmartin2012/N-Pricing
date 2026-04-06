import React, { useMemo, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import {
  InputGroup,
  SelectInput,
  TextInput,
} from '../ui/LayoutComponents';
import { formatStatus, getStatusColor } from '../../utils/dealWorkflow';
import type {
  BehaviouralModel,
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
} from '../../types';
import { useUI } from '../../contexts/UIContext';
import { dealFormResolver } from '../../utils/dealFormResolver';

interface Props {
  selectedDeal: Partial<Transaction>;
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  products: ProductDefinition[];
  behaviouralModels: BehaviouralModel[];
  onChange: (updates: Partial<Transaction>) => void;
  /** Parent can receive the form instance to trigger submit / read errors externally */
  onFormReady?: (form: UseFormReturn<Transaction>) => void;
}

const DealForm: React.FC<Props> = ({
  selectedDeal,
  clients,
  businessUnits,
  products,
  behaviouralModels,
  onChange,
  onFormReady,
}) => {
  const { t } = useUI();

  const form = useForm<Transaction>({
    resolver: dealFormResolver,
    defaultValues: selectedDeal as Transaction,
    mode: 'onSubmit',
  });

  const { register, control, reset } = form;

  // Expose form instance to parent on mount and when reference changes
  useEffect(() => {
    onFormReady?.(form);
  }, [form, onFormReady]);

  // Reset form when selectedDeal changes (e.g. switching between deals)
  useEffect(() => {
    reset(selectedDeal as Transaction);
  }, [selectedDeal, reset]);

  // Watch the category field to filter behavioural models
  const category = useWatch({ control, name: 'category' });

  const availableModels = useMemo(
    () =>
      behaviouralModels.filter(model =>
        (category === 'Liability' && model.type === 'NMD_Replication')
        || (category === 'Asset' && model.type === 'Prepayment_CPR')
        || !category,
      ),
    [behaviouralModels, category],
  );

  // Propagate changes to parent for backward compatibility.
  // useWatch subscribes without causing re-renders of the form itself.
  const watchedValues = useWatch({ control });
  useEffect(() => {
    onChange(watchedValues as Partial<Transaction>);
  }, [watchedValues, onChange]);

  return (
    <div className="space-y-6">
      <div className="rounded border border-slate-800 bg-slate-900 p-3">
        <div className="text-[10px] font-bold uppercase text-slate-500">{t.dealId}</div>
        <div className="font-mono text-sm text-cyan-400">{selectedDeal.id}</div>
      </div>

      <div className="space-y-4 border-b border-slate-800 pb-4">
        <h4 className="text-xs font-bold uppercase text-slate-400">{t.counterparty}</h4>
        <InputGroup label="Client ID">
          <Controller
            control={control}
            name="clientId"
            render={({ field: { value, onChange: fieldOnChange } }) => (
              <SelectInput
                value={value ?? ''}
                onChange={(event) => {
                  const client = clients.find(item => item.id === event.target.value);
                  fieldOnChange(event.target.value);
                  if (client) {
                    form.setValue('clientType', client.type);
                  }
                }}
              >
                <option value="">{t.selectClientIdOption}</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.id}
                  </option>
                ))}
              </SelectInput>
            )}
          />
        </InputGroup>

        <div className="grid grid-cols-2 gap-4">
          <InputGroup label="Business Unit">
            <Controller
              control={control}
              name="businessUnit"
              render={({ field: { value, onChange: fieldOnChange } }) => (
                <SelectInput
                  value={value ?? ''}
                  onChange={(event) => fieldOnChange(event.target.value)}
                >
                  {businessUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            />
          </InputGroup>
          <InputGroup label="Funding Center">
            <Controller
              control={control}
              name="fundingBusinessUnit"
              render={({ field: { value, onChange: fieldOnChange } }) => (
                <SelectInput
                  value={value ?? ''}
                  onChange={(event) => fieldOnChange(event.target.value)}
                >
                  {businessUnits.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            />
          </InputGroup>
        </div>
      </div>

      <div className="space-y-4 border-b border-slate-800 pb-4">
        <h4 className="text-xs font-bold uppercase text-slate-400">{t.productStructure}</h4>
        <InputGroup label={t.productDefinition}>
          <Controller
            control={control}
            name="productType"
            render={({ field: { value, onChange: fieldOnChange } }) => (
              <SelectInput
                value={value ?? ''}
                onChange={(event) => {
                  const product = products.find(item => item.id === event.target.value);
                  fieldOnChange(event.target.value);
                  if (product) {
                    form.setValue('category', product.category);
                  }
                }}
              >
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </SelectInput>
            )}
          />
        </InputGroup>

        <div className="grid grid-cols-2 gap-4">
          <InputGroup label="Amount">
            <TextInput
              type="number"
              {...register('amount', { valueAsNumber: true })}
            />
          </InputGroup>
          <InputGroup label="Currency">
            <Controller
              control={control}
              name="currency"
              render={({ field: { value, onChange: fieldOnChange } }) => (
                <SelectInput
                  value={value ?? 'USD'}
                  onChange={(event) => fieldOnChange(event.target.value)}
                >
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>JPY</option>
                </SelectInput>
              )}
            />
          </InputGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputGroup label={t.startDate}>
            <TextInput
              type="date"
              {...register('startDate')}
            />
          </InputGroup>
          <InputGroup label={t.durationMonths}>
            <TextInput
              type="number"
              {...register('durationMonths', { valueAsNumber: true })}
            />
          </InputGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputGroup label="Amortization">
            <Controller
              control={control}
              name="amortization"
              render={({ field: { value, onChange: fieldOnChange } }) => (
                <SelectInput
                  value={value ?? 'Bullet'}
                  onChange={(event) => fieldOnChange(event.target.value)}
                >
                  <option value="Bullet">Bullet</option>
                  <option value="French">French</option>
                  <option value="Linear">Linear</option>
                </SelectInput>
              )}
            />
          </InputGroup>
          <InputGroup label={t.repricing}>
            <Controller
              control={control}
              name="repricingFreq"
              render={({ field: { value, onChange: fieldOnChange } }) => (
                <SelectInput
                  value={value ?? 'Fixed'}
                  onChange={(event) => fieldOnChange(event.target.value)}
                >
                  <option value="Daily">Daily</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Fixed">Fixed</option>
                </SelectInput>
              )}
            />
          </InputGroup>
        </div>

        <InputGroup label="Margin Target (%)">
          <TextInput
            type="number"
            step="0.01"
            {...register('marginTarget', { valueAsNumber: true })}
          />
        </InputGroup>
      </div>

      <div className="space-y-4 border-b border-slate-800 pb-4">
        <h4 className="text-xs font-bold uppercase text-slate-400">{t.riskAndCapital}</h4>
        <div className="grid grid-cols-2 gap-4">
          <InputGroup label="Risk Weight (%)">
            <TextInput
              type="number"
              {...register('riskWeight', { valueAsNumber: true })}
            />
          </InputGroup>
          <InputGroup label="Capital Ratio (%)">
            <TextInput
              type="number"
              step="0.1"
              {...register('capitalRatio', { valueAsNumber: true })}
            />
          </InputGroup>
          <InputGroup label="Target ROE (%)">
            <TextInput
              type="number"
              {...register('targetROE', { valueAsNumber: true })}
            />
          </InputGroup>
          <InputGroup label="Op Cost (bps)">
            <TextInput
              type="number"
              {...register('operationalCostBps', { valueAsNumber: true })}
            />
          </InputGroup>
          <InputGroup label="LCR Outflow (%)">
            <TextInput
              type="number"
              {...register('lcrOutflowPct', { valueAsNumber: true })}
            />
          </InputGroup>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase text-slate-400">{t.behaviouralAndEsg}</h4>
        <InputGroup label="Behavioural Model">
          <Controller
            control={control}
            name="behaviouralModelId"
            render={({ field: { value, onChange: fieldOnChange } }) => (
              <SelectInput
                value={value ?? ''}
                onChange={(event) => fieldOnChange(event.target.value)}
              >
                <option value="">-- None --</option>
                {availableModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </SelectInput>
            )}
          />
        </InputGroup>

        <div className="grid grid-cols-2 gap-4">
          <InputGroup label="Transition Risk">
            <Controller
              control={control}
              name="transitionRisk"
              render={({ field: { value, onChange: fieldOnChange } }) => (
                <SelectInput
                  value={value ?? 'Neutral'}
                  onChange={(event) => fieldOnChange(event.target.value)}
                >
                  <option value="Green">Green</option>
                  <option value="Neutral">Neutral</option>
                  <option value="Amber">Amber</option>
                  <option value="Brown">Brown</option>
                </SelectInput>
              )}
            />
          </InputGroup>
          <InputGroup label="Physical Risk">
            <Controller
              control={control}
              name="physicalRisk"
              render={({ field: { value, onChange: fieldOnChange } }) => (
                <SelectInput
                  value={value ?? 'Low'}
                  onChange={(event) => fieldOnChange(event.target.value)}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </SelectInput>
              )}
            />
          </InputGroup>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase text-slate-400">{t.workflowStatus}</h4>
        <div className={`rounded border p-3 text-center text-xs font-bold uppercase tracking-wider ${getStatusColor(selectedDeal.status || 'Draft')}`}>
          {formatStatus(selectedDeal.status || 'Draft')}
        </div>
        <p className="text-[10px] text-slate-600">
          {t.statusManagedViaWorkflow}
        </p>
      </div>
    </div>
  );
};

export default DealForm;
