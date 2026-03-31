import React, { useState, useMemo, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, ComposedChart
} from 'recharts';
import {
    INITIAL_DEAL
} from '../../constants';
import { Panel, Badge } from '../ui/LayoutComponents';
import { useData } from '../../contexts/DataContext';
import {
    Activity, ShieldCheck, TrendingUp, BarChart4, Droplets,
    Target, Shield, Search, RefreshCw, AlertCircle, Info, ChevronRight, Calculator,
    Globe, Lock, Unlock, Database, Layers, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Transaction, ProductDefinition, BusinessUnit, ClientEntity } from '../../types';

interface ReportingDashboardProps {
    deals: Transaction[];
    products: ProductDefinition[];
    businessUnits: BusinessUnit[];
    clients: ClientEntity[];
    shocks: { interestRate: number; liquiditySpread: number };
}

import MaturityLadder from './MaturityLadder';
import CurrencyGap from './CurrencyGap';
import NIISensitivity from './NIISensitivity';
import { calculatePricing } from '../../utils/pricingEngine';
import { MOCK_LIQUIDITY_CURVES } from '../../constants';

/** P&L Attribution: decompose margin into rate / spread / volume components */
const PnlAttribution: React.FC<{
    deals: Transaction[];
    products: any[];
    businessUnits: any[];
    clients: any[];
    contextData: any;
}> = ({ deals, products, businessUnits, clients, contextData }) => {
    const bookedDeals = deals.filter(d => d.status === 'Booked' || d.status === 'Approved');
    const attribution = useMemo(() => {
        const ctx = {
            yieldCurve: contextData.yieldCurves,
            liquidityCurves: contextData.liquidityCurves?.length ? contextData.liquidityCurves : MOCK_LIQUIDITY_CURVES,
            rules: contextData.rules,
            rateCards: contextData.ftpRateCards,
            transitionGrid: contextData.transitionGrid,
            physicalGrid: contextData.physicalGrid,
            behaviouralModels: contextData.behaviouralModels,
            clients, products, businessUnits,
        };
        return bookedDeals.map(deal => {
            const r = calculatePricing(deal, contextData.approvalMatrix, ctx);
            const nii = deal.amount * (r.finalClientRate / 100);
            const ftpCost = deal.amount * (r.totalFTP / 100);
            const creditCost = deal.amount * (r.regulatoryCost / 100);
            const opCost = deal.amount * (r.operationalCost / 100);
            const capitalCost = deal.amount * (r.capitalCharge / 100);
            const netMargin = nii - ftpCost;
            const buName = businessUnits.find((b: any) => b.id === deal.businessUnit)?.name || deal.businessUnit;
            return {
                id: deal.id, buName, product: deal.productType, amount: deal.amount, currency: deal.currency,
                nii, ftpCost, creditCost, opCost, capitalCost, netMargin,
                raroc: r.raroc, approvalLevel: r.approvalLevel,
            };
        });
    }, [bookedDeals, contextData, clients, products, businessUnits]);

    const totals = useMemo(() => ({
        nii: attribution.reduce((s, a) => s + a.nii, 0),
        ftpCost: attribution.reduce((s, a) => s + a.ftpCost, 0),
        creditCost: attribution.reduce((s, a) => s + a.creditCost, 0),
        opCost: attribution.reduce((s, a) => s + a.opCost, 0),
        capitalCost: attribution.reduce((s, a) => s + a.capitalCost, 0),
        netMargin: attribution.reduce((s, a) => s + a.netMargin, 0),
    }), [attribution]);

    const fmtM = (v: number) => `$${(v / 1e6).toFixed(2)}M`;

    return (
        <div className="space-y-6">
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {[
                    { label: 'Gross NII', value: totals.nii, color: 'text-emerald-400' },
                    { label: 'FTP Cost', value: -totals.ftpCost, color: 'text-amber-400' },
                    { label: 'Credit Cost', value: -totals.creditCost, color: 'text-red-400' },
                    { label: 'Op. Cost', value: -totals.opCost, color: 'text-red-400' },
                    { label: 'Capital Cost', value: -totals.capitalCost, color: 'text-red-400' },
                    { label: 'Net Margin', value: totals.netMargin, color: totals.netMargin >= 0 ? 'text-cyan-400' : 'text-red-400' },
                ].map(kpi => (
                    <div key={kpi.label} className="bg-[#0f172a]/40 border border-white/10 p-4 rounded-xl">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{kpi.label}</div>
                        <div className={`text-lg font-mono font-bold ${kpi.color}`}>{fmtM(kpi.value)}</div>
                    </div>
                ))}
            </div>
            {/* Detail table */}
            <div className="overflow-auto">
                <table className="w-full text-xs">
                    <thead><tr className="text-[10px] text-slate-500 uppercase border-b border-slate-800">
                        <th className="py-2 text-left pl-2">Deal</th>
                        <th className="py-2 text-left">BU</th>
                        <th className="py-2 text-right">NII</th>
                        <th className="py-2 text-right">FTP Cost</th>
                        <th className="py-2 text-right">Net Margin</th>
                        <th className="py-2 text-right">RAROC</th>
                        <th className="py-2 text-right pr-2">Approval</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {attribution.map(a => (
                            <tr key={a.id} className="hover:bg-slate-900/30">
                                <td className="py-1.5 pl-2 font-mono text-cyan-400">{a.id}</td>
                                <td className="py-1.5 text-slate-400">{a.buName}</td>
                                <td className="py-1.5 text-right font-mono text-emerald-400">{fmtM(a.nii)}</td>
                                <td className="py-1.5 text-right font-mono text-amber-400">{fmtM(a.ftpCost)}</td>
                                <td className={`py-1.5 text-right font-mono font-bold ${a.netMargin >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{fmtM(a.netMargin)}</td>
                                <td className={`py-1.5 text-right font-mono ${a.raroc >= 15 ? 'text-emerald-400' : a.raroc > 0 ? 'text-amber-400' : 'text-red-400'}`}>{a.raroc.toFixed(1)}%</td>
                                <td className="py-1.5 text-right pr-2 text-[10px] font-bold">{a.approvalLevel}</td>
                            </tr>
                        ))}
                        {attribution.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-600">No booked deals</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/** Executive Dashboard: KPIs consolidados del portfolio */
const ExecutiveDashboard: React.FC<{
    deals: Transaction[];
    products: any[];
    businessUnits: any[];
    portfolioMetrics: any;
    portfolioByBU: any[];
}> = ({ deals, products, businessUnits, portfolioMetrics, portfolioByBU }) => {
    const bookedDeals = deals.filter(d => d.status === 'Booked' || d.status === 'Approved');
    const totalVolume = bookedDeals.reduce((s, d) => s + (d.amount || 0), 0);
    const avgMargin = bookedDeals.length > 0 ? bookedDeals.reduce((s, d) => s + (d.marginTarget || 0), 0) / bookedDeals.length : 0;

    const byProduct = useMemo(() => {
        const map: Record<string, { volume: number; count: number }> = {};
        bookedDeals.forEach(d => {
            const p = d.productType || 'Unknown';
            if (!map[p]) map[p] = { volume: 0, count: 0 };
            map[p].volume += d.amount || 0;
            map[p].count++;
        });
        return Object.entries(map).map(([p, v]) => ({
            product: products.find((pr: any) => pr.id === p)?.name || p,
            ...v,
        })).sort((a, b) => b.volume - a.volume);
    }, [bookedDeals, products]);

    const byCurrency = useMemo(() => {
        const map: Record<string, number> = {};
        bookedDeals.forEach(d => { map[d.currency] = (map[d.currency] || 0) + (d.amount || 0); });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [bookedDeals]);

    const fmtM = (v: number) => {
        if (Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
        if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
        return `$${(v / 1e3).toFixed(0)}K`;
    };

    return (
        <div className="space-y-8">
            {/* Top KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { label: 'Total Portfolio', value: fmtM(totalVolume), sub: `${bookedDeals.length} deals`, color: 'text-white' },
                    { label: 'Avg Margin', value: `${avgMargin.toFixed(2)}%`, sub: 'target spread', color: 'text-emerald-400' },
                    { label: 'LCR Ratio', value: `${portfolioMetrics.lcr.toFixed(1)}%`, sub: portfolioMetrics.lcr > 100 ? 'COMPLIANT' : 'AT RISK', color: portfolioMetrics.lcr > 100 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'NSFR Ratio', value: `${portfolioMetrics.nsfr.toFixed(1)}%`, sub: portfolioMetrics.nsfr > 100 ? 'COMPLIANT' : 'AT RISK', color: portfolioMetrics.nsfr > 100 ? 'text-emerald-400' : 'text-red-400' },
                    { label: 'Currencies', value: `${byCurrency.length}`, sub: byCurrency.map(c => c[0]).join(', '), color: 'text-cyan-400' },
                ].map(kpi => (
                    <div key={kpi.label} className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">{kpi.label}</div>
                        <div className={`text-2xl font-mono font-bold ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-[10px] text-slate-600 mt-1">{kpi.sub}</div>
                    </div>
                ))}
            </div>
            {/* Portfolio by BU and Product */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0f172a]/30 border border-white/5 p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-white mb-4 uppercase">Volume by Business Unit</h4>
                    <div className="space-y-3">
                        {portfolioByBU.map((bu: any) => {
                            const pct = totalVolume > 0 ? (bu.volume / totalVolume) * 100 : 0;
                            return (
                                <div key={bu.bu} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-300 font-bold">{bu.buName}</span>
                                        <span className="text-slate-400 font-mono">{fmtM(bu.volume)} ({pct.toFixed(0)}%)</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        {portfolioByBU.length === 0 && <div className="text-center py-4 text-slate-600 text-xs">No booked deals</div>}
                    </div>
                </div>
                <div className="bg-[#0f172a]/30 border border-white/5 p-6 rounded-2xl">
                    <h4 className="text-sm font-bold text-white mb-4 uppercase">Volume by Product</h4>
                    <div className="space-y-3">
                        {byProduct.map(p => {
                            const pct = totalVolume > 0 ? (p.volume / totalVolume) * 100 : 0;
                            return (
                                <div key={p.product} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-300 font-bold">{p.product}</span>
                                        <span className="text-slate-400 font-mono">{fmtM(p.volume)} ({p.count} deals)</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                        {byProduct.length === 0 && <div className="text-center py-4 text-slate-600 text-xs">No booked deals</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

type SubTab = 'OVERVIEW' | 'FUNDING_CURVES' | 'BEHAVIOUR_FOCUS' | 'MATURITY_LADDER' | 'CURRENCY_GAP' | 'NII_SENSITIVITY' | 'PNL_ATTRIBUTION' | 'EXECUTIVE';

const ReportingDashboard: React.FC<ReportingDashboardProps> = ({
    deals,
    products,
    businessUnits,
    clients,
    shocks
}) => {
    const contextData = useData();
    const behaviouralModels = contextData.behaviouralModels;

    // Tab state
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('OVERVIEW');

    // Selection state
    const [selectedDealId, setSelectedDealId] = useState<string>('');
    const [scenarioDeal, setScenarioDeal] = useState<Transaction>(INITIAL_DEAL);
    const [isModified, setIsModified] = useState(false);

    // Funding Curve Filters & What-if
    const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
    const [collateralType, setCollateralType] = useState<'Secured' | 'Unsecured'>('Secured');
    const [curveShift, setCurveShift] = useState<number>(0);

    // Sync scenarioDeal when selection changes
    useEffect(() => {
        if (selectedDealId) {
            const deal = deals.find(d => d.id === selectedDealId);
            if (deal) {
                setScenarioDeal({ ...deal });
                setIsModified(false);
            }
        }
    }, [selectedDealId, deals]);

    const handleScenarioChange = (key: keyof Transaction, value: any) => {
        setScenarioDeal(prev => ({ ...prev, [key]: value }));
        setIsModified(true);
    };

    // --- CALCULATIONS & MODELS ---

    // Portfolio-based LCR/NSFR from actual booked deals
    const portfolioMetrics = useMemo(() => {
        const bookedDeals = deals.filter(d => d.status === 'Booked' || d.status === 'Approved');
        let totalHQLA = 0;
        let totalOutflows = 0;
        let totalASF = 0;
        let totalRSF = 0;
        let totalAssetVolume = 0;
        let totalLiabilityVolume = 0;

        bookedDeals.forEach(deal => {
            const amt = deal.amount || 0;
            const isAsset = deal.category === 'Asset';
            const isLiability = deal.category === 'Liability';
            const isOffBalance = deal.category === 'Off-Balance';

            if (isAsset) totalAssetVolume += amt;
            if (isLiability) totalLiabilityVolume += amt;

            // LCR: outflows from liabilities and committed facilities
            if (isLiability) {
                totalOutflows += amt * ((deal.lcrOutflowPct || 25) / 100);
                // ASF contribution
                if (deal.durationMonths >= 12) totalASF += amt * 0.95;
                else if (deal.depositStability === 'Stable') totalASF += amt * 0.95;
                else if (deal.depositStability === 'Semi_Stable') totalASF += amt * 0.90;
                else totalASF += amt * 0.50;
            } else if (isOffBalance && deal.isCommitted) {
                totalOutflows += amt * ((deal.lcrOutflowPct || 10) / 100);
            }

            // HQLA: high quality assets contribute to buffer
            if (isAsset && deal.riskWeight <= 20) {
                totalHQLA += amt * (1 - (deal.riskWeight / 100) * 0.15); // L1/L2 HQLA haircut
            }

            // RSF for assets
            if (isAsset) {
                if (deal.durationMonths >= 12) totalRSF += amt * (deal.riskWeight >= 50 ? 0.85 : 0.65);
                else totalRSF += amt * 0.50;
            }
        });

        // Ensure non-zero denominators
        const safeOutflows = totalOutflows || 1;
        const safeRSF = totalRSF || 1;

        return {
            hqla: totalHQLA,
            netOutflows: totalOutflows,
            asf: totalASF,
            rsf: totalRSF,
            lcr: (totalHQLA / safeOutflows) * 100,
            nsfr: (totalASF / safeRSF) * 100,
            totalAssetVolume,
            totalLiabilityVolume,
            dealCount: bookedDeals.length,
        };
    }, [deals]);

    const metrics = useMemo(() => {
        const amount = Number(scenarioDeal.amount) || 0;
        const isAsset = scenarioDeal.category === 'Asset';
        const isLiability = scenarioDeal.category === 'Liability';
        const isOffBalance = scenarioDeal.category === 'Off-Balance';

        let dealOutflow = 0;
        if (isLiability) {
            dealOutflow = amount * ((scenarioDeal.lcrOutflowPct || 25) / 100);
        } else if (isOffBalance && scenarioDeal.isCommitted) {
            dealOutflow = amount * ((scenarioDeal.lcrOutflowPct || 10) / 100);
        }

        const finalHQLA = isAsset && scenarioDeal.riskWeight <= 20 ? portfolioMetrics.hqla + amount : portfolioMetrics.hqla;
        const finalOutflows = (portfolioMetrics.netOutflows || 1) + dealOutflow;
        const lcr = (finalHQLA / finalOutflows) * 100;

        let dealASF = 0;
        let dealRSF = 0;
        if (isLiability) dealASF = amount * (scenarioDeal.durationMonths >= 12 ? 0.95 : 0.50);
        else if (isAsset) dealRSF = amount * (scenarioDeal.durationMonths >= 12 ? 0.85 : 0.50);

        const nsfr = ((portfolioMetrics.asf + dealASF) / ((portfolioMetrics.rsf || 1) + dealRSF)) * 100;

        const liqCurves = contextData.liquidityCurves;
        const lpPoints = liqCurves?.[0]?.points || [];
        const duration = scenarioDeal.durationMonths || 1;
        const lpValue = duration <= 1 ? lpPoints[0].termLP :
            duration >= 60 ? lpPoints[lpPoints.length - 1].termLP :
                lpPoints[Math.min(Math.floor(duration / 12), lpPoints.length - 1)].termLP;

        return {
            lcr, nsfr, lpValue,
            clc: (scenarioDeal.lcrOutflowPct || 0) * 0.35,
            wlp: (amount / 1000000) * 1.2,
            impactHQLA: finalHQLA - portfolioMetrics.hqla,
            impactOutflows: dealOutflow
        };
    }, [scenarioDeal, portfolioMetrics]);

    // Portfolio summary by BU
    const portfolioByBU = useMemo(() => {
        const byBU: Record<string, { volume: number; count: number; avgMargin: number }> = {};
        const bookedDeals = deals.filter(d => d.status === 'Booked' || d.status === 'Approved');
        bookedDeals.forEach(deal => {
            const bu = deal.businessUnit || 'Unknown';
            if (!byBU[bu]) byBU[bu] = { volume: 0, count: 0, avgMargin: 0 };
            byBU[bu].volume += deal.amount || 0;
            byBU[bu].count++;
            byBU[bu].avgMargin += deal.marginTarget || 0;
        });
        return Object.entries(byBU).map(([bu, v]) => ({
            bu,
            buName: businessUnits.find(b => b.id === bu)?.name || bu,
            volume: v.volume,
            count: v.count,
            avgMargin: v.count > 0 ? v.avgMargin / v.count : 0,
        })).sort((a, b) => b.volume - a.volume);
    }, [deals, businessUnits]);

    // LCR simulation data — shows base vs scenario impact
    const lcrHistory = useMemo(() => {
        const baseLcr = portfolioMetrics.lcr || 100;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((month, i) => {
            const seasonalAdj = Math.sin(i * 0.5) * 3; // seasonal variation
            return {
                date: month,
                lcr: baseLcr + seasonalAdj,
                simulated: metrics.lcr + seasonalAdj,
            };
        });
    }, [portfolioMetrics.lcr, metrics.lcr]);

    // Graph Data - Funding Curves
    const fundingCurveData = useMemo(() => {
        const liqCurves = contextData.liquidityCurves;
        if (!liqCurves?.length || !liqCurves[0]?.points?.length) return [];
        const basePoints = liqCurves[0].points;
        const currencyFactor = selectedCurrency === 'EUR' ? 0.8 : 1.0;
        const collateralSpread = collateralType === 'Unsecured' ? 15 : 0;

        return basePoints.map((p: any) => {
            const wholesaleShifted = (p.wholesaleSpread + collateralSpread + curveShift) * currencyFactor;
            const lpShifted = (p.termLP + collateralSpread + curveShift) * currencyFactor;

            return {
                tenor: p.tenor,
                wholesale: p.wholesaleSpread * currencyFactor,
                lp: p.termLP * currencyFactor,
                simWholesale: wholesaleShifted,
                simLP: lpShifted,
                basis: lpShifted - wholesaleShifted
            };
        });
    }, [selectedCurrency, collateralType, curveShift]);

    const findClientName = (id: string) => clients.find(c => c.id === id)?.name || id;

    return (
        <div className="flex flex-col h-full bg-[#020617] text-slate-200 overflow-hidden font-sans">
            {/* Bloomberg Style Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 bg-[#0f172a]/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <BarChart4 className="text-cyan-400 w-5 h-5" />
                        <h2 className="text-sm font-bold tracking-tight text-white uppercase font-mono">
                            Liquidity Risk Terminal <span className="text-slate-500 font-normal">v4.6</span>
                        </h2>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10 mx-2" />
                    <nav className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setActiveSubTab('OVERVIEW')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'OVERVIEW' ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveSubTab('FUNDING_CURVES')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'FUNDING_CURVES' ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Funding Curves
                        </button>
                        <button
                            onClick={() => setActiveSubTab('BEHAVIOUR_FOCUS')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'BEHAVIOUR_FOCUS' ? 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Behaviour Focus
                        </button>
                        <div className="h-4 w-[1px] bg-white/10 mx-1" />
                        <button
                            onClick={() => setActiveSubTab('MATURITY_LADDER')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'MATURITY_LADDER' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Maturity Ladder
                        </button>
                        <button
                            onClick={() => setActiveSubTab('CURRENCY_GAP')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'CURRENCY_GAP' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Currency Gap
                        </button>
                        <button
                            onClick={() => setActiveSubTab('NII_SENSITIVITY')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'NII_SENSITIVITY' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            NII / IRRBB
                        </button>
                        <div className="h-4 w-[1px] bg-white/10 mx-1" />
                        <button
                            onClick={() => setActiveSubTab('PNL_ATTRIBUTION')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'PNL_ATTRIBUTION' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            P&L Attribution
                        </button>
                        <button
                            onClick={() => setActiveSubTab('EXECUTIVE')}
                            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeSubTab === 'EXECUTIVE' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Executive
                        </button>
                    </nav>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Focus:</label>
                        <select
                            value={selectedDealId}
                            onChange={(e) => setSelectedDealId(e.target.value)}
                            className="bg-black/60 border border-white/10 text-xs text-cyan-400 px-3 py-1 rounded outline-none focus:border-cyan-500/50 min-w-[200px] font-mono"
                        >
                            <option value="">-- Global Portfolio --</option>
                            {deals.map(d => (
                                <option key={d.id} value={d.id}>{d.id} | {findClientName(d.clientId)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Market State</span>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">SOFR: 5.32</Badge>
                            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">BI-3: OK</Badge>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Contextual What-if Panel */}
                <div className="w-80 border-r border-white/10 bg-[#020617] overflow-y-auto custom-scrollbar p-6 space-y-8">
                    {activeSubTab === 'OVERVIEW' ? (
                        <>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                        <Calculator className="w-4 h-4 text-cyan-500" /> Contract Simulation
                                    </h3>
                                    {isModified && (
                                        <button onClick={() => { if (selectedDealId) { const id = selectedDealId; setSelectedDealId(''); setTimeout(() => setSelectedDealId(id), 0); } else { setScenarioDeal(INITIAL_DEAL); } }} className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold">
                                            <RefreshCw className="w-3 h-3" /> RESET
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Notional Amount</label>
                                        <input type="number" value={scenarioDeal.amount} onChange={(e) => handleScenarioChange('amount', Number(e.target.value))} className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-cyan-500/50 outline-none font-mono" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Term (Months): {scenarioDeal.durationMonths}</label>
                                        <input type="range" min="1" max="120" value={scenarioDeal.durationMonths} onChange={(e) => handleScenarioChange('durationMonths', Number(e.target.value))} className="w-full accent-cyan-500" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">LCR Outflow %</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[5, 25, 40, 100].map(val => (
                                                <button key={val} onClick={() => handleScenarioChange('lcrOutflowPct', val)} className={`text-[10px] py-1 rounded border ${scenarioDeal.lcrOutflowPct === val ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-black/40 border-white/10 text-slate-500'}`}>
                                                    {val}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded">
                                <h4 className="text-[10px] font-bold text-indigo-400 mb-2 uppercase flex items-center gap-2"><Info className="w-3 h-3" /> Selection Context</h4>
                                <div className="space-y-1 text-[10px]">
                                    <div className="flex justify-between"><span className="text-slate-500">Asset/Liab:</span> <span className="text-white">{scenarioDeal.category}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Effective LP:</span> <span className="text-white">{metrics.lpValue} bps</span></div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-6">
                                    <Globe className="w-4 h-4 text-cyan-500" /> Curve Controls
                                </h3>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Base Currency</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['USD', 'EUR', 'GBP'].map(ccy => (
                                                <button key={ccy} onClick={() => setSelectedCurrency(ccy)} className={`py-2 rounded text-[11px] font-mono border transition-all ${selectedCurrency === ccy ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-black/40 border-white/5 text-slate-500'}`}>
                                                    {ccy}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Collateralization</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setCollateralType('Secured')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold border ${collateralType === 'Secured' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-black/40 border-white/5 text-slate-500'}`}>
                                                <Lock size={12} /> SECURED
                                            </button>
                                            <button onClick={() => setCollateralType('Unsecured')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-[10px] font-bold border ${collateralType === 'Unsecured' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-black/40 border-white/5 text-slate-500'}`}>
                                                <Unlock size={12} /> UNSEC
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-white/5">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Curve Shock (bps)</label>
                                            <span className={`text-[11px] font-mono ${curveShift >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{curveShift > 0 && '+'}{curveShift} bps</span>
                                        </div>
                                        <input type="range" min="-100" max="100" value={curveShift} onChange={(e) => setCurveShift(Number(e.target.value))} className="w-full accent-cyan-500" />
                                        <div className="flex justify-between text-[8px] text-slate-600 font-mono"><span>-100BP</span> <span>PARALLEL</span> <span>+100BP</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded">
                                <h4 className="text-[10px] font-bold text-emerald-400 mb-2 uppercase flex items-center gap-2"><Layers className="w-3 h-3" /> Model Insights</h4>
                                <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
                                    Simulating {collateralType} {selectedCurrency} liquidity curves using a spline interpolation based on Market {collateralType === 'Secured' ? 'Repo' : 'Wholesale'} reference rates.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 p-8 space-y-8">
                    {activeSubTab === 'OVERVIEW' ? (
                        <>
                            {/* Top KPI Row */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldCheck size={48} className="text-cyan-400" /></div>
                                    <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">LCR Ratio</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-mono font-bold text-white">{metrics.lcr.toFixed(1)}%</div>
                                        <div className={`text-[10px] font-bold ${metrics.lcr > 100 ? 'text-emerald-500' : 'text-rose-500'}`}>{metrics.lcr > 100 ? '+SAFE' : '-RISK'}</div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500">Target: {'>'}100%</div>
                                </div>
                                <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={48} className="text-amber-400" /></div>
                                    <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">NSFR Ratio</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-mono font-bold text-white">{metrics.nsfr.toFixed(1)}%</div>
                                        <div className="text-[10px] font-bold text-emerald-500">OK</div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500">Target: {'>'}100%</div>
                                </div>
                                <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Droplets size={48} className="text-indigo-400" /></div>
                                    <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">Liquidity Premium</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-mono font-bold text-white">{metrics.lpValue.toFixed(1)}</div>
                                        <span className="text-xs text-indigo-400 font-bold">bps</span>
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500">Curve-Derived</div>
                                </div>
                                <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Shield size={48} className="text-emerald-400" /></div>
                                    <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">CLC Index</div>
                                    <div className="flex items-baseline gap-2">
                                        <div className="text-3xl font-mono font-bold text-white">{metrics.clc.toFixed(1)}%</div>
                                        <div className="text-[10px] font-bold text-slate-500">WLP: {metrics.wlp.toFixed(0)}</div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-500">Cash Coverage</div>
                                </div>
                            </div>
                            {/* Charts Overview */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-[#0f172a]/30 border border-white/5 p-6 rounded-2xl">
                                    <h4 className="text-sm font-bold text-white mb-6 uppercase">LCR Stress Simulation</h4>
                                    <div className="h-[280px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={lcrHistory}>
                                                <defs>
                                                    <linearGradient id="colorLcr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} domain={['dataMin - 5', 'dataMax + 5']} />
                                                <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }} />
                                                <Area type="monotone" dataKey="lcr" stroke="#06b6d4" strokeWidth={2} fill="url(#colorLcr)" />
                                                <Area type="monotone" dataKey="simulated" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-[#0f172a]/30 border border-white/5 p-6 rounded-2xl">
                                    <h4 className="text-sm font-bold text-white mb-4 uppercase">Portfolio by Business Unit</h4>
                                    <div className="space-y-3">
                                        {portfolioByBU.length > 0 ? portfolioByBU.map(bu => {
                                            const maxVol = Math.max(...portfolioByBU.map(b => b.volume));
                                            const pct = maxVol > 0 ? (bu.volume / maxVol) * 100 : 0;
                                            return (
                                                <div key={bu.bu} className="space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-300 font-bold">{bu.buName}</span>
                                                        <span className="text-slate-400 font-mono">${(bu.volume / 1e6).toFixed(1)}M ({bu.count} deals)</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <div className="text-[10px] text-slate-600 font-mono">Avg margin: {bu.avgMargin.toFixed(2)}%</div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="text-center py-8 text-slate-600 text-xs">No booked deals in portfolio</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeSubTab === 'FUNDING_CURVES' ? (
                        <>
                            {/* Funding Curves Main View */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-8 bg-[#0f172a]/30 border border-white/5 p-6 rounded-2xl relative">
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h4 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-3">
                                                <TrendingUp className="text-cyan-400" /> {selectedCurrency} Term Liquidity Structure
                                            </h4>
                                            <p className="text-xs text-slate-500 font-mono">Reference Structure: {collateralType} Collateralization</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase">
                                            <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-cyan-500" /> LP (Base)</div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-0.5 border-t-2 border-dashed border-cyan-400" /> LP (Sim)</div>
                                            <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-slate-600" /> Whl. (Base)</div>
                                        </div>
                                    </div>

                                    <div className="h-[400px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={fundingCurveData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                <XAxis dataKey="tenor" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} orientation="right" />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                    itemStyle={{ fontSize: '11px', textTransform: 'uppercase' }}
                                                />
                                                <Line type="monotone" dataKey="wholesale" stroke="#475569" strokeWidth={1.5} dot={false} />
                                                <Line type="monotone" dataKey="lp" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4, fill: '#06b6d4' }} />
                                                <Line type="monotone" dataKey="simLP" stroke="#22d3ee" strokeWidth={2} strokeDasharray="6 6" dot={false} />
                                                <Area type="monotone" dataKey="basis" fill="#06b6d4" fillOpacity={0.05} stroke="none" />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-[#0f172a]/40 border border-white/10 p-6 rounded-2xl">
                                        <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Summary Yield/Spread</h5>
                                        <div className="space-y-4">
                                            {(fundingCurveData.length > 4 ? [
                                                { label: 'Spread at 1Y', base: fundingCurveData[4]?.lp || 0, sim: fundingCurveData[4]?.simLP || 0 },
                                                { label: 'Spread at 5Y', base: fundingCurveData.find((d: any) => d.tenor === '5Y')?.lp || 0, sim: fundingCurveData.find((d: any) => d.tenor === '5Y')?.simLP || 0 },
                                                { label: 'Current Slope (ON-5Y)', base: (fundingCurveData.find((d: any) => d.tenor === '5Y')?.lp || 0) - (fundingCurveData[0]?.lp || 0), sim: (fundingCurveData.find((d: any) => d.tenor === '5Y')?.simLP || 0) - (fundingCurveData[0]?.simLP || 0) }
                                            ] : [{ label: 'No curve data', base: 0, sim: 0 }]).map((item, i) => (
                                                <div key={i} className="flex flex-col gap-1">
                                                    <div className="text-[10px] text-slate-500 font-bold">{item.label}</div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-lg font-mono font-bold text-white">{item.base.toFixed(1)} <span className="text-[10px] text-slate-600">bps</span></span>
                                                        <div className="flex items-center gap-1">
                                                            <span className={`text-xs font-mono font-bold ${item.sim >= item.base ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                {item.sim.toFixed(1)}
                                                            </span>
                                                            {item.sim > item.base ? <ArrowUpRight size={14} className="text-emerald-400" /> : <ArrowDownRight size={14} className="text-rose-400" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-cyan-900/10 border border-cyan-500/20 p-5 rounded-2xl">
                                        <h5 className="text-[10px] font-bold text-cyan-500 uppercase mb-3">Portfolio Alignment</h5>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-slate-400 uppercase">Wtd. LP Gap</span>
                                                <span className="text-[11px] font-mono font-bold">+4.2 bps</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-cyan-500 w-[72%] shadow-[0_0_10px_#06b6d4]" />
                                            </div>
                                            <p className="text-[9px] text-slate-500 italic mt-2">* Analysis relative to 100% of the active portfolio notional.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : activeSubTab === 'MATURITY_LADDER' ? (
                        <MaturityLadder deals={deals} />
                    ) : activeSubTab === 'CURRENCY_GAP' ? (
                        <CurrencyGap deals={deals} />
                    ) : activeSubTab === 'NII_SENSITIVITY' ? (
                        <NIISensitivity deals={deals} />
                    ) : activeSubTab === 'PNL_ATTRIBUTION' ? (
                        <PnlAttribution deals={deals} products={products} businessUnits={businessUnits} clients={clients} contextData={contextData} />
                    ) : activeSubTab === 'EXECUTIVE' ? (
                        <ExecutiveDashboard deals={deals} products={products} businessUnits={businessUnits} portfolioMetrics={portfolioMetrics} portfolioByBU={portfolioByBU} />
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {behaviouralModels.map((model) => {
                                const buckets = ['ON', '1M', '3M', '6M', '12M', '2Y', '4Y', '6Y', '10Y', '>10Y'];
                                const data = buckets.map(bucket => {
                                    let ftp = 0;
                                    const tenorToMonths: Record<string, number> = {
                                        'ON': 0, '1M': 1, '3M': 3, '6M': 6, '12M': 12, '2Y': 24, '4Y': 48, '6Y': 72, '10Y': 120, '>10Y': 240
                                    };

                                    if (model.type === 'NMD_Replication') {
                                        const profile = model.replicationProfile || [];
                                        const coreRatio = (model.coreRatio || 50) / 100;
                                        const beta = model.betaFactor || 0.5;

                                        const baseFTP = 25 + (tenorToMonths[bucket] * 0.5);
                                        const spread = profile.find(p => p.term === bucket)?.spread || 0;
                                        const weight = profile.find(p => p.term === bucket)?.weight || 0;

                                        ftp = (baseFTP + spread) * (weight / 100) * coreRatio * (1 - beta);
                                        if (weight === 0) ftp = baseFTP * 0.8 * coreRatio;
                                    } else {
                                        const baseFTP = 35 + (tenorToMonths[bucket] * 0.8);
                                        const cprImpact = (model.cpr || 5) * 2;
                                        ftp = baseFTP + cprImpact;
                                    }

                                    return { bucket, ftp: parseFloat(ftp.toFixed(2)) };
                                });

                                return (
                                    <div key={model.id} className="bg-[#0f172a]/40 border border-white/10 p-6 rounded-2xl flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-sm font-bold text-white uppercase">{model.name}</h4>
                                                <Badge variant="outline" className={`text-[8px] mt-1 ${model.type === 'NMD_Replication' ? 'border-purple-500 text-purple-400' : 'border-amber-500 text-amber-400'}`}>
                                                    {model.type === 'NMD_Replication' ? 'NMD REPLICATION' : 'PREPAYMENT CPR'}
                                                </Badge>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[9px] text-slate-500 font-mono italic">ID: {model.id}</div>
                                            </div>
                                        </div>

                                        <div className="h-[220px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={data}>
                                                    <defs>
                                                        <linearGradient id={`colorFtp-${model.id}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor={model.type === 'NMD_Replication' ? "#a855f7" : "#f59e0b"} stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor={model.type === 'NMD_Replication' ? "#a855f7" : "#f59e0b"} stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                    <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }} />
                                                    <Area type="monotone" dataKey="ftp" stroke={model.type === 'NMD_Replication' ? "#a855f7" : "#f59e0b"} strokeWidth={2} fill={`url(#colorFtp-${model.id})`} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                                            {model.type === 'NMD_Replication' ? (
                                                <>
                                                    <div className="text-center"><div className="text-[8px] text-slate-500 uppercase">Core</div><div className="text-xs font-mono font-bold text-white">{model.coreRatio}%</div></div>
                                                    <div className="text-center"><div className="text-[8px] text-slate-500 uppercase">Beta</div><div className="text-xs font-mono font-bold text-white">{model.betaFactor}</div></div>
                                                    <div className="text-center"><div className="text-[8px] text-slate-500 uppercase">Tranches</div><div className="text-xs font-mono font-bold text-white">{model.replicationProfile?.length || 0}</div></div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="text-center"><div className="text-[8px] text-slate-500 uppercase">CPR</div><div className="text-xs font-mono font-bold text-white">{model.cpr}%</div></div>
                                                    <div className="text-center"><div className="text-[8px] text-slate-500 uppercase">Exempt</div><div className="text-xs font-mono font-bold text-white">{model.penaltyExempt}%</div></div>
                                                    <div className="text-center"><div className="text-[8px] text-slate-500 uppercase">Method</div><div className="text-xs font-mono font-bold text-white uppercase italic">Standard</div></div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Terminal Status Bar */}
            <div className="h-8 border-t border-white/10 bg-[#020617] px-6 flex items-center justify-between font-mono text-[10px]">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-emerald-500 font-bold">SYSTEMS: ACTIVE</span></div>
                    <span className="text-slate-600">CURRENCY_MODE: {selectedCurrency}_REF</span>
                </div>
                <div className="flex items-center gap-4 text-slate-500">
                    <span className="flex items-center gap-1"><AlertCircle size={10} /> BASEL_III_STABLE</span>
                    <span className="text-cyan-900 font-bold uppercase">N-Pricing Terminal Node</span>
                </div>
            </div>
        </div>
    );
};

export default ReportingDashboard;
