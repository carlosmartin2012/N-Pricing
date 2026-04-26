import React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import type { Transaction } from '../../types';
import type { PricingShocks } from '../../utils/pricingEngine';
import type { PricingScenario } from './pricingComparisonUtils';
import { useUI } from '../../contexts/UIContext';

interface Props {
  scenario: PricingScenario;
  scenarioIndex: number;
  scenariosLength: number;
  baseDeal: Transaction;
  collateralOptions: Transaction['collateralType'][];
  maxScenarios: number;
  onUpdateScenario: (id: string, updates: Partial<PricingScenario>) => void;
  onUpdateShock: (id: string, key: keyof PricingShocks, value: number) => void;
  onUpdateOverride: (id: string, key: keyof Transaction, value: unknown) => void;
  onDuplicate: (scenario: PricingScenario) => void;
  onRemove: (id: string) => void;
}

export const PricingScenarioCard: React.FC<Props> = ({
  scenario,
  scenarioIndex,
  scenariosLength,
  baseDeal,
  collateralOptions,
  maxScenarios,
  onUpdateScenario,
  onUpdateShock,
  onUpdateOverride,
  onDuplicate,
  onRemove,
}) => {
  const { t } = useUI();
  return (
    <div
      className={`flex-1 min-w-[220px] max-w-[320px] rounded-lg border bg-slate-800/60 p-3 space-y-3 ${
        scenarioIndex === 0 ? 'border-cyan-600/50' : 'border-slate-600/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <input
          type="text"
          value={scenario.name}
          onChange={(event) => onUpdateScenario(scenario.id, { name: event.target.value })}
          className="mr-2 w-full border-b border-slate-600 bg-transparent px-0 py-0.5 text-sm font-medium text-slate-100 focus:border-cyan-500 focus:outline-none"
        />
        <div className="flex shrink-0 items-center gap-1">
          {scenariosLength < maxScenarios && (
            <button
              onClick={() => onDuplicate(scenario)}
              className="p-1 text-slate-500 transition-colors hover:text-cyan-400"
              title={t.duplicate}
            >
              <Copy size={13} />
            </button>
          )}
          {scenario.id !== 'base' && (
            <button
              onClick={() => onRemove(scenario.id)}
              className="p-1 text-slate-500 transition-colors hover:text-red-400"
              title={t.remove}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono tracking-normal text-slate-500">
          {t.interestRateBps}
        </label>
        <input
          type="number"
          value={scenario.shocks.interestRate}
          onChange={(event) => onUpdateShock(scenario.id, 'interestRate', Number(event.target.value))}
          className="w-full rounded border border-slate-600/50 bg-slate-900/60 px-2 py-1 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono tracking-normal text-slate-500">
          {t.liquiditySpreadBps}
        </label>
        <input
          type="number"
          value={scenario.shocks.liquiditySpread}
          onChange={(event) => onUpdateShock(scenario.id, 'liquiditySpread', Number(event.target.value))}
          className="w-full rounded border border-slate-600/50 bg-slate-900/60 px-2 py-1 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono tracking-normal text-slate-500">
          {t.marginTargetPct}
        </label>
        <input
          type="number"
          step="0.01"
          value={scenario.overrides.marginTarget ?? baseDeal.marginTarget}
          onChange={(event) => onUpdateOverride(scenario.id, 'marginTarget', Number(event.target.value))}
          className="w-full rounded border border-slate-600/50 bg-slate-900/60 px-2 py-1 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-mono tracking-normal text-slate-500">
          {t.collateralType}
        </label>
        <select
          value={scenario.overrides.collateralType ?? baseDeal.collateralType ?? 'None'}
          onChange={(event) => onUpdateOverride(scenario.id, 'collateralType', event.target.value)}
          className="w-full rounded border border-slate-600/50 bg-slate-900/60 px-2 py-1 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
        >
          {collateralOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
