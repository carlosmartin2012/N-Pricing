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
    Target, Shield, Search, RefreshCw, AlertCircle, Info, ChevronRight, Calculator
} from 'lucide-react';
import { Transaction, ProductDefinition, BusinessUnit, ClientEntity } from '../../types';

interface ReportingDashboardProps {
    deals: Transaction[];
    products: ProductDefinition[];
    businessUnits: BusinessUnit[];
    clients: ClientEntity[];
    shocks: { interestRate: number; liquiditySpread: number };
}

const ReportingDashboard: React.FC<ReportingDashboardProps> = ({
    deals,
    products,
    businessUnits,
    clients,
    shocks
}) => {
    // Selection state
    const [selectedDealId, setSelectedDealId] = useState<string>('');
    const [scenarioDeal, setScenarioDeal] = useState<Transaction>(INITIAL_DEAL);
    const [isModified, setIsModified] = useState(false);

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

    // Base Portfolio Values (Mocks for Dashboard Context)
    const basePortfolio = {
        hqla: 250000000,
        netOutflows: 180000000,
        asf: 850000000,
        rsf: 720000000
    };

    const metrics = useMemo(() => {
        // Impact logic
        const amount = Number(scenarioDeal.amount) || 0;
        const isAsset = scenarioDeal.category === 'Asset';
        const isLiability = scenarioDeal.category === 'Liability';
        const isOffBalance = scenarioDeal.category === 'Off-Balance';

        // LCR Impact (simplified)
        let dealOutflow = 0;
        if (isLiability) {
            dealOutflow = amount * ((scenarioDeal.lcrOutflowPct || 25) / 100);
        } else if (isOffBalance && scenarioDeal.isCommitted) {
            dealOutflow = amount * ((scenarioDeal.lcrOutflowPct || 10) / 100);
        }

        const finalHQLA = isAsset && scenarioDeal.productType === 'HQLA_BOND' ? basePortfolio.hqla + amount : basePortfolio.hqla;
        const finalOutflows = basePortfolio.netOutflows + dealOutflow;
        const lcr = (finalHQLA / finalOutflows) * 100;

        // NSFR Impact (simplified factors)
        let dealASF = 0;
        let dealRSF = 0;

        if (isLiability) {
            // Factor based on duration
            const factor = scenarioDeal.durationMonths >= 12 ? 1.0 : 0.5;
            dealASF = amount * factor;
        } else if (isAsset) {
            const factor = scenarioDeal.durationMonths >= 12 ? 1.0 : 0.5;
            dealRSF = amount * factor;
        }

        const finalASF = basePortfolio.asf + dealASF;
        const finalRSF = basePortfolio.rsf + dealRSF;
        const nsfr = (finalASF / finalRSF) * 100;

        // LP Calculation (interpolated from mock curve)
        const lpPoints = MOCK_LIQUIDITY_CURVES[0].points;
        const duration = scenarioDeal.durationMonths || 1;

        // Find nearest point
        const lpValue = duration <= 1 ? lpPoints[0].termLP :
            duration >= 60 ? lpPoints[lpPoints.length - 1].termLP :
                lpPoints[Math.min(Math.floor(duration / 12), lpPoints.length - 1)].termLP;

        return {
            lcr,
            nsfr,
            lpValue,
            clc: (scenarioDeal.lcrOutflowPct || 0) * 0.35, // Mock CLC logic
            wlp: (amount / 1000000) * 1.2, // Weighted liquidity position mock
            impactHQLA: finalHQLA - basePortfolio.hqla,
            impactOutflows: dealOutflow
        };
    }, [scenarioDeal, basePortfolio]);

    // Graph Data
    const lcrHistory = useMemo(() => {
        return MOCK_LIQUIDITY_DASHBOARD_DATA.history.map(h => ({
            ...h,
            simulated: h.lcr + (metrics.lcr - 135.4) // Adjust history relative to current sim
        }));
    }, [metrics.lcr]);

    const findClientName = (id: string) => clients.find(c => c.id === id)?.name || id;

    return (
        <div className="flex flex-col h-full bg-[#020617] text-slate-200 overflow-hidden font-sans">
            {/* Bloomberg Style Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-3 bg-[#0f172a]/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <BarChart4 className="text-cyan-400 w-5 h-5" />
                        <h2 className="text-sm font-bold tracking-tight text-white uppercase font-mono">
                            Liquidity Risk Terminal <span className="text-slate-500 font-normal">v4.5</span>
                        </h2>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10 mx-2" />
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Focus Deal:</label>
                        <select
                            value={selectedDealId}
                            onChange={(e) => setSelectedDealId(e.target.value)}
                            className="bg-black/40 border border-white/10 text-xs text-cyan-400 px-3 py-1 rounded outline-none focus:border-cyan-500/50 min-w-[220px] font-mono"
                        >
                            <option value="">-- Global Portfolio View --</option>
                            {deals.map(d => (
                                <option key={d.id} value={d.id}>{d.id} | {findClientName(d.clientId)}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Market State</span>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                                SOFR: 5.32%
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400 bg-amber-500/5">
                                BI-3: STABLE
                            </Badge>
                        </div>
                    </div>
                    <div className="flex flex-col items-end border-l border-white/10 pl-6">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Cycle Time</span>
                        <span className="text-xs font-mono text-white">12:28:45 UTC</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: What-if Panel */}
                <div className="w-80 border-r border-white/10 bg-[#020617] overflow-y-auto custom-scrollbar p-6 space-y-8">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Calculator className="w-4 h-4 text-cyan-500" /> What-If Inputs
                            </h3>
                            {isModified && (
                                <button
                                    onClick={() => selectedDealId ? setSelectedDealId('') || setSelectedDealId(selectedDealId) : setScenarioDeal(INITIAL_DEAL)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-bold"
                                >
                                    <RefreshCw className="w-3 h-3" /> RESET
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (Notional)</label>
                                <input
                                    type="number"
                                    value={scenarioDeal.amount}
                                    onChange={(e) => handleScenarioChange('amount', Number(e.target.value))}
                                    className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-cyan-500/50 outline-none font-mono"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Duration (Months)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="120"
                                        value={scenarioDeal.durationMonths}
                                        onChange={(e) => handleScenarioChange('durationMonths', Number(e.target.value))}
                                        className="flex-1 accent-cyan-500"
                                    />
                                    <span className="text-sm font-mono text-cyan-400 w-8">{scenarioDeal.durationMonths}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">LCR Outflow Ratio (%)</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[5, 25, 40, 100].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => handleScenarioChange('lcrOutflowPct', val)}
                                            className={`text-[10px] py-1 rounded border ${scenarioDeal.lcrOutflowPct === val ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-black/40 border-white/10 text-slate-500 hover:border-white/30'}`}
                                        >
                                            {val}%
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    value={scenarioDeal.lcrOutflowPct}
                                    onChange={(e) => handleScenarioChange('lcrOutflowPct', Number(e.target.value))}
                                    className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-xs text-white mt-1 outline-none"
                                />
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Classification</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Asset', 'Liability', 'Off-Balance'].map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => handleScenarioChange('category', cat)}
                                            className={`text-[9px] px-2 py-1 rounded-full border ${scenarioDeal.category === cat ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-black/40 border-white/10 text-slate-500'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 bg-cyan-950/20 border border-cyan-500/20 rounded mt-6">
                                <h4 className="text-[10px] font-bold text-cyan-400 mb-2 uppercase flex items-center gap-2">
                                    <Info className="w-3 h-3" /> Impact Estimate
                                </h4>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-slate-500">Addtl. Outflows:</span>
                                        <span className="font-mono text-rose-400">+{(metrics.impactOutflows / 1000000).toFixed(2)}M</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-slate-500">Liquidity Value:</span>
                                        <span className="font-mono text-emerald-400">{(metrics.wlp).toFixed(2)} pts</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <div className="text-[9px] text-slate-600 font-mono leading-tight">
                            * Simulating Basel III requirements. Ratios reflect bank-wide impact of the selected component.
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 p-8 space-y-8">

                    {/* Top KPI Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ShieldCheck size={48} className="text-cyan-400" />
                            </div>
                            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">LCR Ratio</div>
                            <div className="flex items-baseline gap-2">
                                <div className="text-3xl font-mono font-bold text-white">{metrics.lcr.toFixed(1)}%</div>
                                <div className={`text-[10px] font-bold ${metrics.lcr > 100 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {metrics.lcr > 100 ? '+SAFE' : '-RISK'}
                                </div>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                <Target size={12} className="text-cyan-500/50" /> Target: {'>'}100%
                            </div>
                        </div>

                        <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Activity size={48} className="text-amber-400" />
                            </div>
                            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">NSFR Ratio</div>
                            <div className="flex items-baseline gap-2">
                                <div className="text-3xl font-mono font-bold text-white">{metrics.nsfr.toFixed(1)}%</div>
                                <div className="text-[10px] font-bold text-emerald-500">OK</div>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                <Target size={12} className="text-amber-500/50" /> Target: {'>'}100%
                            </div>
                        </div>

                        <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Droplets size={48} className="text-indigo-400" />
                            </div>
                            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">Liquidity Premium</div>
                            <div className="flex items-baseline gap-2">
                                <div className="text-3xl font-mono font-bold text-white">{metrics.lpValue.toFixed(1)}</div>
                                <span className="text-xs text-indigo-400 font-bold">bps</span>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                <TrendingUp size={12} className="text-indigo-500/50" /> Curve-Derived
                            </div>
                        </div>

                        <div className="bg-[#0f172a]/40 border border-white/10 p-5 rounded-xl backdrop-blur-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Shield size={48} className="text-emerald-400" />
                            </div>
                            <div className="text-[11px] text-slate-400 uppercase font-bold tracking-widest mb-1">CLC Index (Coverage)</div>
                            <div className="flex items-baseline gap-2">
                                <div className="text-3xl font-mono font-bold text-white">{metrics.clc.toFixed(1)}%</div>
                                <div className="text-[10px] font-bold text-slate-500">WLP: {metrics.wlp.toFixed(0)}</div>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                                <Info size={12} className="text-emerald-500/50" /> Cash-to-Liability
                            </div>
                        </div>
                    </div>

                    {/* Chart Area */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LCR Trend Chart */}
                        <div className="bg-[#0f172a]/30 border border-white/5 p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h4 className="text-sm font-bold text-white uppercase tracking-tight">LCR Stress Simulation</h4>
                                    <p className="text-[10px] text-slate-500">Historical trend vs Current scenario impact</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-cyan-500" />
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Base</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-rose-500" />
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">Scenario</span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={lcrHistory}>
                                        <defs>
                                            <linearGradient id="colorLcr" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#475569', fontSize: 9 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#475569', fontSize: 9 }}
                                            domain={['dataMin - 5', 'dataMax + 5']}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Area type="monotone" dataKey="lcr" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorLcr)" />
                                        <Area type="monotone" dataKey="simulated" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorSim)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Liquidity Gap View */}
                        <div className="bg-[#0f172a]/30 border border-white/5 p-6 rounded-2xl">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h4 className="text-sm font-bold text-white uppercase tracking-tight">Liquidity Accumulation Curve</h4>
                                    <p className="text-[10px] text-slate-500">ASF vs RSF maturity distribution</p>
                                </div>
                            </div>

                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={MOCK_LIQUIDITY_DASHBOARD_DATA.basisSpreads}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                        <XAxis
                                            dataKey="tenor"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#475569', fontSize: 9 }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#475569', fontSize: 9 }}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '10px' }}
                                        />
                                        <Bar dataKey="basis" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Line type="stepAfter" dataKey="libor" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Panel title="Regulatory Constraints" className="bg-[#0f172a]/20 border-white/5">
                            <div className="space-y-4 p-2">
                                {[
                                    { label: 'Basel III LCR Floor', status: 'Compliant', value: '1.0x' },
                                    { label: 'NSFR Net Stable funding', status: 'Compliant', value: '114%' },
                                    { label: 'HQLA Level 1 Concentration', status: 'Warning', value: '85%' }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'Compliant' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{item.label}</span>
                                        </div>
                                        <span className="text-[10px] font-mono text-white">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </Panel>

                        <Panel title="Cash Flow Gap (EAD)" className="bg-[#0f172a]/20 border-white/5">
                            <div className="space-y-3 p-2">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                                        <span>SHORT TERM (0-30D)</span>
                                        <span className="text-emerald-400">$420M Surplus</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-[65%]" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1">
                                        <span>MEDIUM TERM (1-12M)</span>
                                        <span className="text-amber-400">$105M Deficit</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500 w-[40%]" />
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        <Panel title="Market Sensitivity" className="bg-[#0f172a]/20 border-white/5">
                            <div className="grid grid-cols-2 gap-4 p-2">
                                <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">IR Δ (Parallel)</div>
                                    <div className="text-sm font-mono text-rose-400">-{shocks.interestRate}bp</div>
                                </div>
                                <div className="p-3 bg-black/40 rounded-lg border border-white/5">
                                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Liq. Volatility</div>
                                    <div className="text-sm font-mono text-amber-400">HIGH</div>
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
            </div>

            {/* Terminal Status Bar (Bottom) */}
            <div className="h-8 border-t border-white/10 bg-[#020617] px-6 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] text-emerald-500 font-mono font-bold tracking-tight">SYSTEMS UP-TO-DATE</span>
                    </div>
                    <div className="text-[10px] text-slate-600 font-mono">MD SOURCE: ICE / REUTERS REALTIME</div>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
                    <span className="flex items-center gap-1"><AlertCircle size={10} /> BASEL_III_ENFORCED</span>
                    <span className="text-white/20">|</span>
                    <span className="text-cyan-900 font-bold uppercase tracking-widest">N-Pricing Intelligence Node</span>
                </div>
            </div>
        </div>
    );
};

export default ReportingDashboard;
