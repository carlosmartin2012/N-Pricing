import React, { useMemo, useState, useCallback } from 'react';
import { Transaction, FTPResult, ApprovalMatrixConfig } from '../../types';
import { calculatePricing, PricingShocks, PricingContext } from '../../utils/pricingEngine';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { TrendingUp, TrendingDown, Minus, Plus, Trash2, Copy, ChevronDown, ChevronUp, GitCompare } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  shocks: PricingShocks;
  overrides: Partial<Transaction>;
}

interface Props {
  baseDeal: Transaction;
  approvalMatrix: ApprovalMatrixConfig;
}

const DEFAULT_SCENARIOS: Scenario[] = [
  { id: 'base', name: 'Base Case', shocks: { interestRate: 0, liquiditySpread: 0 }, overrides: {} },
  { id: 'stress-up', name: 'Rates +100bps', shocks: { interestRate: 100, liquiditySpread: 0 }, overrides: {} },
  { id: 'stress-down', name: 'Rates -50bps', shocks: { interestRate: -50, liquiditySpread: 0 }, overrides: {} },
];

type MetricRow = {
  label: string;
  key: keyof FTPResult | string;
  format: 'pct' | 'approval';
  higherIsBetter?: boolean;
};

const METRIC_ROWS: MetricRow[] = [
  { label: 'Base Rate', key: 'baseRate', format: 'pct' },
  { label: 'Liquidity Premium', key: 'liquiditySpread', format: 'pct' },
  { label: 'LCR Charge', key: 'lcrCost', format: 'pct' },
  { label: 'NSFR Charge', key: 'nsfrCost', format: 'pct' },
  { label: 'Capital Charge', key: 'capitalCharge', format: 'pct' },
  { label: 'ESG Adjustment', key: 'esgTotal', format: 'pct' },
  { label: 'Total FTP', key: 'totalFTP', format: 'pct' },
  { label: 'Final Client Rate', key: 'finalClientRate', format: 'pct' },
  { label: 'RAROC', key: 'raroc', format: 'pct', higherIsBetter: true },
  { label: 'Approval Level', key: 'approvalLevel', format: 'approval' },
];

function getMetricValue(result: FTPResult, key: string): number | string {
  if (key === 'esgTotal') return (result.esgTransitionCharge || 0) + (result.esgPhysicalCharge || 0);
  if (key === 'approvalLevel') return result.approvalLevel;
  return (result as any)[key] ?? 0;
}

function formatValue(val: number | string, format: 'pct' | 'approval'): string {
  if (format === 'approval') return String(val);
  if (typeof val === 'number') return `${val.toFixed(4)}%`;
  return String(val);
}

function approvalRank(level: string): number {
  const ranks: Record<string, number> = { 'Auto': 0, 'L1_Manager': 1, 'L2_Committee': 2, 'Rejected': 3 };
  return ranks[level] ?? 99;
}

let scenarioCounter = 0;

