
import React, { useState, useMemo } from 'react';
import { LineChart, Save, Download, Upload, TrendingUp, TrendingDown, RefreshCw, Layers, History, Globe } from 'lucide-react';
import { Panel, Badge, Button } from '../ui/LayoutComponents';
import { MOCK_YIELD_CURVE } from '../../constants';
import { storage } from '../../utils/storage';

export const YieldCurvePanel: React.FC = () => {
    const [currency, setCurrency] = useState('USD');
    const [shockBps, setShockBps] = useState(0);
    const [history, setHistory] = useState(() => storage.loadLocal(`yield_history_${currency}`, []));

    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'];

    // Calculate Shocked Curve
    const activeCurve = useMemo(() => {
        return MOCK_YIELD_CURVE.map(p => ({
            ...p,
            rate: p.rate + (shockBps / 100),
            original: p.rate
        }));
    }, [shockBps]);

    const handleSaveSnapshot = () => {
        const snapshot = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            currency,
            shock: shockBps,
            points: activeCurve
        };
        const newHistory = [snapshot, ...history].slice(0, 10);
        setHistory(newHistory);
        storage.saveLocal(`yield_history_${currency}`, newHistory);
        storage.addAuditEntry({
            userEmail: 'system',
            userName: 'System',
            action: 'SAVE_YIELD_SNAPSHOT',
            module: 'MARKET_DATA',
            description: `Saved ${currency} curve snapshot with ${shockBps}bps shock.`
        });
    };

    // SVG Chart Dimensions
    const width = 800;
    const height = 300;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxRate = Math.max(...activeCurve.map(p => p.rate), 6);
    const minRate = Math.min(...activeCurve.map(p => p.rate), 0);
    const range = maxRate - minRate;

    const getX = (index: number, total: number) => padding + (index * chartWidth / (total - 1));
    const getY = (rate: number) => height - padding - ((rate - minRate) * chartHeight / range);

    const points = activeCurve.map((p, i) => `${getX(i, activeCurve.length)},${getY(p.rate)}`).join(' ');
    const originalPoints = activeCurve.map((p, i) => `${getX(i, activeCurve.length)},${getY(p.original)}`).join(' ');

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                            <Globe size={10} /> Market Currency
                        </span>
                        <div className="flex gap-1">
                            {currencies.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setCurrency(c)}
                                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${currency === c ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 mx-2" />

                    <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                            <RefreshCw size={10} /> Parallel Shock (bps)
                        </span>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="-200"
                                max="200"
                                step="5"
                                value={shockBps}
                                onChange={(e) => setShockBps(parseInt(e.target.value))}
                                className="w-48 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className={`font-mono font-bold text-sm ${shockBps > 0 ? 'text-red-500' : shockBps < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {shockBps > 0 ? '+' : ''}{shockBps}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShockBps(0)} className="gap-2">
                        <RefreshCw size={14} /> Reset
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveSnapshot} className="gap-2">
                        <Save size={14} /> Snapshot
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 flex-1">
                <Panel title={`${currency} Yield Curve Analysis (IRRBB)`} className="col-span-8 h-full bg-white dark:bg-[#0a0a0a]">
                    <div className="relative w-full h-[320px] mt-4">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                            {/* Grid Lines */}
                            {[0, 1, 2, 3, 4, 5].map(i => {
                                const val = minRate + (i * range / 5);
                                const y = getY(val);
                                return (
                                    <g key={i}>
                                        <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="4 2" />
                                        <text x={padding - 10} y={y} fill="#64748b" fontSize="10" textAnchor="end" alignmentBaseline="middle" className="font-mono">
                                            {val.toFixed(1)}%
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Tenor Labels */}
                            {activeCurve.map((p, i) => (
                                <text key={i} x={getX(i, activeCurve.length)} y={height - padding + 20} fill="#64748b" fontSize="10" textAnchor="middle" className="font-mono">
                                    {p.tenor}
                                </text>
                            ))}

                            {/* Base Curve (Dashed) */}
                            <polyline
                                fill="none"
                                stroke="#334155"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                                points={originalPoints}
                            />

                            {/* Active Curve Area */}
                            <path
                                d={`M ${padding},${height - padding} ${activeCurve.map((p, i) => `L ${getX(i, activeCurve.length)},${getY(p.rate)}`).join(' ')} L ${width - padding},${height - padding} Z`}
                                fill="url(#curveGradient)"
                                className="opacity-20"
                            />

                            {/* Active Line */}
                            <polyline
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="2.5"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                points={points}
                                className="drop-shadow-lg"
                            />

                            {/* Points */}
                            {activeCurve.map((p, i) => (
                                <circle
                                    key={i}
                                    cx={getX(i, activeCurve.length)}
                                    cy={getY(p.rate)}
                                    r="4"
                                    fill="#10b981"
                                    className="hover:r-6 transition-all cursor-crosshair"
                                />
                            ))}

                            <defs>
                                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    <div className="mt-6 grid grid-cols-4 gap-4">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Overnight</span>
                            <span className="text-xl font-mono font-bold text-emerald-500">{activeCurve[0].rate.toFixed(3)}%</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">1Y Rate</span>
                            <span className="text-xl font-mono font-bold text-emerald-500">{activeCurve[4].rate.toFixed(3)}%</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">10Y Rate</span>
                            <span className="text-xl font-mono font-bold text-emerald-500">{activeCurve[9].rate.toFixed(3)}%</span>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">30Y Rate</span>
                            <span className="text-xl font-mono font-bold text-emerald-500">{activeCurve[11].rate.toFixed(3)}%</span>
                        </div>
                    </div>
                </Panel>

                <Panel title="Snapshot Governance" className="col-span-4 h-full bg-white dark:bg-[#0a0a0a]">
                    <div className="space-y-4">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center gap-2">
                            <History size={12} /> Audit Trail
                        </div>

                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                                <Layers size={32} className="mb-2 opacity-20" />
                                <span className="text-xs">No historical snapshots</span>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-auto pr-2 custom-scrollbar">
                                {history.map((snap: any) => (
                                    <div key={snap.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-emerald-500/50 transition-colors group">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold font-mono">{snap.currency}</span>
                                                    <Badge variant={snap.shock === 0 ? 'default' : 'warning'}>
                                                        {snap.shock > 0 ? '+' : ''}{snap.shock}bps
                                                    </Badge>
                                                </div>
                                                <span className="text-[10px] text-slate-500 block mt-1">
                                                    {new Date(snap.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-500/20 rounded transition-all text-emerald-500">
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-800">
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-2">Import / Export Hub</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" className="w-full text-[10px] py-1">
                                        <Upload size={12} className="mr-1" /> JSON/CSV
                                    </Button>
                                    <Button variant="outline" size="sm" className="w-full text-[10px] py-1">
                                        <Download size={12} className="mr-1" /> EXCEL
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>
        </div>
    );
};

export default YieldCurvePanel;
