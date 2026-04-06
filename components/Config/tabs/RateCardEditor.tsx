import React from 'react';
import { Plus, X } from 'lucide-react';
import {
  InputGroup,
  SelectInput,
  TextInput,
} from '../../ui/LayoutComponents';
import type { FtpRateCard, YieldCurvePoint } from '../../../types';

interface Props {
  editingRateCard: Partial<FtpRateCard>;
  onChange: (updates: Partial<FtpRateCard>) => void;
}

const RateCardEditor: React.FC<Props> = ({
  editingRateCard,
  onChange,
}) => {
  const points = editingRateCard.points || [];

  const updatePoint = (index: number, updates: Partial<YieldCurvePoint>) => {
    const nextPoints = [...points];
    nextPoints[index] = { ...nextPoints[index], ...updates };
    onChange({ points: nextPoints });
  };

  return (
    <div className="space-y-4">
      <InputGroup label="Curve Name">
        <TextInput
          value={editingRateCard.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="e.g. USD Liquidity Std"
        />
      </InputGroup>

      <div className="grid grid-cols-2 gap-4">
        <InputGroup label="Type">
          <SelectInput
            value={editingRateCard.type}
            onChange={(event) => onChange({ type: event.target.value as FtpRateCard['type'] })}
          >
            <option value="Liquidity">Liquidity</option>
            <option value="Commercial">Commercial</option>
            <option value="Basis">Basis</option>
            <option value="Credit">Credit</option>
          </SelectInput>
        </InputGroup>
        <InputGroup label="Currency">
          <SelectInput
            value={editingRateCard.currency}
            onChange={(event) => onChange({ currency: event.target.value })}
          >
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
          </SelectInput>
        </InputGroup>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase text-slate-500">Curve Points (Tenor / Rate)</label>
          <button
            onClick={() => onChange({ points: [...points, { tenor: '1Y', rate: 0 }] })}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-white"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        <div className="max-h-60 space-y-2 overflow-y-auto pr-2">
          {points.map((point, index) => (
            <div key={index} className="flex items-center gap-2">
              <TextInput
                value={point.tenor}
                onChange={(event) => updatePoint(index, { tenor: event.target.value })}
                className="w-16 text-center"
              />
              <div className="relative flex-1">
                <TextInput
                  type="number"
                  value={point.rate}
                  onChange={(event) => updatePoint(index, { rate: Number(event.target.value) || 0 })}
                  className="w-full pr-8 text-right"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
              </div>
              <button
                onClick={() => onChange({ points: points.filter((_, pointIndex) => pointIndex !== index) })}
                className="text-slate-600 hover:text-red-400"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RateCardEditor;
