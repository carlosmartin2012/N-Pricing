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
    Area
} from 'recharts';
import { DualLiquidityCurve, LiquidityCurvePoint } from '../../types';
import { MOCK_LIQUIDITY_CURVES } from '../../constants';
import { Panel, Badge } from '../ui/LayoutComponents';
import { Activity, ShieldCheck, TrendingUp, Info } from 'lucide-react';

interface Props {
    currency: string;
}

const LiquidityCurvesDashboard: React.FC<Props> = ({ currency }) => {
    const curve = useMemo(() => {
        return MOCK_LIQUIDITY_CURVES.find(c => c.currency === currency) || MOCK_LIQUIDITY_CURVES[0];
    }, [currency]);

    const stats = useMemo(() => {
        const avgWholesale = curve.points.reduce((acc, p) => acc + p.wholesaleSpread, 0) / curve.points.length;
        const avgTermLP = curve.points.reduce((acc, p) => acc + p.termLP, 0) / curve.points.length;

        // Impact of floor (Term LP - Wholesale)
        const floorImpact = curve.points.filter(p => ['ON', '1M', '3M', '6M'].includes(p.tenor))
            .reduce((acc, p) => acc + (p.termLP - p.wholesaleSpread), 0) / 4;

        return {
            wholesaleBasis: avgTermLP - avgWholesale,
            regulatoryFloorImpact: floorImpact,
            lastUpdate: curve.lastUpdate
        };
    }, [curve]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* 1. KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Wholesale Basis (Avg)</span>
                        <Activity size={14} className="text-cyan-400" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">+{stats.wholesaleBasis.toFixed(1)} <span className="text-xs text-slate-500">bps</span></div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <TrendingUp size={10} className="text-emerald-400" /> Spread differential (Term vs Spot)
                    </div>
                </div>

                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Regulatory Floor Impact</span>
                        <ShieldCheck size={14} className="text-amber-500" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-amber-500">+{stats.regulatoryFloorImpact.toFixed(1)} <span className="text-xs text-slate-500">bps</span></div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <Info size={10} className="text-amber-500" /> Basel III/NSFR 1Y Short-term impact
                    </div>
                </div>
            </div>

            {/* 2. Main Chart */}
            <div className="flex-1 bg-slate-950/80 border border-slate-800 p-6 rounded-xl flex flex-col min-h-[350px]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            Dual Liquidity Curves <Badge variant="secondary" className="text-[10px]">{currency}</Badge>
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">Updated: {stats.lastUpdate}</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1.5 grayscale opacity-50">
                            <div className="w-2 h-0.5 border-t border-dashed border-slate-400"></div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-[1px]">Wholesale</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-0.5 bg-amber-500 rounded-full"></div>
                            <span className="text-[9px] uppercase font-bold text-amber-500 tracking-[1px]">Term LP</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={curve.points} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey="tenor"
                                stroke="#475569"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#475569"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `${val} bps`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                                itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                                labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
                            />
                            <Line
                                type="monotone"
                                dataKey="wholesaleSpread"
                                name="Wholesale Funding"
                                stroke="#64748b"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ r: 3, fill: '#64748b' }}
                                activeDot={{ r: 5 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="termLP"
                                name="Term Liquidity Premium"
                                stroke="#f59e0b"
                                strokeWidth={3}
                                dot={{ r: 4, fill: '#f59e0b' }}
                                activeDot={{ r: 6, stroke: '#000', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Breakdown Footer */}
            <div className="bg-slate-900/30 border border-slate-800/50 p-3 rounded lg flex items-center justify-between">
                <div className="text-[9px] text-slate-500 italic max-w-md">
                    La curva "Term LP" incorpora el suelo regulatorio de 1 año definido por la normativa NSFR de Basilea III, provocando el desacoplamiento en tramos cortos.
                </div>
                <Badge variant="outline" className="text-[9px] font-mono border-slate-700">V4.0 INDUSTRIAL VIEW</Badge>
            </div>
        </div>
    );
};

export default LiquidityCurvesDashboard;
