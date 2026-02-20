import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
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
import { Activity, ShieldCheck, TrendingUp, Lock, Layers, BarChart4 } from 'lucide-react';

const ReportingDashboard: React.FC = () => {
    const data = MOCK_LIQUIDITY_DASHBOARD_DATA;
    const lpCurve = MOCK_LIQUIDITY_CURVES[0]; // USD Default

    return (
        <div className="flex flex-col h-full bg-slate-950 p-6 space-y-6 overflow-auto custom-scrollbar">
            {/* Bloomberg Style Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-xl font-mono font-bold text-white flex items-center gap-2">
                        <BarChart4 className="text-cyan-500" /> ALM & LIQUIDITY REPORTING <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-normal ml-2">V4.2 PRO</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">Global Treasury Desk / Basel III Oversight</p>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant="outline" className="border-emerald-900 text-emerald-500 font-mono">LIVE TAPE: SOFR 5.32%</Badge>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Last Refresh</div>
                        <div className="text-xs text-slate-300 font-mono">{new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
            </div>

            {/* 4-Quadrant Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">

                {/* Q1: Spread Sensitivity (Wholesale vs Term LP) */}
                <Panel title="Q1: LIQUIDITY SPREAD DYNAMICS" className="bg-slate-900/50 border-slate-800 h-[350px] flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1 text-[10px] text-slate-500"><div className="w-2 h-2 bg-slate-600 rounded-full"></div> Market Wholesale</span>
                            <span className="flex items-center gap-1 text-[10px] text-amber-500"><div className="w-2 h-2 bg-amber-500 rounded-full"></div> Term LP (Floor)</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lpCurve.points}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="tenor" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '4px' }}
                                    itemStyle={{ fontSize: '11px' }}
                                />
                                <Line type="stepAfter" dataKey="wholesaleSpread" stroke="#475569" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Wholesale" />
                                <Line type="monotone" dataKey="termLP" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} name="Term LP" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                {/* Q2: HQLA Carry Basis (LIBOR vs OIS) */}
                <Panel title="Q2: HQLA CARRY BASIS (LIBOR/OIS)" className="bg-slate-900/50 border-slate-800 h-[350px] flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1 text-[10px] text-cyan-500"><div className="w-2 h-2 bg-cyan-500 rounded-full"></div> LIBOR / Term</span>
                            <span className="flex items-center gap-1 text-[10px] text-emerald-500"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> OIS / Spot</span>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data.basisSpreads}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="tenor" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="left" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '4px' }}
                                    itemStyle={{ fontSize: '11px' }}
                                />
                                <Bar yAxisId="right" dataKey="basis" fill="#e11d48" opacity={0.3} name="Basis (bps)" />
                                <Line yAxisId="left" type="monotone" dataKey="libor" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                                <Line yAxisId="left" type="monotone" dataKey="ois" stroke="#10b981" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                {/* Q3: LCR Outflow Distribution */}
                <Panel title="Q3: LCR BUFFER ALLOCATION" className="bg-slate-900/50 border-slate-800 h-[350px] flex flex-col">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <div className="text-[10px] text-slate-500 uppercase font-mono">Outflow % vs Cost Charge</div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.clcProfiles} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="profile" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '4px' }}
                                    itemStyle={{ fontSize: '11px' }}
                                />
                                <Bar dataKey="outflow" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Outflow %" />
                                <Bar dataKey="cost" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Cost (bps)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>

                {/* Q4: Regulatory KPI Heatmap */}
                <Panel title="Q4: BASEL III KPI OVERSIGHT" className="bg-slate-900/50 border-slate-800 h-[350px] flex flex-col">
                    <div className="grid grid-cols-2 gap-4 h-full p-2">
                        <div className="bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                                <Layers className="text-amber-500" size={16} />
                                <span className="text-[10px] text-slate-500 uppercase font-bold">NSFR Optimization</span>
                            </div>
                            <div className="text-3xl font-mono font-bold text-amber-400">+{data.kpis.nsfrFloorPremium.toFixed(1)} <span className="text-xs">bps</span></div>
                            <div className="mt-2 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 w-[65%]"></div>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="text-emerald-500" size={16} />
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Secured Advantage</span>
                            </div>
                            <div className="text-3xl font-mono font-bold text-emerald-400">+{data.kpis.securedBenefit.toFixed(1)} <span className="text-xs">bps</span></div>
                            <div className="mt-2 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[82%]"></div>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="text-rose-500" size={16} />
                                <span className="text-[10px] text-slate-500 uppercase font-bold">LCR Carry Loss</span>
                            </div>
                            <div className="text-3xl font-mono font-bold text-rose-500">-{data.kpis.hqlaCost.toFixed(1)} <span className="text-xs">bps</span></div>
                            <div className="mt-2 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 w-[40%]"></div>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="text-cyan-500" size={16} />
                                <span className="text-[10px] text-slate-500 uppercase font-bold">Wholesale Cap</span>
                            </div>
                            <div className="text-3xl font-mono font-bold text-cyan-400">1.25 <span className="text-xs">x</span></div>
                            <div className="mt-2 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 w-[55%]"></div>
                            </div>
                        </div>
                    </div>
                </Panel>

            </div>

            {/* Industrial Footer */}
            <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-[10px] font-mono text-slate-500">
                <div className="flex gap-4">
                    <span>TERMINAL: TREASURY_ALM_01</span>
                    <span>SESSION: SECURE_V4.2</span>
                </div>
                <div className="flex gap-4 italic">
                    <span>* COST OF BUFFER: SOFR 1D - T-BILL 1M</span>
                    <span>* NSFR FLOOR: 1Y TERM FUNDING CONSTRAINTS APPLIED</span>
                </div>
            </div>
        </div>
    );
};

export default ReportingDashboard;
