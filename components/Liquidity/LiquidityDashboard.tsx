import React, { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
    ComposedChart
} from 'recharts';
import { MOCK_LIQUIDITY_DASHBOARD_DATA, MOCK_LIQUIDITY_CURVES } from '../../constants';
import { Panel, Badge } from '../ui/LayoutComponents';
import { Activity, ShieldCheck, TrendingUp, Info, Lock, Unlock, Database, Layers } from 'lucide-react';

const LiquidityDashboard: React.FC = () => {
    const data = MOCK_LIQUIDITY_DASHBOARD_DATA;
    const lpCurve = MOCK_LIQUIDITY_CURVES[0]; // USD Default

    return (
        <div className="space-y-6 flex flex-col h-full bg-slate-950/20 p-2 rounded-2xl border border-slate-900/50">

            {/* KPI Header Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Panel className="bg-slate-900/40 border-slate-800/50">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cost of HQLA Buffer (1Y)</span>
                        <Database size={14} className="text-rose-500" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-rose-500">-{data.kpis.hqlaCost.toFixed(1)} <span className="text-xs text-slate-500">bps</span></div>
                    <p className="text-[9px] text-slate-500 mt-1">Carry loss due to LIBOR/OIS basis</p>
                </Panel>

                <Panel className="bg-slate-900/40 border-slate-800/50">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">NSFR Floor Premium</span>
                        <Layers size={14} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-amber-500">+{data.kpis.nsfrFloorPremium.toFixed(1)} <span className="text-xs text-slate-500">bps</span></div>
                    <p className="text-[9px] text-slate-500 mt-1">Impact of 1Y short-term regulatory floor</p>
                </Panel>

                <Panel className="bg-slate-900/40 border-slate-800/50">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Secured Funding Benefit</span>
                        <ShieldCheck size={14} className="text-emerald-400" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-emerald-400">+{data.kpis.securedBenefit.toFixed(1)} <span className="text-xs text-slate-500">bps</span></div>
                    <p className="text-[9px] text-slate-500 mt-1">Collateralized vs Senior Unsecured spread</p>
                </Panel>
            </div>

            {/* 4-Quadrant Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">

                {/* Q1: Term LP (Wholesale vs Term LP) */}
                <div className="bg-slate-900/20 border border-slate-800/50 rounded-xl p-4 flex flex-col h-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity size={12} className="text-cyan-400" /> Q1: Term LP Génesis
                        </h4>
                        <div className="flex gap-3">
                            <span className="flex items-center gap-1 text-[9px] text-slate-500"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div> Wholesale</span>
                            <span className="flex items-center gap-1 text-[9px] text-amber-500"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div> Term LP</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lpCurve.points}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="tenor" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '10px' }}
                                />
                                <Line type="monotone" dataKey="wholesaleSpread" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                <Line type="monotone" dataKey="termLP" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Q2: Funding Profiles (Secured vs Unsecured) */}
                <div className="bg-slate-900/20 border border-slate-800/50 rounded-xl p-4 flex flex-col h-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <Unlock size={12} className="text-emerald-400" /> Q2: Funding Area Analysis
                        </h4>
                        <div className="flex gap-3">
                            <span className="flex items-center gap-1 text-[9px] text-emerald-400"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div> Secured</span>
                            <span className="flex items-center gap-1 text-[9px] text-slate-500"><div className="w-1.5 h-1.5 bg-slate-500 rounded-full"></div> Unsecured</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.fundingCurves}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="tenor" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '10px' }}
                                />
                                <Area type="monotone" dataKey="unsecured" stroke="#64748b" fill="#64748b" fillOpacity={0.1} />
                                <Area type="monotone" dataKey="secured" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Q3: HQLA Basis (LIBOR vs OIS) */}
                <div className="bg-slate-900/20 border border-slate-800/50 rounded-xl p-4 flex flex-col h-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp size={12} className="text-rose-500" /> Q3: HQLA Basis (LIBOR/OIS)
                        </h4>
                        <div className="flex gap-3 text-[9px]">
                            <span className="text-slate-400 italic">Neg. Spread = Carry Cost</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data.basisSpreads}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="tenor" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '10px' }}
                                />
                                <Bar yAxisId="right" dataKey="basis" fill="#e11d48" opacity={0.4} name="Basis (bps)" />
                                <Line yAxisId="left" type="monotone" dataKey="libor" stroke="#94a3b8" strokeWidth={2} dot={false} name="LIBOR / Term" />
                                <Line yAxisId="left" type="monotone" dataKey="ois" stroke="#0ea5e9" strokeWidth={2} dot={false} name="OIS / Spot" />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Q4: CLC Profile (Horizontal Bars) */}
                <div className="bg-slate-900/20 border border-slate-800/50 rounded-xl p-4 flex flex-col h-[300px]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-2">
                            <ShieldCheck size={12} className="text-cyan-400" /> Q4: CLC Risk Profile Cost
                        </h4>
                        <Badge variant="outline" className="text-[9px] font-mono border-slate-800 text-slate-500">BPS Impact</Badge>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.clcProfiles} layout="vertical" margin={{ left: 20, right: 30 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis dataKey="profile" type="category" stroke="#94a3b8" fontSize={9} width={100} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '10px' }}
                                    cursor={{ fill: '#1e293b', opacity: 0.4 }}
                                />
                                <Bar dataKey="cost" name="CLC Cost (bps)" radius={[0, 4, 4, 0]}>
                                    {data.clcProfiles.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.cost > 20 ? '#e11d48' : entry.cost > 10 ? '#f59e0b' : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            <div className="bg-slate-900/30 border border-slate-800/50 p-3 rounded-lg flex items-center justify-between mt-auto">
                <div className="text-[9px] text-slate-500 italic max-w-2xl font-mono">
                    ALM NARRATIVE: El coste de liquidez (CLC) se genera por el carry negativo del colchón HQLA (Basis LIBOR/OIS). Los beneficios "Secured" y "Operational" logran mitigar este impacto regulatorio.
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-rose-500 rounded-full"></div>
                        <span className="text-[8px] uppercase tracking-tighter text-slate-500">LCR Costs</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                        <span className="text-[8px] uppercase tracking-tighter text-slate-500">ALM Benefits</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiquidityDashboard;
