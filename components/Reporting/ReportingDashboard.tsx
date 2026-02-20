import React, { useState, useMemo, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, ComposedChart
} from 'recharts';
import {
    MOCK_LIQUIDITY_DASHBOARD_DATA,
    MOCK_LIQUIDITY_CURVES,
    INITIAL_DEAL
} from '../../constants';
import { Panel, Badge } from '../ui/LayoutComponents';
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

type SubTab = 'OVERVIEW' | 'FUNDING_CURVES';

const ReportingDashboard: React.FC<ReportingDashboardProps> = ({
    deals,
    products,
    businessUnits,
    clients,
    shocks
}) => {
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

    // Base Portfolio Values
    const basePortfolio = {
        hqla: 250000000,
        netOutflows: 180000000,
        asf: 850000000,
        rsf: 720000000
    };

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

        const finalHQLA = isAsset && scenarioDeal.productType === 'HQLA_BOND' ? basePortfolio.hqla + amount : basePortfolio.hqla;
        const finalOutflows = basePortfolio.netOutflows + dealOutflow;
        const lcr = (finalHQLA / finalOutflows) * 100;

        let dealASF = 0;
        let dealRSF = 0;
        if (isLiability) dealASF = amount * (scenarioDeal.durationMonths >= 12 ? 1.0 : 0.5);
        else if (isAsset) dealRSF = amount * (scenarioDeal.durationMonths >= 12 ? 1.0 : 0.5);

        const nsfr = ((basePortfolio.asf + dealASF) / (basePortfolio.rsf + dealRSF)) * 100;

        const lpPoints = MOCK_LIQUIDITY_CURVES[0].points;
        const duration = scenarioDeal.durationMonths || 1;
        const lpValue = duration <= 1 ? lpPoints[0].termLP :
            duration >= 60 ? lpPoints[lpPoints.length - 1].termLP :
                lpPoints[Math.min(Math.floor(duration / 12), lpPoints.length - 1)].termLP;

        return {
            lcr, nsfr, lpValue,
            clc: (scenarioDeal.lcrOutflowPct || 0) * 0.35,
            wlp: (amount / 1000000) * 1.2,
            impactHQLA: finalHQLA - basePortfolio.hqla,
            impactOutflows: dealOutflow
        };
    }, [scenarioDeal]);

    // Graph Data - LCR
    const lcrHistory = useMemo(() => {
        return MOCK_LIQUIDITY_DASHBOARD_DATA.history.map(h => ({
            ...h,
            simulated: h.lcr + (metrics.lcr - 135.4)
        }));
    }, [metrics.lcr]);

    // Graph Data - Funding Curves
    const fundingCurveData = useMemo(() => {
        const basePoints = MOCK_LIQUIDITY_CURVES[0].points;
        const currencyFactor = selectedCurrency === 'EUR' ? 0.8 : 1.0;
        const collateralSpread = collateralType === 'Unsecured' ? 15 : 0;

        return basePoints.map(p => {
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
                                        <button onClick={() => selectedDealId ? setSelectedDealId('') || setSelectedDealId(selectedDealId) : setScenarioDeal(INITIAL_DEAL)} className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold">
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
                                    <h4 className="text-sm font-bold text-white mb-6 uppercase">Funding Maturity Gap</h4>
                                    <div className="h-[280px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={MOCK_LIQUIDITY_DASHBOARD_DATA.basisSpreads}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                                <XAxis dataKey="tenor" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                                                <Bar dataKey="basis" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
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
                                            {[
                                                { label: 'Spread at 1Y', base: fundingCurveData[4].lp, sim: fundingCurveData[4].simLP },
                                                { label: 'Spread at 5Y', base: fundingCurveData.find(d => d.tenor === '5Y')?.lp || 0, sim: fundingCurveData.find(d => d.tenor === '5Y')?.simLP || 0 },
                                                { label: 'Current Slope (ON-5Y)', base: (fundingCurveData.find(d => d.tenor === '5Y')?.lp || 0) - fundingCurveData[0].lp, sim: (fundingCurveData.find(d => d.tenor === '5Y')?.simLP || 0) - fundingCurveData[0].simLP }
                                            ].map((item, i) => (
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