const PricingComparison: React.FC<Props> = ({ baseDeal, approvalMatrix }) => {
  const data = useData();
  const ui = useUI();
  const t = ui.t;

  const [isExpanded, setIsExpanded] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);

  const pricingContext: PricingContext = useMemo(() => ({
    yieldCurve: data.yieldCurves,
    liquidityCurves: data.liquidityCurves,
    rules: data.rules,
    rateCards: data.ftpRateCards,
    transitionGrid: data.transitionGrid,
    physicalGrid: data.physicalGrid,
    behaviouralModels: data.behaviouralModels,
    clients: data.clients,
    products: data.products,
    businessUnits: data.businessUnits,
  }), [data.yieldCurves, data.liquidityCurves, data.rules, data.ftpRateCards, data.transitionGrid, data.physicalGrid, data.behaviouralModels, data.clients, data.products, data.businessUnits]);

  const results: FTPResult[] = useMemo(() => {
    return scenarios.map(scenario => {
      const deal: Transaction = { ...baseDeal, ...scenario.overrides };
      return calculatePricing(deal, approvalMatrix, pricingContext, scenario.shocks);
    });
  }, [scenarios, baseDeal, approvalMatrix, pricingContext]);

  const addScenario = useCallback(() => {
    if (scenarios.length >= 3) return;
    scenarioCounter++;
    setScenarios(prev => [
      ...prev,
      {
        id: `custom-${scenarioCounter}`,
        name: `Scenario ${prev.length + 1}`,
        shocks: { interestRate: 0, liquiditySpread: 0 },
        overrides: {},
      },
    ]);
  }, [scenarios.length]);

  const removeScenario = useCallback((id: string) => {
    if (id === 'base') return;
    setScenarios(prev => prev.filter(s => s.id !== id));
  }, []);

  const duplicateScenario = useCallback((scenario: Scenario) => {
    if (scenarios.length >= 3) return;
    scenarioCounter++;
    setScenarios(prev => [
      ...prev,
      { ...scenario, id: `dup-${scenarioCounter}`, name: `${scenario.name} (copy)` },
    ]);
  }, [scenarios.length]);

  const updateScenario = useCallback((id: string, updates: Partial<Scenario>) => {
    setScenarios(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const updateShock = useCallback((id: string, key: keyof PricingShocks, value: number) => {
    setScenarios(prev =>
      prev.map(s =>
        s.id === id ? { ...s, shocks: { ...s.shocks, [key]: value } } : s
      )
    );
  }, []);

  const updateOverride = useCallback((id: string, key: keyof Transaction, value: any) => {
    setScenarios(prev =>
      prev.map(s =>
        s.id === id ? { ...s, overrides: { ...s.overrides, [key]: value } } : s
      )
    );
  }, []);

  const baseResult = results[0];

  function getDeltaColor(row: MetricRow, val: number | string, baseVal: number | string): string {
    if (typeof val !== 'number' || typeof baseVal !== 'number') {
      if (row.format === 'approval') {
        const diff = approvalRank(String(val)) - approvalRank(String(baseVal));
        if (diff < 0) return 'text-emerald-400';
        if (diff > 0) return 'text-red-400';
      }
      return 'text-slate-400';
    }
    const diff = val - baseVal;
    if (Math.abs(diff) < 0.0001) return 'text-slate-400';
    const better = row.higherIsBetter ? diff > 0 : diff < 0;
    return better ? 'text-emerald-400' : 'text-red-400';
  }

  function getDeltaIcon(row: MetricRow, val: number | string, baseVal: number | string) {
    if (typeof val !== 'number' || typeof baseVal !== 'number') return <Minus size={12} />;
    const diff = val - baseVal;
    if (Math.abs(diff) < 0.0001) return <Minus size={12} className="text-slate-500" />;
    return diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  }

  function formatDelta(val: number | string, baseVal: number | string, format: 'pct' | 'approval'): string {
    if (format === 'approval') return String(val);
    if (typeof val === 'number' && typeof baseVal === 'number') {
      const diff = val - baseVal;
      if (Math.abs(diff) < 0.0001) return '-';
      const sign = diff > 0 ? '+' : '';
      return `${sign}${diff.toFixed(4)}%`;
    }
    return '-';
  }

  const collateralOptions: Transaction['collateralType'][] = ['None', 'Sovereign', 'Corporate', 'Cash', 'Real_Estate'];

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 border border-slate-700/50 rounded-lg hover:bg-slate-800/60 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <GitCompare size={16} className="text-cyan-400" />
          <span className="text-sm font-medium text-slate-200">{t.compareScenarios || 'Compare Scenarios'}</span>
          <span className="text-xs text-slate-500 font-mono">({scenarios.length}/3)</span>
        </div>
        {isExpanded ? (
          <ChevronUp size={16} className="text-slate-400 group-hover:text-slate-200" />
        ) : (
          <ChevronDown size={16} className="text-slate-400 group-hover:text-slate-200" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 bg-slate-900/40 border border-slate-700/40 rounded-lg p-4 space-y-4">
          {/* Scenario Cards */}
          <div className="flex gap-3 flex-wrap">
            {scenarios.map((scenario, idx) => (
              <div
                key={scenario.id}
                className={`flex-1 min-w-[220px] max-w-[320px] bg-slate-800/60 border rounded-lg p-3 space-y-3 ${
                  idx === 0 ? 'border-cyan-600/50' : 'border-slate-600/40'
                }`}
              >
                {/* Scenario Name */}
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={scenario.name}
                    onChange={e => updateScenario(scenario.id, { name: e.target.value })}
                    className="bg-transparent border-b border-slate-600 text-sm font-medium text-slate-100 focus:border-cyan-500 focus:outline-none w-full mr-2 px-0 py-0.5"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    {scenarios.length < 3 && (
                      <button
                        onClick={() => duplicateScenario(scenario)}
                        className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
                        title="Duplicate"
                      >
                        <Copy size={13} />
                      </button>
                    )}
                    {scenario.id !== 'base' && (
                      <button
                        onClick={() => removeScenario(scenario.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Shock Inputs */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                    Interest Rate (bps)
                  </label>
                  <input
                    type="number"
                    value={scenario.shocks.interestRate}
                    onChange={e => updateShock(scenario.id, 'interestRate', Number(e.target.value))}
                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                    Liquidity Spread (bps)
                  </label>
                  <input
                    type="number"
                    value={scenario.shocks.liquiditySpread}
                    onChange={e => updateShock(scenario.id, 'liquiditySpread', Number(e.target.value))}
                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Overrides */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                    Margin Target (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={scenario.overrides.marginTarget ?? baseDeal.marginTarget}
                    onChange={e => updateOverride(scenario.id, 'marginTarget', Number(e.target.value))}
                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                    Collateral Type
                  </label>
                  <select
                    value={scenario.overrides.collateralType ?? baseDeal.collateralType ?? 'None'}
                    onChange={e => updateOverride(scenario.id, 'collateralType', e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-600/50 rounded px-2 py-1 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                  >
                    {collateralOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {/* Add Scenario Button */}
            {scenarios.length < 3 && (
              <button
                onClick={addScenario}
                className="flex-1 min-w-[180px] max-w-[320px] bg-slate-800/30 border border-dashed border-slate-600/40 rounded-lg p-3 flex flex-col items-center justify-center gap-2 hover:border-cyan-600/50 hover:bg-slate-800/50 transition-colors"
              >
                <Plus size={20} className="text-slate-500" />
                <span className="text-xs text-slate-500">{t.addScenario || 'Add Scenario'}</span>
              </button>
            )}
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 px-3 text-slate-400 font-mono uppercase tracking-wider text-[10px] w-40">
                    Metric
                  </th>
                  {scenarios.map((scenario, idx) => (
                    <th
                      key={scenario.id}
                      className={`text-right py-2 px-3 font-mono text-[10px] uppercase tracking-wider ${
                        idx === 0 ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    >
                      {scenario.name}
                      {idx > 0 && (
                        <div className="text-[9px] text-slate-500 font-normal normal-case mt-0.5">
                          {t.delta || 'Delta'}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map(row => {
                  const baseVal = getMetricValue(baseResult, row.key);
                  return (
                    <tr key={row.key} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                      <td className="py-2 px-3 text-slate-300 font-medium">{row.label}</td>
                      {results.map((result, idx) => {
                        const val = getMetricValue(result, row.key);
                        const isBase = idx === 0;
                        return (
                          <td key={scenarios[idx].id} className="py-2 px-3 text-right font-mono">
                            <div className="text-slate-200">{formatValue(val, row.format)}</div>
                            {!isBase && (
                              <div className={`flex items-center justify-end gap-1 mt-0.5 ${getDeltaColor(row, val, baseVal)}`}>
                                {getDeltaIcon(row, val, baseVal)}
                                <span className="text-[10px]">{formatDelta(val, baseVal, row.format)}</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingComparison;
