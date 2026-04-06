import React, { useCallback, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GitCompare, Plus } from 'lucide-react';
import type { ApprovalMatrixConfig, FTPResult, Transaction } from '../../types';
import { calculatePricing } from '../../utils/pricingEngine';
import { useUI } from '../../contexts/UIContext';
import { usePricingContext } from '../../hooks/usePricingContext';
import { PricingComparisonTable } from './PricingComparisonTable';
import { PricingScenarioCard } from './PricingScenarioCard';
import {
  COLLATERAL_OPTIONS,
  DEFAULT_PRICING_SCENARIOS,
  MAX_COMPARISON_SCENARIOS,
  type PricingScenario,
} from './pricingComparisonUtils';

interface Props {
  baseDeal: Transaction;
  approvalMatrix: ApprovalMatrixConfig;
}

let scenarioCounter = 0;

const PricingComparison: React.FC<Props> = ({ baseDeal, approvalMatrix }) => {
  const { t } = useUI();
  const pricingContext = usePricingContext();

  const [isExpanded, setIsExpanded] = useState(false);
  const [scenarios, setScenarios] = useState<PricingScenario[]>(DEFAULT_PRICING_SCENARIOS);

  const results: FTPResult[] = useMemo(
    () =>
      scenarios.map((scenario) => {
        const deal: Transaction = { ...baseDeal, ...scenario.overrides };
        return calculatePricing(deal, approvalMatrix, pricingContext, scenario.shocks);
      }),
    [scenarios, baseDeal, approvalMatrix, pricingContext],
  );

  const addScenario = useCallback(() => {
    if (scenarios.length >= MAX_COMPARISON_SCENARIOS) return;

    scenarioCounter += 1;
    setScenarios((previousScenarios) => [
      ...previousScenarios,
      {
        id: `custom-${scenarioCounter}`,
        name: `Scenario ${previousScenarios.length + 1}`,
        shocks: { interestRate: 0, liquiditySpread: 0 },
        overrides: {},
      },
    ]);
  }, [scenarios.length]);

  const removeScenario = useCallback((id: string) => {
    if (id === 'base') return;
    setScenarios((previousScenarios) => previousScenarios.filter((scenario) => scenario.id !== id));
  }, []);

  const duplicateScenario = useCallback((scenario: PricingScenario) => {
    if (scenarios.length >= MAX_COMPARISON_SCENARIOS) return;

    scenarioCounter += 1;
    setScenarios((previousScenarios) => [
      ...previousScenarios,
      {
        ...scenario,
        id: `dup-${scenarioCounter}`,
        name: `${scenario.name} (copy)`,
      },
    ]);
  }, [scenarios.length]);

  const updateScenario = useCallback((id: string, updates: Partial<PricingScenario>) => {
    setScenarios((previousScenarios) =>
      previousScenarios.map((scenario) =>
        scenario.id === id ? { ...scenario, ...updates } : scenario,
      ),
    );
  }, []);

  const updateShock = useCallback((id: string, key: keyof PricingScenario['shocks'], value: number) => {
    setScenarios((previousScenarios) =>
      previousScenarios.map((scenario) =>
        scenario.id === id
          ? { ...scenario, shocks: { ...scenario.shocks, [key]: value } }
          : scenario,
      ),
    );
  }, []);

  const updateOverride = useCallback((id: string, key: keyof Transaction, value: unknown) => {
    setScenarios((previousScenarios) =>
      previousScenarios.map((scenario) =>
        scenario.id === id
          ? { ...scenario, overrides: { ...scenario.overrides, [key]: value } }
          : scenario,
      ),
    );
  }, []);

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsExpanded((currentValue) => !currentValue)}
        className="group flex w-full items-center justify-between rounded-lg border border-slate-700/50 bg-slate-900/60 px-4 py-3 transition-colors hover:bg-slate-800/60"
      >
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">
            {t.compareScenarios || 'Compare Scenarios'}
          </span>
          <span className="font-mono text-xs text-slate-500">
            ({scenarios.length}/{MAX_COMPARISON_SCENARIOS})
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-slate-400 group-hover:text-slate-200" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-200" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4 rounded-lg border border-slate-700/40 bg-slate-900/40 p-4">
          <div className="flex flex-wrap gap-3">
            {scenarios.map((scenario, index) => (
              <PricingScenarioCard
                key={scenario.id}
                scenario={scenario}
                scenarioIndex={index}
                scenariosLength={scenarios.length}
                baseDeal={baseDeal}
                collateralOptions={COLLATERAL_OPTIONS}
                maxScenarios={MAX_COMPARISON_SCENARIOS}
                onUpdateScenario={updateScenario}
                onUpdateShock={updateShock}
                onUpdateOverride={updateOverride}
                onDuplicate={duplicateScenario}
                onRemove={removeScenario}
              />
            ))}

            {scenarios.length < MAX_COMPARISON_SCENARIOS && (
              <button
                onClick={addScenario}
                className="flex min-w-[180px] max-w-[320px] flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600/40 bg-slate-800/30 p-3 transition-colors hover:border-cyan-600/50 hover:bg-slate-800/50"
              >
                <Plus size={20} className="text-slate-500" />
                <span className="text-xs text-slate-500">
                  {t.addScenario || 'Add Scenario'}
                </span>
              </button>
            )}
          </div>

          <PricingComparisonTable
            scenarios={scenarios}
            results={results}
            deltaLabel={t.delta || 'Delta'}
          />
        </div>
      )}
    </div>
  );
};

export default PricingComparison;
