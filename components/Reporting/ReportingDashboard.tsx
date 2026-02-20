import React from 'react';
import { MOCK_LIQUIDITY_DASHBOARD_DATA, MOCK_LIQUIDITY_CURVES } from '../../constants';
import { Panel, Badge } from '../ui/LayoutComponents';
import { Activity, ShieldCheck, TrendingUp, BarChart4, Droplets, Target, Shield } from 'lucide-react';

const ReportingDashboard: React.FC = () => {
    const data = MOCK_LIQUIDITY_DASHBOARD_DATA;
    const lpPoints = MOCK_LIQUIDITY_CURVES[0].points;

    // SVG Layout Constants
    const width = 500;
    const height = 240;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Helper: Scales
    const getX = (index: number, total: number) => padding + (index / (total - 1)) * chartWidth;
    const getY = (value: number, min: number, max: number) => height - padding - ((value - min) / (max - min)) * chartHeight;

    return (
        <div className="flex flex-col h-full bg-[#050505] p-6 space-y-6 overflow-auto custom-scrollbar font-sans">
            {/* Bloomberg Style Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                    <h2 className="text-xl font-mono font-bold text-white flex items-center gap-2">
                        <BarChart4 className="text-cyan-500" /> ALM & LIQUIDITY TERMINAL <span className="text-[10px] bg-cyan-900/30 border border-cyan-800 px-2 py-0.5 rounded text-cyan-400 font-bold ml-2">V4.4 SYSTEM</span>
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-[0.2em] font-bold">Basel III Liquidity Risk Framework / Global Treasury</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Status</span>
                        <Badge variant="outline" className="border-emerald-900/50 bg-emerald-950/10 text-emerald-500 font-mono text-[10px] py-0 px-2 flex items-center gap-1">
                            <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> SYNCED: SOFR 5.32%
                        </Badge>
                    </div>
                </div>
            </div>

            {/* KPI Header Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0a0a0a] border-l-4 border-rose-600 p-4 rounded-r shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">HQLA Buffer Cost</div>
                            <div className="text-2xl font-mono font-bold text-white">-{data.kpis.hqlaCost.toFixed(1)} <span className="text-xs text-rose-500">bps</span></div>
                        </div>
                        <Droplets className="text-rose-900" size={24} />
                    </div>
                </div>
                <div className="bg-[#0a0a0a] border-l-4 border-amber-500 p-4 rounded-r shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">NSFR Floor Premium</div>
                            <div className="text-2xl font-mono font-bold text-white">+{data.kpis.nsfrFloorPremium.toFixed(1)} <span className="text-xs text-amber-500">bps</span></div>
                        </div>
                        <Target className="text-amber-900" size={24} />
                    </div>
                </div>
                <div className="bg-[#0a0a0a] border-l-4 border-emerald-500 p-4 rounded-r shadow-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Secured Benefit</div>
                            <div className="text-2xl font-mono font-bold text-white">+{data.kpis.securedBenefit.toFixed(1)} <span className="text-xs text-emerald-500">bps</span></div>
                        </div>
                        <Shield className="text-emerald-900" size={24} />
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">

                {/* Q1: Term LP Genesis */}
                <Panel title="Q1: TERM LP GENESIS (LIQUIDITY FLOOR)" className="bg-[#080808] border-slate-800">
                    <div className="relative">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                            {/* Grid Lines */}
                            {[0, 1, 2, 3, 4].map(i => (
                                <line key={i} x1={padding} y1={padding + (i * chartHeight / 4)} x2={width - padding} y2={padding + (i * chartHeight / 4)} stroke="#1e293b" strokeWidth="0.5" />
                            ))}

                            {/* X-Axis labels */}
                            {lpPoints.map((p, i) => (
                                <text key={i} x={getX(i, lpPoints.length)} y={height - padding + 15} textAnchor="middle" fill="#475569" fontSize="10" className="font-mono">{p.tenor}</text>
                            ))}

                            {/* Wholesale Line (Dashed) */}
                            <polyline
                                fill="none"
                                stroke="#475569"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                                points={lpPoints.map((p, i) => `${getX(i, lpPoints.length)},${getY(p.wholesaleSpread, 0, 60)}`).join(' ')}
                            />

                            {/* Term LP Line (Solid Amber) */}
                            <polyline
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="2.5"
                                points={lpPoints.map((p, i) => `${getX(i, lpPoints.length)},${getY(p.termLP, 0, 60)}`).join(' ')}
                            />

                            {/* Data points */}
                            {lpPoints.map((p, i) => (
                                <circle key={i} cx={getX(i, lpPoints.length)} cy={getY(p.termLP, 0, 60)} r="3" fill="#050505" stroke="#f59e0b" strokeWidth="2" />
                            ))}
                        </svg>
                        <div className="absolute top-0 right-0 p-2 text-[9px] font-mono space-y-1">
                            <div className="flex items-center gap-2"><div className="w-2 h-0.5 bg-amber-500"></div> Term LP (Floor)</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-0.5 bg-slate-500 border-dashed border-t border-slate-500"></div> Wholesale</div>
                        </div>
                    </div>
                </Panel>

                {/* Q2: Funding Analysis */}
                <Panel title="Q2: FUNDING MARGIN SAVINGS (AREA)" className="bg-[#080808] border-slate-800">
                    <div className="relative">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-mono">
                            {/* Area Gradient */}
                            <defs>
                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                            </defs>

                            {/* Secured Area */}
                            <path
                                fill="url(#areaGrad)"
                                d={`M${padding},${height - padding} ` +
                                    data.fundingCurves.map((p, i) => `L${getX(i, data.fundingCurves.length)},${getY(p.secured, 5, 7)}`).join(' ') +
                                    ` L${width - padding},${height - padding} Z`}
                            />

                            {/* Unsecured Line */}
                            <polyline
                                fill="none"
                                stroke="#e11d48"
                                strokeWidth="2"
                                points={data.fundingCurves.map((p, i) => `${getX(i, data.fundingCurves.length)},${getY(p.unsecured, 5, 7)}`).join(' ')}
                            />

                            {/* Secured Line */}
                            <polyline
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2"
                                points={data.fundingCurves.map((p, i) => `${getX(i, data.fundingCurves.length)},${getY(p.secured, 5, 7)}`).join(' ')}
                            />

                            {data.fundingCurves.map((p, i) => (
                                <text key={i} x={getX(i, data.fundingCurves.length)} y={height - padding + 15} textAnchor="middle" fill="#475569" fontSize="10">{p.tenor}</text>
                            ))}
                        </svg>
                        <div className="absolute top-0 right-0 p-2 text-[9px] font-bold space-y-1 uppercase">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-rose-500"></div> Unsecured</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500"></div> Secured</div>
                        </div>
                    </div>
                </Panel>

                {/* Q3: HQLA Basis */}
                <Panel title="Q3: HQLA BASIS DIFFERENTIAL (HISTOGRAM)" className="bg-[#080808] border-slate-800">
                    <div className="relative">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible font-mono">
                            {data.basisSpreads.map((p, i) => {
                                const x = getX(i, data.basisSpreads.length);
                                const barWidth = 20;
                                const barHeight = (p.basis / 40) * chartHeight;
                                return (
                                    <g key={i}>
                                        <rect
                                            x={x - barWidth / 2}
                                            y={height - padding - barHeight}
                                            width={barWidth}
                                            height={barHeight}
                                            fill="#0891b2"
                                            opacity="0.8"
                                            rx="2"
                                        />
                                        <text x={x} y={height - padding + 15} textAnchor="middle" fill="#475569" fontSize="10">{p.tenor}</text>
                                        <text x={x} y={height - padding - barHeight - 5} textAnchor="middle" fill="#22d3ee" fontSize="9" fontWeight="bold">{p.basis}bp</text>
                                    </g>
                                );
                            })}
                            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#1e293b" />
                        </svg>
                    </div>
                </Panel>

                {/* Q4: CLC Profiles */}
                <Panel title="Q4: CLC RISK PROFILES (SEVERITY BARS)" className="bg-[#080808] border-slate-800">
                    <div className="p-4 space-y-4 font-mono">
                        {data.clcProfiles.map((p, i) => (
                            <div key={i} className="space-y-1">
                                <div className="flex justify-between items-center text-[10px] font-bold">
                                    <span className="text-slate-400">{p.profile}</span>
                                    <span className={`${p.outflow > 50 ? 'text-rose-500' : 'text-cyan-400'}`}>{p.outflow}% Outflow / {p.cost}bps</span>
                                </div>
                                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
                                    <div
                                        className={`h-full ${p.outflow > 50 ? 'bg-gradient-to-r from-rose-800 to-rose-500' : 'bg-gradient-to-r from-cyan-800 to-cyan-500'}`}
                                        style={{ width: `${p.outflow}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

            </div>

            {/* Terminal Footer */}
            <div className="border-t border-slate-800 pt-4 flex justify-between items-center text-[9px] font-mono text-slate-500">
                <div className="flex gap-4 font-bold">
                    <span className="text-cyan-900">TERMINAL: TRE_SYS_A24</span>
                    <span>SESSION: BASEL_III_RIGOR</span>
                    <span className="text-emerald-900">ENCRYPTION: AES-256</span>
                </div>
                <div className="flex gap-4 italic uppercase">
                    <span>* NSFR CONSTRAINTS APPLIED</span>
                    <span>* LCR RATIO: 135.4%</span>
                </div>
            </div>
        </div>
    );
};

export default ReportingDashboard;
