
import React, { useState, useMemo, useEffect } from 'react';
import { Panel, Badge, TextInput } from '../ui/LayoutComponents';
import { MOCK_YIELD_CURVE } from '../../constants';
import { RefreshCw, TrendingUp, TrendingDown, Calendar, History, FileCheck, Zap, Save, Upload, ChevronDown } from 'lucide-react';
import { storage } from '../../utils/storage';
import { FileUploadModal } from '../ui/FileUploadModal';
import { YieldCurvePoint } from '../../types';
import { translations, Language } from '../../translations';
import { downloadTemplate, parseExcel } from '../../utils/excelUtils';
import { FileSpreadsheet } from 'lucide-react';

interface Props {
    language: Language;
    user: any;
}

const YieldCurvePanel: React.FC<Props> = ({ language, user }) => {
    const t = translations[language];
    const [currency, setCurrency] = useState('USD');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [shockBps, setShockBps] = useState<number>(0);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [curvesHistory, setCurvesHistory] = useState<Record<string, YieldCurvePoint[]>>(() => storage.getCurves());

    const width = 800;
    const height = 300;
    const padding = 40;

    // Sync History to Storage
    useEffect(() => {
        storage.saveCurves(curvesHistory);
    }, [curvesHistory]);

    // Realtime Sync for Yield Curves
    useEffect(() => {
        const subscription = supabaseService.subscribeToAll((payload) => {
            if (payload.table === 'yield_curves' && payload.eventType === 'INSERT') {
                const newCurve = payload.new;
                const currency = newCurve.currency;
                const date = newCurve.as_of_date;
                const key = `${currency}-${date}`;

                setCurvesHistory(prev => ({
                    ...prev,
                    [key]: newCurve.grid_data.map((pt: any) => ({
                        tenor: pt.tenor,
                        rate: pt.rate,
                        prev: pt.prev || pt.rate
                    }))
                }));
            }
        });
        return () => { if (subscription) subscription.unsubscribe(); };
    }, []);

    // Transform mock data based on currency AND date to simulate historical curves
    const data = useMemo(() => {
        let basePoints = curvesHistory[`${currency}-${selectedDate}`];

        if (!basePoints) {
            // Fallback to MOCK + pseudo-random if no snapshot exists
            let modifier = 0;
            if (currency === 'EUR') modifier = -1.5;
            if (currency === 'GBP') modifier = 0.5;
            if (currency === 'JPY') modifier = -4.0;
            const dateNum = selectedDate.split('-').reduce((a, b) => a + parseInt(b), 0);
            const dateMod = (dateNum % 5) * 0.1;

            basePoints = MOCK_YIELD_CURVE.map(pt => ({
                tenor: pt.tenor,
                rate: Math.max(0.1, pt.rate + modifier + dateMod),
                prev: Math.max(0.1, pt.prev + modifier)
            }));
        }

        return basePoints.map((pt, i) => {
            const shockedRate = pt.rate + (shockBps / 100);
            return {
                ...pt,
                baseRate: pt.rate,
                rate: Math.max(0.01, shockedRate),
                index: i
            };
        });
    }, [currency, selectedDate, shockBps, curvesHistory]);

    const handleSaveSnapshot = () => {
        const key = `${currency}-${selectedDate}`;
        setCurvesHistory(prev => ({
            ...prev,
            [key]: data.map(d => ({ tenor: d.tenor, rate: d.baseRate, prev: d.prev })) // Save pre-shock
        }));

        storage.addAuditEntry({
            userEmail: user?.email || 'unknown',
            userName: user?.name || 'Unknown User',
            action: 'SAVE_CURVE_SNAPSHOT',
            module: 'MARKET_DATA',
            description: `Saved manual curve snapshot for ${currency} on ${selectedDate}`
        });
    };

    const handleImport = (importedData: any[]) => {
        const key = `${currency}-${selectedDate}`;
        const newCurve: YieldCurvePoint[] = importedData.map(row => ({
            tenor: row.Tenor || row.tenor,
            rate: parseFloat(row.Rate || row.rate) || 0,
            prev: parseFloat(row.Prev || row.prev) || 0
        }));

        setCurvesHistory(prev => ({ ...prev, [key]: newCurve }));
        setIsImportOpen(false);

        storage.addAuditEntry({
            userEmail: user?.email || 'unknown',
            userName: user?.name || 'Unknown User',
            action: 'IMPORT_CURVE',
            module: 'MARKET_DATA',
            description: `Imported ${currency} yield curve for ${selectedDate}`
        });
    };

    const handleDownloadTemplate = () => {
        downloadTemplate('YIELD_CURVE', `Yield_Curve_Template_${currency}`);
    };

    const curveTemplate = "tenor,rate,prev\nON,5.25,5.20\n1M,5.30,5.28\n1Y,5.10,5.05\n10Y,4.25,4.30";

    // Calculations for Chart
    const minRate = Math.min(...data.map(d => Math.min(d.rate, d.prev))) * 0.9;
    const maxRate = Math.max(...data.map(d => Math.max(d.rate, d.prev))) * 1.1;
    const xStep = (width - padding * 2) / (data.length - 1);

    const getX = (i: number) => padding + i * xStep;
    const getY = (rate: number) => height - padding - ((rate - minRate) / (maxRate - minRate)) * (height - padding * 2);

    const points = data.map((d, i) => `${getX(i)},${getY(d.rate)}`).join(' ');
    const areaPoints = `${getX(0)},${height - padding} ${points} ${getX(data.length - 1)},${height - padding}`;
    const prevPoints = data.map((d, i) => `${getX(i)},${getY(d.prev)}`).join(' ');
    const basePoints = data.map((d, i) => `${getX(i)},${getY(d.baseRate)}`).join(' '); // Pre-shock baseline

    // Mock Pricing History/Audit Trail
    const pricingVersions = [
        { id: 'v1.0.4', date: '2023-10-24 14:00', user: 'System', curve: 'EOD Final' },
        { id: 'v1.0.3', date: '2023-10-24 12:30', user: 'A. Chen', curve: 'Intraday Snap' },
        { id: 'v1.0.2', date: '2023-10-24 09:15', user: 'System', curve: 'Morning Open' },
        { id: 'v1.0.1', date: '2023-10-23 18:00', user: 'System', curve: 'EOD Final' },
    ];

    return (
        <div className="flex flex-col xl:grid xl:grid-cols-3 gap-4 md:gap-6 h-full min-h-0 overflow-auto custom-scrollbar">
            {/* Chart Section */}
            <div className="xl:col-span-2 flex flex-col min-h-[500px] xl:min-h-0">
                <Panel
                    title={`${t.yieldCurves} (${currency})`}
                    className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white/50 dark:bg-slate-950/50"
                >
                    <div className="flex flex-col xl:flex-row h-full min-h-0">
                        {/* Main Chart Area */}
                        <div className="flex-1 flex flex-col min-h-[300px] xl:min-h-0 border-b xl:border-b-0 xl:border-r border-slate-200 dark:border-slate-800 relative">
                            {/* SVG Chart Toolbar */}
                            <div className="h-10 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center px-4 justify-between shrink-0">
                                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 md:pb-0">
                                    {/* Shock Input */}
                                    <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/50 shrink-0">
                                        <Zap size={12} className="text-amber-500" />
                                        <input
                                            type="number"
                                            value={shockBps}
                                            onChange={(e) => setShockBps(parseFloat(e.target.value))}
                                            className="bg-transparent border-none text-[10px] text-amber-600 dark:text-amber-400 w-8 text-center focus:ring-0 font-bold"
                                        />
                                        <span className="text-[9px] text-amber-500 uppercase font-bold">bps</span>
                                    </div>
                                    <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 shrink-0"></div>
                                    {/* Date Picker */}
                                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded shrink-0">
                                        <Calendar size={12} className="text-slate-400" />
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="bg-transparent border-none text-[10px] text-slate-700 dark:text-slate-300 w-24 focus:ring-0 font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <div className="flex bg-slate-200 dark:bg-slate-800 p-0.5 rounded">
                                        {['USD', 'EUR', 'GBP', 'JPY'].map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setCurrency(c)}
                                                className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all ${currency === c
                                                    ? 'bg-white dark:bg-slate-600 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={handleDownloadTemplate} className="p-1 text-slate-400 hover:text-amber-500 transition-colors" title="Download Template"><FileSpreadsheet size={14} /></button>
                                    <button onClick={handleSaveSnapshot} className="p-1 text-slate-400 hover:text-emerald-500 transition-colors" title="Save Snapshot"><Save size={14} /></button>
                                    <button onClick={() => setIsImportOpen(true)} className="p-1 text-slate-400 hover:text-cyan-500 transition-colors" title="Import Data"><Upload size={14} /></button>
                                </div>
                            </div>

                            <div className="flex-1 w-full p-4 overflow-hidden flex items-center justify-center bg-white dark:bg-black/20">
                                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-h-[300px] overflow-visible">
                                    {/* Grid Lines */}
                                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                                        const y = padding + tick * (height - 2 * padding);
                                        const val = maxRate - tick * (maxRate - minRate);
                                        return (
                                            <g key={tick}>
                                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" strokeDasharray="4 4" />
                                                <text x={padding - 10} y={y + 3} textAnchor="end" className="fill-slate-400 dark:fill-slate-600" fontSize="10" fontFamily="monospace">{val.toFixed(2)}%</text>
                                            </g>
                                        );
                                    })}
                                    <polygon points={areaPoints} fill="url(#curveGradient)" />
                                    <polyline points={prevPoints} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.4" />
                                    {shockBps !== 0 && (
                                        <polyline points={basePoints} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />
                                    )}
                                    <polyline points={points} fill="none" stroke={shockBps !== 0 ? '#fbbf24' : '#22d3ee'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    {data.map((d, i) => (
                                        <g key={i} className="group">
                                            <circle cx={getX(i)} cy={getY(d.rate)} r="4" className="fill-white dark:fill-slate-900" stroke={shockBps !== 0 ? '#fbbf24' : '#22d3ee'} strokeWidth="2" />
                                            <text x={getX(i)} y={height - 10} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500" fontSize="10" fontWeight="bold" fontFamily="monospace">{d.tenor}</text>
                                        </g>
                                    ))}
                                    <defs>
                                        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
                                            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>

                            <div className="h-8 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center px-4 justify-between text-[10px] text-slate-500 shrink-0 font-mono">
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1.5"><div className={`w-3 h-0.5 rounded-full ${shockBps !== 0 ? 'bg-amber-400' : 'bg-cyan-500'}`}></div> {curvesHistory[`${currency}-${selectedDate}`] ? 'PERSISTED' : 'REALTIME'}</span>
                                    <span className="flex items-center gap-1.5"><div className="w-3 h-0.5 border border-slate-400 border-dashed"></div> PREV CLOSE</span>
                                </div>
                                <div className="hidden sm:block">CURRENCY: {currency} | AS OF: {selectedDate}</div>
                            </div>
                        </div>

                        {/* Historical Snapshots List */}
                        <div className="w-full xl:w-64 flex flex-col bg-white dark:bg-black/30 shrink-0">
                            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Saved Snapshots</span>
                                <History size={14} className="text-slate-400" />
                            </div>
                            <div className="overflow-auto max-h-[150px] xl:max-h-none xl:flex-1 custom-scrollbar">
                                {Object.keys(curvesHistory).filter(k => k.startsWith(currency)).length === 0 ? (
                                    <div className="p-8 text-center text-[10px] text-slate-500 uppercase font-bold opacity-30">No snapshots</div>
                                ) : (
                                    Object.keys(curvesHistory).filter(k => k.startsWith(currency)).map((k, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedDate(k.split('-').slice(1).join('-'))}
                                            className={`p-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50 cursor-pointer flex items-center justify-between transition-colors ${selectedDate === k.split('-').slice(1).join('-') ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <FileCheck size={14} className="text-emerald-500" />
                                                <span className="text-xs font-mono dark:text-slate-300">{k.split('-').slice(1).join('-')}</span>
                                            </div>
                                            <ChevronDown size={12} className="text-slate-400 -rotate-90" />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </Panel>
            </div>

            {/* Rates Table Section */}
            <div className="flex flex-col h-full min-h-[400px] xl:min-h-0">
                <Panel title="Market Rates Breakdown" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                        <span className="text-[10px] uppercase text-slate-500 font-bold">Tenor Spot Rates</span>
                        <Badge variant="outline" className="text-[9px]">{currency}</Badge>
                    </div>
                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-10">
                                <tr>
                                    <th className="p-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider pl-4">Term</th>
                                    <th className="p-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider text-right">Yield</th>
                                    <th className="p-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider text-right pr-4">Chg</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                                {data.map((d) => {
                                    const change = d.rate - d.prev;
                                    const isPos = change >= 0;
                                    return (
                                        <tr key={d.tenor} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="p-2 pl-4 font-bold text-slate-700 dark:text-slate-300">{d.tenor}</td>
                                            <td className="p-2 text-right font-bold text-cyan-600 dark:text-cyan-400">{d.rate.toFixed(3)}%</td>
                                            <td className={`p-2 pr-4 text-right flex items-center justify-end gap-1 ${isPos ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {Math.abs(change * 100).toFixed(1)}
                                                {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Simplified Audit Feed */}
                    <div className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                        <div className="text-[9px] uppercase font-bold text-slate-400 mb-2">Version Audit Trail</div>
                        <div className="space-y-2">
                            {pricingVersions.slice(0, 3).map(v => (
                                <div key={v.id} className="flex justify-between items-center text-[10px]">
                                    <span className="text-slate-600 dark:text-slate-400">{v.date}</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{v.id}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>
            </div>

            <FileUploadModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onUpload={handleImport}
                title={`Import ${currency} Curve`}
                templateName="yield_curve_template.csv"
                templateContent={curveTemplate}
            />
        </div>
    );
};

export default YieldCurvePanel;
