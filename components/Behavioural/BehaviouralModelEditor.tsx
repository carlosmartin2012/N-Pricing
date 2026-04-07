import React from 'react';
import { Activity, Plus, Split, X } from 'lucide-react';
import {
  InputGroup,
  SelectInput,
  TextInput,
} from '../ui/LayoutComponents';
import type {
  BehaviouralModel,
  ReplicationTranche,
} from '../../types';
import { useUI } from '../../contexts/UIContext';

interface Props {
  editingModel: Partial<BehaviouralModel>;
  totalWeight: number;
  onChange: (updates: Partial<BehaviouralModel>) => void;
  onTrancheChange: (index: number, field: keyof ReplicationTranche, value: ReplicationTranche[keyof ReplicationTranche]) => void;
  onAddTranche: () => void;
  onRemoveTranche: (index: number) => void;
}

const BehaviouralModelEditor: React.FC<Props> = ({
  editingModel,
  totalWeight,
  onChange,
  onTrancheChange,
  onAddTranche,
  onRemoveTranche,
}) => {
  const { t } = useUI();

  return (
  <div className="space-y-6">
    <InputGroup label="Model Type">
      <SelectInput
        value={editingModel.type}
        onChange={(event) => onChange({ type: event.target.value as BehaviouralModel['type'] })}
      >
        <option value="NMD_Replication">NMD (Core & Caterpillar)</option>
        <option value="Prepayment_CPR">Prepayment (CPR)</option>
      </SelectInput>
      <p className="mt-1 text-[9px] text-slate-500">Select the behavioural methodology</p>
    </InputGroup>

    <InputGroup label="Model Name">
      <TextInput
        value={editingModel.name}
        onChange={(event) => onChange({ name: event.target.value })}
        placeholder="e.g. Retail Savings"
      />
    </InputGroup>

    <InputGroup label="Description">
      <TextInput
        value={editingModel.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </InputGroup>

    <div className="border-t border-slate-800 pt-4">
      <h4 className="mb-4 text-xs font-bold uppercase text-cyan-400">Parameters</h4>

      {editingModel.type === 'NMD_Replication' ? (
        <div className="space-y-6">
          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <h5 className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase text-emerald-400">
              <Activity size={12} /> Core & Sensitivity
            </h5>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Core Ratio (%)" tooltip={t.tooltip_behav_coreRatio}>
                <div className="relative">
                  <TextInput
                    type="number"
                    value={editingModel.coreRatio}
                    onChange={(event) => onChange({ coreRatio: Number(event.target.value) || 0 })}
                    className="font-bold text-emerald-400"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                </div>
                <p className="mt-1 text-[9px] text-slate-500">Stable volume portion</p>
              </InputGroup>
              <InputGroup label="Beta Factor (0-1)" tooltip={t.tooltip_behav_betaFactor}>
                <TextInput
                  type="number"
                  step="0.05"
                  value={editingModel.betaFactor}
                  onChange={(event) => onChange({ betaFactor: Number(event.target.value) || 0 })}
                  className="font-bold text-cyan-400"
                />
                <p className="mt-1 text-[9px] text-slate-500">Rate sensitivity</p>
              </InputGroup>
            </div>
          </div>

          <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="flex items-center gap-2 text-[10px] font-bold uppercase text-purple-400">
                <Split size={12} /> Replication Profile (Caterpillar)
              </h5>
              <button
                onClick={onAddTranche}
                className="flex items-center gap-1 rounded border border-cyan-900/50 bg-cyan-950/30 px-2 py-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300"
              >
                <Plus size={10} /> Add Tranche
              </button>
            </div>

            <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {editingModel.replicationProfile?.map((tranche, index) => (
                <div key={index} className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 p-1.5">
                  <div className="w-20 shrink-0">
                    <label className="mb-0.5 block text-[9px] text-slate-500">Term</label>
                    <SelectInput
                      value={tranche.term}
                      onChange={(event) => onTrancheChange(index, 'term', event.target.value)}
                      className="w-full py-1 text-xs"
                    >
                      <option>ON</option>
                      <option>1M</option>
                      <option>3M</option>
                      <option>6M</option>
                      <option>1Y</option>
                      <option>2Y</option>
                      <option>3Y</option>
                      <option>5Y</option>
                      <option>7Y</option>
                      <option>10Y</option>
                    </SelectInput>
                  </div>
                  <div className="flex-1">
                    <label className="mb-0.5 block text-[9px] text-slate-500">Weight (%)</label>
                    <TextInput
                      type="number"
                      value={tranche.weight}
                      onChange={(event) => onTrancheChange(index, 'weight', Number(event.target.value) || 0)}
                      className="w-full py-1 text-xs font-bold text-purple-400"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-0.5 block text-[9px] text-slate-500">Spread (bps)</label>
                    <TextInput
                      type="number"
                      value={tranche.spread}
                      onChange={(event) => onTrancheChange(index, 'spread', Number(event.target.value) || 0)}
                      className="w-full py-1 text-xs"
                    />
                  </div>
                  <button onClick={() => onRemoveTranche(index)} className="mt-3 p-1 text-slate-600 hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ))}

              {(!editingModel.replicationProfile || editingModel.replicationProfile.length === 0) && (
                <div className="rounded border border-dashed border-slate-700 p-4 text-center text-[10px] text-slate-500">
                  No replication tranches defined.
                </div>
              )}
            </div>

            <div className={`mt-3 rounded border p-2 text-center text-xs font-bold ${totalWeight === 100 ? 'border-emerald-900 bg-emerald-950/30 text-emerald-400' : 'border-red-900 bg-red-950/30 text-red-400'}`}>
              Total Weight: {totalWeight}%
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="Constant Prep. Rate (CPR %)" tooltip={t.tooltip_behav_cpr}>
              <TextInput
                type="number"
                value={editingModel.cpr}
                onChange={(event) => onChange({ cpr: Number(event.target.value) || 0 })}
              />
            </InputGroup>
            <InputGroup label="Penalty Free Allowance (%)" tooltip={t.tooltip_behav_penaltyFree}>
              <TextInput
                type="number"
                value={editingModel.penaltyExempt}
                onChange={(event) => onChange({ penaltyExempt: Number(event.target.value) || 0 })}
              />
            </InputGroup>
          </div>
          <InputGroup label="Curve Type">
            <SelectInput value="Constant (CPR)" onChange={() => undefined}>
              <option>Constant (CPR)</option>
              <option>PSA Standard</option>
              <option>Custom Seasonality</option>
            </SelectInput>
          </InputGroup>
        </div>
      )}
    </div>
  </div>
  );
};

export default BehaviouralModelEditor;
