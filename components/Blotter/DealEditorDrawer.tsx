import React from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Drawer } from '../ui/Drawer';
import DealForm from './DealForm';
import type {
  BehaviouralModel,
  BusinessUnit,
  ClientEntity,
  ProductDefinition,
  Transaction,
  ValidationError,
} from './dealEditorTypes';

interface DealEditorDrawerProps {
  isOpen: boolean;
  mode: 'edit' | 'create';
  selectedDeal: Partial<Transaction> | null;
  clients: ClientEntity[];
  businessUnits: BusinessUnit[];
  products: ProductDefinition[];
  behaviouralModels: BehaviouralModel[];
  validationErrors: ValidationError[];
  onClose: () => void;
  onSubmit: () => void;
  onChange: (updates: Partial<Transaction>) => void;
  onFormReady: (form: UseFormReturn<Transaction>) => void;
}

const actionCopy = {
  edit: {
    title: (dealId?: string) => `Edit Deal: ${dealId || ''}`,
    confirm: 'Save Changes',
    tone: 'bg-cyan-600 hover:bg-cyan-500',
  },
  create: {
    title: () => 'Create New Transaction',
    confirm: 'Create Deal',
    tone: 'bg-emerald-600 hover:bg-emerald-500',
  },
} as const;

const DealEditorDrawer: React.FC<DealEditorDrawerProps> = ({
  isOpen,
  mode,
  selectedDeal,
  clients,
  businessUnits,
  products,
  behaviouralModels,
  validationErrors,
  onClose,
  onSubmit,
  onChange,
  onFormReady,
}) => {
  const copy = actionCopy[mode];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={copy.title(selectedDeal?.id)}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
            Cancel
          </button>
          <button onClick={onSubmit} className={`rounded px-4 py-2 text-xs font-bold text-white ${copy.tone}`}>
            {copy.confirm}
          </button>
        </div>
      }
    >
      {validationErrors.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-wider text-red-400">Validation Errors</div>
          <ul className="space-y-0.5">
            {validationErrors.map((err) => (
              <li key={err.field} className="text-[11px] text-red-300">
                <span className="font-mono text-red-400">{err.field}</span>: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedDeal && (
        <DealForm
          selectedDeal={selectedDeal}
          clients={clients}
          businessUnits={businessUnits}
          products={products}
          behaviouralModels={behaviouralModels}
          onChange={onChange}
          onFormReady={onFormReady}
        />
      )}
    </Drawer>
  );
};

export default DealEditorDrawer;
