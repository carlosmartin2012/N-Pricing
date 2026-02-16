import React, { useState, useMemo } from 'react';
import { Panel, Badge } from '../ui/LayoutComponents';
import { translations, Language } from '../../translations';
import { Transaction, ApprovalMatrixConfig } from '../../types';
import { calculatePricing, PricingShocks } from '../../utils/pricingEngine';
import { RefreshCcw, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
    deal: Transaction;
    approvalMatrix: ApprovalMatrixConfig;
    language: Language;
    shocks: PricingShocks;
    setShocks: (s: PricingShocks) => void;
}

const ShocksDashboard: React.FC<Props> = ({ deal, approvalMatrix, language, shocks, setShocks }) => {
    const t = translations[language];
    // Local state removed, using props now

    const baseResult = useMemo(() => calculatePricing(deal, approvalMatrix, { interestRate: 0, liquiditySpread: 0 }), [deal, approvalMatrix]);
    const shockedResult = useMemo(() => calculatePricing(deal, approvalMatrix, shocks), [deal, approvalMatrix, shocks]);

    const handleReset = () => {
        setShocks({ interestRate: 0, liquiditySpread: 0 });
    };

    const deltaFTP = shockedResult.totalFTP - baseResult.totalFTP;
    const deltaRAROC = shockedResult.raroc - baseResult.raroc;
    const deltaClientRate = shockedResult.finalClientRate - baseResult.finalClientRate;

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full">
            {/* Configuration Panel */}
            <div className="lg:col-span-4 h-full">
                <Panel title={t.shocksConfig || 'Shocks Configuration'} className="h-full bg-white dark:bg-[#0a0a0a]">
                    <div className="p-6 space-y-8">

                        {/* Deal Info Header */}
                        <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Target Transaction</div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{deal.id || 'NEW-DEAL'}</span>
                                <Badge variant="outline">{deal.productType}</Badge>
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{deal.clientId}</div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-cyan-500" />
                                    {t.interestRateShock || 'Interest Rate Shock'}
                                </label>
                                <span className="text-sm font-mono font-bold text-cyan-500">{shocks.interestRate > 0 ? '+' : ''}{shocks.interestRate} bps</span>
                            </div>
                            <input
                                type="range"
                                min="-200"
                                max="500"
                                step="10"
                                value={shocks.interestRate}
                                onChange={(e) => setShocks({ ...shocks, interestRate: Number(e.target.value) })}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-cyan-500"
                            />
                            <div className="flex justify-between text-xs text-slate-400 font-mono">
                                <span>-200 bps</span>
                                <span>0</span>
                                <span>+500 bps</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-500" />
                                    {t.liquidityRateShock || 'Liquidity Spread Shock'}
                                </label>
                                <span className="text-sm font-mono font-bold text-amber-500">{shocks.liquiditySpread > 0 ? '+' : ''}{shocks.liquiditySpread} bps</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="500"
                                step="10"
                                value={shocks.liquiditySpread}
                                onChange={(e) => setShocks({ ...shocks, liquiditySpread: Number(e.target.value) })}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-amber-500"
                            />
                            <div className="flex justify-between text-xs text-slate-400 font-mono">
                                <span>0 bps</span>
                                <span>+250 bps</span>
                                <span>+500 bps</span>
                            </div>
                        </div>

                        <button
                            onClick={handleReset}
                            className="w-full py-2 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-200 dark:border-slate-800 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            <RefreshCcw size={14} />
                            Reset Shocks
                        </button>

                    </div>
                </Panel>
            </div>

            {/* Comparison View */}
            <div className="lg:col-span-8 h-full">
                <Panel title={t.impactAnalysis || 'Impact Analysis'} className="h-full bg-white dark:bg-[#0a0a0a]">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-slate-200 dark:border-slate-800">
                        <KpiCard
                            label="Total FTP"
                            base={baseResult.totalFTP}
                            shocked={shockedResult.totalFTP}
                            delta={deltaFTP}
                            inverse // Higher FTP is bad (cost)
                        />
                        <KpiCard
                            label="Client Rate"
                            base={baseResult.finalClientRate}
                            shocked={shockedResult.finalClientRate}
                            delta={deltaClientRate}
                            inverse // Higher Client Rate might be good for income, but here we track cost pass-through
                        />
                        <KpiCard
                            label="RAROC"
                            base={baseResult.raroc}
                            shocked={shockedResult.raroc}
                            delta={deltaRAROC}
                        />
                    </div>

                    {/* Waterfall Comparison Table */}
                    <div className="p-4 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                                    <th className="py-2 pl-2">Component</th>
                                    <th className="py-2 text-right">Base</th>
                                    <th className="py-2 text-right">Shocked</th>
                                    <th className="py-2 text-right pr-2">Impact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                <Row label="Base Interest Rate" base={baseResult.baseRate} shocked={shockedResult.baseRate} />
                                <Row label="Liquidity Spread" base={baseResult.liquiditySpread} shocked={shockedResult.liquiditySpread} />
                                <Row label="Strategic Spread" base={baseResult.strategicSpread} shocked={shockedResult.strategicSpread} />
                                <Row label="Regulatory Cost (EL)" base={baseResult.regulatoryCost} shocked={shockedResult.regulatoryCost} />
                                <Row label="Capital Charge" base={baseResult.capitalCharge} shocked={shockedResult.capitalCharge} />

                                <tr className="bg-slate-50 dark:bg-slate-900/50 font-bold">
                                    <td className="py-3 pl-2 text-slate-700 dark:text-slate-200">Total FTP</td>
                                    <td className="py-3 text-right font-mono">{baseResult.totalFTP.toFixed(2)}%</td>
                                    <td className={`py-3 text-right font-mono ${deltaFTP > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{shockedResult.totalFTP.toFixed(2)}%</td>
                                    <td className="py-3 text-right pr-2 font-mono text-xs text-slate-500">
                                        {deltaFTP !== 0 && (
                                            <span className={deltaFTP > 0 ? 'text-red-500' : 'text-emerald-500'}>
                                                {deltaFTP > 0 ? '+' : ''}{deltaFTP.toFixed(2)}%
                                            </span>
                                        )}
                                    </td>
                                </tr>

                                <tr className="bg-slate-100 dark:bg-slate-900 font-bold">
                                    <td className="py-3 pl-2 text-slate-900 dark:text-white">RAROC</td>
                                    <td className="py-3 text-right font-mono">{baseResult.raroc.toFixed(2)}%</td>
                                    <td className={`py-3 text-right font-mono ${deltaRAROC < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{shockedResult.raroc.toFixed(2)}%</td>
                                    <td className="py-3 text-right pr-2 font-mono text-xs text-slate-500">
                                        {deltaRAROC !== 0 && (
                                            <span className={deltaRAROC < 0 ? 'text-red-500' : 'text-emerald-500'}>
                                                {deltaRAROC > 0 ? '+' : ''}{deltaRAROC.toFixed(2)}%
                                            </span>
                                        )}
                                    </td>
                                </tr>

                            </tbody>
                        </table>
                    </div>

                </Panel>
            </div>
        </div>
    );
};

const KpiCard: React.FC<{ label: string, base: number, shocked: number, delta: number, inverse?: boolean }> = ({ label, base, shocked, delta, inverse }) => {
    const isNegative = inverse ? delta > 0.001 : delta < -0.001;
    const isPositive = inverse ? delta < -0.001 : delta > 0.001;

    return (
        <div className="bg-slate-50 dark:bg-black rounded-lg p-3 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 uppercase font-bold mb-1">{label}</div>
            <div className="flex items-end justify-between">
                <div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{shocked.toFixed(2)}%</div>
                    <div className="text-xs text-slate-400">Base: {base.toFixed(2)}%</div>
                </div>
                <div className={`flex items-center text-sm font-bold ${isNegative ? 'text-red-500' : isPositive ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {delta > 0 ? '+' : ''}{delta.toFixed(2)}%
                </div>
            </div>
        </div>
    )
}

const Row: React.FC<{ label: string, base: number, shocked: number }> = ({ label, base, shocked }) => {
    const delta = shocked - base;
    return (
        <tr className="text-slate-600 dark:text-slate-400 group hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
            <td className="py-2 pl-2">{label}</td>
            <td className="py-2 text-right font-mono">{base.toFixed(3)}%</td>
            <td className="py-2 text-right font-mono text-slate-900 dark:text-slate-200">{shocked.toFixed(3)}%</td>
            <td className="py-2 text-right pr-2 font-mono text-xs">
                {Math.abs(delta) > 0.001 && (
                    <span className={delta > 0 ? 'text-amber-500' : 'text-blue-500'}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(3)}%
                    </span>
                )}
            </td>
        </tr>
    )
}

export default ShocksDashboard;
