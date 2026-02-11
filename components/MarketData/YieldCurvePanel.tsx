
import React, { useState, useMemo } from 'react';
import { Panel, Badge, TextInput } from '../ui/LayoutComponents';
import { MOCK_YIELD_CURVE } from '../../constants';
import { RefreshCw, TrendingUp, TrendingDown, Calendar, History, FileCheck, Zap } from 'lucide-react';

const YieldCurvePanel: React.FC = () => {
  const [currency, setCurrency] = useState('USD');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [shockBps, setShockBps] = useState<number>(0);

  // Simple scale functions for SVG
  const width = 800;
  const height = 300;
  const padding = 40;
  
  // Transform mock data based on currency AND date to simulate historical curves
  // PLUS apply shock
  const data = useMemo(() => {
    let modifier = 0;
    if (currency === 'EUR') modifier = -1.5;
    if (currency === 'GBP') modifier = 0.5;
    if (currency === 'JPY') modifier = -4.0;
    
    // Pseudo-random modification based on date string
    const dateNum = selectedDate.split('-').reduce((a, b) => a + parseInt(b), 0);
    const dateMod = (dateNum % 5) * 0.1; // Shift slightly based on date

    return MOCK_YIELD_CURVE.map((pt, i) => {
      // Base Rate logic
      const baseRate = Math.max(0.1, pt.rate + modifier + dateMod);
      const shockedRate = baseRate + (shockBps / 100);

      return {
        ...pt,
        baseRate: baseRate,
        rate: Math.max(0.01, shockedRate), // Prevent negative visual for now
        prev: Math.max(0.1, pt.prev + modifier),
        index: i
      };
    });
  }, [currency, selectedDate, shockBps]);

  // Calculations for Chart
  const minRate = Math.min(...data.map(d => Math.min(d.rate, d.prev))) * 0.9;
  const maxRate = Math.max(...data.map(d => Math.max(d.rate, d.prev))) * 1.1;
  const xStep = (width - padding * 2) / (data.length - 1);

  const getX = (i: number) => padding + i * xStep;
  const getY = (rate: number) => height - padding - ((rate - minRate) / (maxRate - minRate)) * (height - padding * 2);

  const points = data.map((d, i) => `${getX(i)},${getY(d.rate)}`).join(' ');
  const areaPoints = `${getX(0)},${height-padding} ${points} ${getX(data.length-1)},${height-padding}`;
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Chart Section */}
      <Panel title={`Government Yield Curve (${currency})`} className="lg:col-span-2 min-h-[400px]">
        <div className="flex flex-col h-full relative">
            
            {/* Toolbar: Currency & Date & Shock */}
            <div className="absolute top-4 right-4 z-10 flex gap-4 items-center">
                
                {/* Shock Input */}
                <div className="flex items-center gap-2 bg-amber-950/30 p-1 px-3 rounded border border-amber-900/50">
                    <Zap size={14} className="text-amber-400" />
                    <span className="text-[10px] uppercase font-bold text-amber-500">Shock</span>
                    <input 
                        type="number" 
                        value={shockBps}
                        onChange={(e) => setShockBps(parseFloat(e.target.value))}
                        className="bg-slate-900/50 border border-slate-700 rounded text-[10px] text-white w-12 text-center focus:outline-none focus:border-amber-500"
                        placeholder="bps"
                    />
                    <span className="text-[10px] text-slate-500">bps</span>
                </div>

                <div className="h-6 w-px bg-slate-700 mx-1"></div>

                {/* Historical Date Selector */}
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded border border-slate-700">
                    <Calendar size={14} className="text-slate-400 ml-2" />
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent border-none text-[10px] text-white focus:ring-0 font-mono w-24"
                    />
                </div>

                <div className="h-6 w-px bg-slate-700 mx-1"></div>

                {/* Currency Selector */}
                <div className="flex gap-1">
                    {['USD', 'EUR', 'GBP', 'JPY'].map(c => (
                        <button 
                            key={c}
                            onClick={() => setCurrency(c)}
                            className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                                currency === c 
                                ? 'bg-cyan-950 text-cyan-400 border-cyan-700 shadow-[0_0_10px_rgba(34,211,238,0.2)]' 
                                : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-slate-300'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 w-full h-full p-4 overflow-hidden flex items-center justify-center bg-slate-900">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                         const y = padding + tick * (height - 2*padding);
                         const val = maxRate - tick * (maxRate - minRate);
                         return (
                            <g key={tick}>
                                <line x1={padding} y1={y} x2={width-padding} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
                                <text x={padding - 10} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace">{val.toFixed(2)}%</text>
                            </g>
                         );
                    })}

                    {/* Gradient Defs */}
                    <defs>
                        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2"/>
                            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
                        </linearGradient>
                    </defs>

                    {/* Area Fill */}
                    <polygon points={areaPoints} fill="url(#curveGradient)" />

                    {/* Previous Close Line (Dashed) */}
                    <polyline points={prevPoints} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.6" />

                    {/* Baseline if Shocked (Dotted) */}
                    {shockBps !== 0 && (
                        <polyline points={basePoints} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                    )}

                    {/* Main Curve Line */}
                    <polyline points={points} fill="none" stroke={shockBps !== 0 ? '#fbbf24' : '#22d3ee'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Data Points */}
                    {data.map((d, i) => (
                        <g key={i} className="group">
                             <circle cx={getX(i)} cy={getY(d.rate)} r="3" fill="#0f172a" stroke={shockBps !== 0 ? '#fbbf24' : '#22d3ee'} strokeWidth="2" />
                             {/* Tooltip on hover simulation using group-hover */}
                             <foreignObject x={getX(i) - 20} y={getY(d.rate) - 30} width="40" height="25" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="bg-slate-800 text-white text-[9px] px-1 py-0.5 rounded border border-slate-600 text-center shadow-lg">
                                    {d.rate.toFixed(2)}%
                                </div>
                             </foreignObject>
                             
                             {/* X Axis Labels */}
                             <text x={getX(i)} y={height - 15} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold" fontFamily="monospace">{d.tenor}</text>
                        </g>
                    ))}
                </svg>
            </div>
            
            <div className="h-8 border-t border-slate-800 bg-slate-950 flex items-center px-4 justify-between text-[10px] text-slate-500 font-mono">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><div className={`w-3 h-0.5 ${shockBps !== 0 ? 'bg-amber-400' : 'bg-cyan-400'}`}></div> {selectedDate === new Date().toISOString().split('T')[0] ? 'LIVE' : 'SNAPSHOT'} {shockBps !== 0 ? '(SHOCKED)' : ''}</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-slate-500 border border-slate-500 border-dashed"></div> PREV CLOSE</span>
                </div>
                <div>EFFECTIVE: {selectedDate} 17:00 EST</div>
            </div>
        </div>
      </Panel>

      {/* Side Column */}
      <div className="flex flex-col gap-6 lg:col-span-1 h-full">
          
          {/* Pricing Audit Trail */}
          <Panel title="Pricing Traceability / Audit" className="flex-1 max-h-[50%]">
             <div className="flex flex-col h-full">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center gap-2">
                    <History size={12} className="text-cyan-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-400">Available Snapshots</span>
                </div>
                <div className="overflow-auto flex-1">
                   {pricingVersions.map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer group transition-colors">
                          <div className="flex items-start gap-2">
                             <FileCheck size={14} className="text-slate-600 group-hover:text-emerald-500 mt-0.5" />
                             <div>
                                <div className="text-xs text-slate-300 font-mono">{v.id}</div>
                                <div className="text-[10px] text-slate-500">{v.date}</div>
                             </div>
                          </div>
                          <div className="text-right">
                             <Badge variant="default">{v.curve}</Badge>
                             <div className="text-[9px] text-slate-600 mt-1">{v.user}</div>
                          </div>
                      </div>
                   ))}
                </div>
             </div>
          </Panel>

          {/* Market Rates Grid */}
          <Panel title="Detailed Rates (BPS)" className="flex-1">
            <div className="flex flex-col h-full">
                <div className="p-2 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                    <span className="text-[10px] uppercase text-slate-500 font-bold">Tenor Breakdown</span>
                    <RefreshCw size={12} className="text-slate-500 cursor-pointer hover:text-cyan-400 hover:rotate-180 transition-all duration-500" />
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-950 sticky top-0">
                            <tr>
                                <th className="p-2 text-[10px] text-slate-500 font-bold border-b border-slate-800">TERM</th>
                                <th className="p-2 text-[10px] text-slate-500 font-bold border-b border-slate-800 text-right">YIELD</th>
                                <th className="p-2 text-[10px] text-slate-500 font-bold border-b border-slate-800 text-right">CHG</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 font-mono text-xs">
                            {data.map((d) => {
                                const change = d.rate - d.prev;
                                const isPos = change >= 0;
                                return (
                                    <tr key={d.tenor} className="hover:bg-slate-800/50">
                                        <td className="p-2 pl-3 text-slate-400 font-semibold">{d.tenor}</td>
                                        <td className="p-2 text-right text-slate-200">{d.rate.toFixed(3)}%</td>
                                        <td className="p-2 text-right pr-3 flex items-center justify-end gap-1">
                                            <span className={isPos ? 'text-emerald-500' : 'text-red-500'}>
                                                {Math.abs(change * 100).toFixed(1)}
                                            </span>
                                            {isPos ? <TrendingUp size={10} className="text-emerald-500" /> : <TrendingDown size={10} className="text-red-500" />}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
          </Panel>
      </div>
    </div>
  );
};

export default YieldCurvePanel;
